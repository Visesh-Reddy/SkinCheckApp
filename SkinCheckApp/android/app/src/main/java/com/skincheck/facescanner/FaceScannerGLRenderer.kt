package com.skincheck.facescanner

// FaceScannerGLRenderer.kt
//
// IMPORTANT ARCHITECTURAL NOTE (read before wiring this up):
// Unlike iOS's ARSession (which can run headless, no view required),
// ARCore's Session.update() REQUIRES a camera texture bound inside a live
// GL context — you cannot call session.update() without first generating a
// GL texture name via a current EGL context and passing it to
// session.setCameraTextureName(id). This is documented ARCore behavior, not
// an implementation choice, so this module is split into:
//   1. This renderer (owns the ARCore Session + GL context, via GLSurfaceView)
//   2. FaceScannerCameraView (the actual GLSurfaceView, exposed to RN as a
//      native UI component — the JS scan screen must render this view
//      on-screen for the session to run at all; it can be visually
//      overlaid by the RN pose-guide UI, but it must exist in the view tree)
//   3. FaceScannerModule (a plain NativeModule for one-shot calls like
//      captureCurrentMesh()/capturePhoto(), which read the latest state
//      this renderer publishes to FaceScannerState)
//
// API calls verified against developers.google.com/ar/reference/java —
// NOT compiled or run here (no Android SDK/Kotlin compiler in this
// environment). Build and test on a real ARCore-supported device.

import android.content.Context
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import com.google.ar.core.AugmentedFace
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import java.io.ByteArrayOutputStream
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

// Shared, thread-aware state published by the GL render thread and read by
// FaceScannerModule on the JS-call thread. Kept intentionally simple
// (a synchronized holder) rather than over-engineering a full pub/sub layer.
object FaceScannerState {
  @Volatile var session: Session? = null
  @Volatile var latestFace: AugmentedFace? = null
  @Volatile var latestFrame: Frame? = null
  @Volatile var latestPose: FloatArray? = null // 16-float column-major, from centerPose.toMatrix()

  // Same verified formula as the web prototype and iOS module. ARCore's
  // Pose.toMatrix() convention may not exactly match — confirm signs on a
  // real ARCore-certified device and flip these if needed.
  const val YAW_SIGN = 1f
  const val PITCH_SIGN = 1f

  fun extractEuler(m: FloatArray): Triple<Float, Float, Float> {
    val pitch = Math.asin((-m[9]).coerceIn(-1f, 1f).toDouble()).toFloat()
    val yaw = Math.atan2(m[8].toDouble(), m[10].toDouble()).toFloat()
    val roll = Math.atan2(m[1].toDouble(), m[5].toDouble()).toFloat()
    val toDeg = { r: Float -> r * 180f / Math.PI.toFloat() }
    return Triple(YAW_SIGN * toDeg(yaw), PITCH_SIGN * toDeg(pitch), toDeg(roll))
  }
}

class FaceScannerGLRenderer(private val context: Context) : GLSurfaceView.Renderer {

  private var cameraTextureId = -1
  var poseListener: ((yaw: Float, pitch: Float, roll: Float, tracking: Boolean) -> Unit)? = null

  fun ensureSession(): Session {
    var session = FaceScannerState.session
    if (session == null) {
      session = Session(context, java.util.EnumSet.of(Session.Feature.FRONT_CAMERA))
      val config = Config(session)
      config.augmentedFaceMode = Config.AugmentedFaceMode.MESH3D
      session.configure(config)
      FaceScannerState.session = session
    }
    return session
  }

  override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    cameraTextureId = textures[0]
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)

    val session = ensureSession()
    session.setCameraTextureName(cameraTextureId)
    session.resume()
  }

  override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
    GLES20.glViewport(0, 0, width, height)
  }

  override fun onDrawFrame(gl: GL10?) {
    val session = FaceScannerState.session ?: return
    val frame: Frame
    try {
      frame = session.update()
    } catch (e: Exception) {
      return // camera not ready yet, or a transient ARCore error — skip this frame
    }
    FaceScannerState.latestFrame = frame

    val faces = session.getAllTrackables(AugmentedFace::class.java)
    val trackedFace = faces.firstOrNull { it.trackingState == TrackingState.TRACKING }
    FaceScannerState.latestFace = trackedFace

    if (trackedFace != null) {
      val matrix = FloatArray(16)
      trackedFace.centerPose.toMatrix(matrix, 0)
      FaceScannerState.latestPose = matrix
      val (yaw, pitch, roll) = FaceScannerState.extractEuler(matrix)
      poseListener?.invoke(yaw, pitch, roll, true)
    } else {
      poseListener?.invoke(0f, 0f, 0f, false)
    }

    // Clear the screen — this view exists only to host the ARCore GL
    // context, not to render a visible camera passthrough. The actual
    // camera preview shown to the user is a separate RN <Camera> view
    // layered underneath (see README for the two-layer approach).
    GLES20.glClearColor(0f, 0f, 0f, 0f)
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
  }

  fun pause() {
    FaceScannerState.session?.pause()
  }

  fun destroy() {
    FaceScannerState.session?.close()
    FaceScannerState.session = null
    FaceScannerState.latestFace = null
    FaceScannerState.latestFrame = null
  }

  companion object {
    // Same Laplacian-variance / luminance formula as qualityChecks.ts and
    // the iOS module — keep all three in sync if the threshold changes.
    fun computeQualityFromFrame(frame: Frame): Triple<Boolean, Boolean, String> {
      return try {
        val image = frame.acquireCameraImage()
        val yPlane = image.planes[0]
        val buffer = yPlane.buffer
        val rowStride = yPlane.rowStride
        val width = image.width
        val height = image.height
        val step = 4

        var sum = 0.0
        var count = 0.0
        var lapSum = 0.0
        var lapSumSq = 0.0
        var lapCount = 0.0

        fun sampleAt(x: Int, y: Int): Int {
          val idx = y * rowStride + x
          return buffer.get(idx).toInt() and 0xFF
        }

        var y = step
        while (y < height - step) {
          var x = step
          while (x < width - step) {
            val center = sampleAt(x, y).toDouble()
            sum += center; count += 1
            val lap = -4 * center + sampleAt(x - step, y) + sampleAt(x + step, y) +
              sampleAt(x, y - step) + sampleAt(x, y + step)
            lapSum += lap; lapSumSq += lap * lap; lapCount += 1
            x += step
          }
          y += step
        }
        image.close()

        val avgLum = if (count > 0) sum / count else 128.0
        val lapMean = if (lapCount > 0) lapSum / lapCount else 0.0
        val variance = if (lapCount > 0) (lapSumSq / lapCount - lapMean * lapMean) else 0.0

        val blurOk = variance > 12
        var lightingOk = true
        var reason = "none"
        if (avgLum < 45) { lightingOk = false; reason = "dark" }
        else if (avgLum > 235) { lightingOk = false; reason = "bright" }
        else if (!blurOk) { reason = "blur" }

        Triple(blurOk, lightingOk, reason)
      } catch (e: Exception) {
        Triple(true, true, "none") // fail open — don't block the user on a transient read error
      }
    }

    // NV21/YUV_420_888 -> JPEG, standard Android conversion pattern.
    fun frameToJpegBytes(frame: Frame): ByteArray? {
      return try {
        val image = frame.acquireCameraImage()
        val yBuffer = image.planes[0].buffer
        val uBuffer = image.planes[1].buffer
        val vBuffer = image.planes[2].buffer
        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()
        val nv21 = ByteArray(ySize + uSize + vSize)
        yBuffer.get(nv21, 0, ySize)
        vBuffer.get(nv21, ySize, vSize)
        uBuffer.get(nv21, ySize + vSize, uSize)
        val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
        val out = ByteArrayOutputStream()
        yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 85, out)
        image.close()
        out.toByteArray()
      } catch (e: Exception) {
        null
      }
    }
  }
}
