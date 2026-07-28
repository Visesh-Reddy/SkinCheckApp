package com.skincheck.facescanner;

// FaceScannerGLRenderer.java
//
// IMPORTANT ARCHITECTURAL NOTE (read before wiring this up):
// Unlike iOS's ARSession (which can run headless, no view required),
// ARCore's Session.update() REQUIRES a camera texture bound inside a live
// GL context -- you cannot call session.update() without first generating a
// GL texture name via a current EGL context and passing it to
// session.setCameraTextureName(id). This is documented ARCore behavior, not
// an implementation choice, so this module is split into:
//   1. This renderer (owns the ARCore Session + GL context, via GLSurfaceView)
//   2. FaceScannerCameraView (the actual GLSurfaceView, exposed to RN as a
//      native UI component -- the JS scan screen must render this view
//      on-screen for the session to run at all)
//   3. FaceScannerModule (a plain NativeModule for one-shot calls like
//      captureCurrentMesh()/capturePhoto(), which read the latest state
//      this renderer publishes to FaceScannerState)
//
// API calls verified against developers.google.com/ar/reference/java --
// NOT compiled or run here (no Android SDK/Java compiler in this
// environment). Build and test on a real ARCore-supported device.

import android.content.Context;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.media.Image;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.view.WindowManager;

import com.google.ar.core.AugmentedFace;
import com.google.ar.core.Config;
import com.google.ar.core.Coordinates2d;
import com.google.ar.core.Frame;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.UnavailableException;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.Collection;
import java.util.EnumSet;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

public class FaceScannerGLRenderer implements GLSurfaceView.Renderer {

  // --- Shared state published by the GL render thread, read by
  // FaceScannerModule on the JS-call thread. A plain static holder is
  // intentional here rather than a full pub/sub layer -- keep it simple. ---
  public static class FaceScannerState {
    public static volatile Session session;
    public static volatile AugmentedFace latestFace;
    public static volatile Frame latestFrame;
    public static volatile float[] latestPose; // 16-float column-major, from centerPose.toMatrix()

    // Same verified formula as the web prototype and iOS module. ARCore's
    // Pose.toMatrix() convention may not exactly match -- confirm signs on a
    // real ARCore-certified device and flip these if needed.
    public static final float YAW_SIGN = 1f;
    public static final float PITCH_SIGN = 1f;

    public static float[] extractEuler(float[] m) {
      float pitch = (float) Math.asin(clamp(-m[9], -1f, 1f));
      float yaw = (float) Math.atan2(m[8], m[10]);
      float roll = (float) Math.atan2(m[1], m[5]);
      return new float[] {
        YAW_SIGN * toDeg(yaw),
        PITCH_SIGN * toDeg(pitch),
        toDeg(roll)
      };
    }

    private static float clamp(float v, float min, float max) {
      return Math.max(min, Math.min(max, v));
    }

    private static float toDeg(float radians) {
      return radians * 180f / (float) Math.PI;
    }
  }

  public interface PoseListener {
    void onPose(float yaw, float pitch, float roll, boolean tracking);
  }

  private final Context context;
  private int cameraTextureId = -1;

  // --- Camera background passthrough rendering ---
  // Follows the same pattern as Google's own ARCore sample BackgroundRenderer
  // (hello_ar_java) -- a full-screen quad textured with the external OES
  // camera texture, with UV coordinates re-queried from the Frame whenever
  // display geometry changes (device rotation etc). Without this, the GL
  // surface only ever shows its clear color -- a real gap in the first
  // version of this file, which bound the camera texture for ARCore's
  // internal tracking but never actually drew it to screen.
  private static final String BG_VERTEX_SHADER =
    "attribute vec4 aPosition;" +
    "attribute vec2 aTexCoord;" +
    "varying vec2 vTexCoord;" +
    "void main() {" +
    "  gl_Position = aPosition;" +
    "  vTexCoord = aTexCoord;" +
    "}";

  private static final String BG_FRAGMENT_SHADER =
    "#extension GL_OES_EGL_image_external : require\n" +
    "precision mediump float;" +
    "uniform samplerExternalOES sTexture;" +
    "varying vec2 vTexCoord;" +
    "void main() {" +
    "  gl_FragColor = texture2D(sTexture, vTexCoord);" +
    "}";

  private int bgProgram;
  private int bgPositionHandle, bgTexCoordHandle, bgTextureHandle;
  private FloatBuffer quadCoords;
  private FloatBuffer quadTexCoords;

  private static final float[] QUAD_COORDS = {
    -1f, -1f,
     1f, -1f,
    -1f,  1f,
     1f,  1f,
  };
  private int surfaceWidth = 0;
  private int surfaceHeight = 0;
  private boolean viewportChanged = false;
  public PoseListener poseListener;

  public FaceScannerGLRenderer(Context context) {
    this.context = context;
  }

  public Session ensureSession() {
    Session session = FaceScannerState.session;
    if (session == null) {
      try {
        session = new Session(context, EnumSet.of(Session.Feature.FRONT_CAMERA));
        Config config = new Config(session);
        config.setAugmentedFaceMode(Config.AugmentedFaceMode.MESH3D);
        session.configure(config);
        FaceScannerState.session = session;
      } catch (UnavailableException e) {
        // ARCore not installed/too old/device unsupported -- isSupported()
        // in FaceScannerModule.java should have already routed the JS layer
        // away from this path, but fail safely here regardless rather than
        // crash: leave session null, onDrawFrame's null check handles it.
        return null;
      }
    }
    return session;
  }

  @Override
  public void onSurfaceCreated(GL10 gl, EGLConfig config) {
    int[] textures = new int[1];
    GLES20.glGenTextures(1, textures, 0);
    cameraTextureId = textures[0];
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);

    setUpBackgroundRendering();

    Session session = ensureSession();
    if (session == null) return; // ARCore unavailable -- nothing more to do here
    session.setCameraTextureName(cameraTextureId);
    try {
      session.resume();
    } catch (Exception e) {
      // Camera permission not yet granted, or another AR session running --
      // JS layer must request permission before mounting this view (see
      // ScanScreen.tsx's ensureCameraPermission()).
    }
  }

  private void setUpBackgroundRendering() {
    ByteBuffer bb = ByteBuffer.allocateDirect(QUAD_COORDS.length * 4);
    bb.order(ByteOrder.nativeOrder());
    quadCoords = bb.asFloatBuffer();
    quadCoords.put(QUAD_COORDS).position(0);

    ByteBuffer tb = ByteBuffer.allocateDirect(8 * 4);
    tb.order(ByteOrder.nativeOrder());
    quadTexCoords = tb.asFloatBuffer();
    // Default identity mapping until the first real Frame updates this via
    // transformCoordinates2d (see onDrawFrame) -- avoids a blank first frame.
    quadTexCoords.put(new float[] { 0f, 1f, 1f, 1f, 0f, 0f, 1f, 0f }).position(0);

    int vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, BG_VERTEX_SHADER);
    int fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, BG_FRAGMENT_SHADER);
    bgProgram = GLES20.glCreateProgram();
    GLES20.glAttachShader(bgProgram, vertexShader);
    GLES20.glAttachShader(bgProgram, fragmentShader);
    GLES20.glLinkProgram(bgProgram);

    bgPositionHandle = GLES20.glGetAttribLocation(bgProgram, "aPosition");
    bgTexCoordHandle = GLES20.glGetAttribLocation(bgProgram, "aTexCoord");
    bgTextureHandle = GLES20.glGetUniformLocation(bgProgram, "sTexture");
  }

  private int compileShader(int type, String source) {
    int shader = GLES20.glCreateShader(type);
    GLES20.glShaderSource(shader, source);
    GLES20.glCompileShader(shader);
    return shader;
  }

  private void drawCameraBackground() {
    GLES20.glDisable(GLES20.GL_DEPTH_TEST);
    GLES20.glDepthMask(false);

    GLES20.glUseProgram(bgProgram);
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId);
    GLES20.glUniform1i(bgTextureHandle, 0);

    quadCoords.position(0);
    GLES20.glEnableVertexAttribArray(bgPositionHandle);
    GLES20.glVertexAttribPointer(bgPositionHandle, 2, GLES20.GL_FLOAT, false, 0, quadCoords);

    quadTexCoords.position(0);
    GLES20.glEnableVertexAttribArray(bgTexCoordHandle);
    GLES20.glVertexAttribPointer(bgTexCoordHandle, 2, GLES20.GL_FLOAT, false, 0, quadTexCoords);

    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);

    GLES20.glDisableVertexAttribArray(bgPositionHandle);
    GLES20.glDisableVertexAttribArray(bgTexCoordHandle);
    GLES20.glDepthMask(true);
    GLES20.glEnable(GLES20.GL_DEPTH_TEST);
  }

  @Override
  public void onSurfaceChanged(GL10 gl, int width, int height) {
    GLES20.glViewport(0, 0, width, height);
    surfaceWidth = width;
    surfaceHeight = height;
    viewportChanged = true;
  }

  @Override
  public void onDrawFrame(GL10 gl) {
    GLES20.glClearColor(0.08f, 0.09f, 0.13f, 1f);
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);

    Session session = FaceScannerState.session;
    if (session == null) return;

    if (viewportChanged) {
      int displayRotation = ((WindowManager) context.getSystemService(Context.WINDOW_SERVICE))
        .getDefaultDisplay().getRotation();
      session.setDisplayGeometry(displayRotation, surfaceWidth, surfaceHeight);
      viewportChanged = false;
    }

    Frame frame;
    try {
      frame = session.update();
    } catch (Exception e) {
      return; // camera not ready yet, or a transient ARCore error -- skip this frame
    }
    FaceScannerState.latestFrame = frame;

    // Re-query UV coordinates whenever display rotation/size changes, same
    // pattern as Google's own ARCore BackgroundRenderer sample.
    if (frame.hasDisplayGeometryChanged()) {
      frame.transformCoordinates2d(
        Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
        quadCoords,
        Coordinates2d.TEXTURE_NORMALIZED,
        quadTexCoords
      );
    }

    if (frame.getTimestamp() != 0) {
      drawCameraBackground();
    }

    Collection<AugmentedFace> faces = session.getAllTrackables(AugmentedFace.class);
    AugmentedFace trackedFace = null;
    for (AugmentedFace face : faces) {
      if (face.getTrackingState() == TrackingState.TRACKING) {
        trackedFace = face;
        break;
      }
    }
    FaceScannerState.latestFace = trackedFace;

    if (trackedFace != null) {
      float[] matrix = new float[16];
      trackedFace.getCenterPose().toMatrix(matrix, 0);
      FaceScannerState.latestPose = matrix;
      float[] euler = FaceScannerState.extractEuler(matrix);
      if (poseListener != null) poseListener.onPose(euler[0], euler[1], euler[2], true);
    } else {
      if (poseListener != null) poseListener.onPose(0f, 0f, 0f, false);
    }
  }

  public void pause() {
    if (FaceScannerState.session != null) {
      FaceScannerState.session.pause();
    }
  }

  public void destroy() {
    if (FaceScannerState.session != null) {
      FaceScannerState.session.close();
      FaceScannerState.session = null;
      FaceScannerState.latestFace = null;
      FaceScannerState.latestFrame = null;
    }
  }

  // --- Same Laplacian-variance / luminance formula as qualityChecks.ts and
  // the iOS module -- keep all three in sync if the threshold changes. ---

  public static class QualityResult {
    public final boolean blurOk;
    public final boolean lightingOk;
    public final String reason;

    public QualityResult(boolean blurOk, boolean lightingOk, String reason) {
      this.blurOk = blurOk;
      this.lightingOk = lightingOk;
      this.reason = reason;
    }
  }

  public static QualityResult computeQualityFromFrame(Frame frame) {
    Image image = null;
    try {
      image = frame.acquireCameraImage();
      ByteBuffer buffer = image.getPlanes()[0].getBuffer();
      int rowStride = image.getPlanes()[0].getRowStride();
      int width = image.getWidth();
      int height = image.getHeight();
      int step = 4;

      double sum = 0, count = 0;
      double lapSum = 0, lapSumSq = 0, lapCount = 0;

      for (int y = step; y < height - step; y += step) {
        for (int x = step; x < width - step; x += step) {
          double center = sampleAt(buffer, rowStride, x, y);
          sum += center;
          count++;
          double lap = -4 * center
            + sampleAt(buffer, rowStride, x - step, y)
            + sampleAt(buffer, rowStride, x + step, y)
            + sampleAt(buffer, rowStride, x, y - step)
            + sampleAt(buffer, rowStride, x, y + step);
          lapSum += lap;
          lapSumSq += lap * lap;
          lapCount++;
        }
      }

      double avgLum = count > 0 ? sum / count : 128.0;
      double lapMean = lapCount > 0 ? lapSum / lapCount : 0.0;
      double variance = lapCount > 0 ? (lapSumSq / lapCount - lapMean * lapMean) : 0.0;

      boolean blurOk = variance > 12;
      boolean lightingOk = true;
      String reason = "none";
      if (avgLum < 45) { lightingOk = false; reason = "dark"; }
      else if (avgLum > 235) { lightingOk = false; reason = "bright"; }
      else if (!blurOk) { reason = "blur"; }

      return new QualityResult(blurOk, lightingOk, reason);
    } catch (Exception e) {
      return new QualityResult(true, true, "none"); // fail open -- don't block on a transient read error
    } finally {
      if (image != null) image.close();
    }
  }

  private static int sampleAt(ByteBuffer buffer, int rowStride, int x, int y) {
    return buffer.get(y * rowStride + x) & 0xFF;
  }

  // NV21/YUV_420_888 -> JPEG, standard Android conversion pattern.
  public static byte[] frameToJpegBytes(Frame frame) {
    Image image = null;
    try {
      image = frame.acquireCameraImage();
      ByteBuffer yBuffer = image.getPlanes()[0].getBuffer();
      ByteBuffer uBuffer = image.getPlanes()[1].getBuffer();
      ByteBuffer vBuffer = image.getPlanes()[2].getBuffer();
      int ySize = yBuffer.remaining();
      int uSize = uBuffer.remaining();
      int vSize = vBuffer.remaining();
      byte[] nv21 = new byte[ySize + uSize + vSize];
      yBuffer.get(nv21, 0, ySize);
      vBuffer.get(nv21, ySize, vSize);
      uBuffer.get(nv21, ySize + vSize, uSize);

      YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21, image.getWidth(), image.getHeight(), null);
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      yuvImage.compressToJpeg(new Rect(0, 0, image.getWidth(), image.getHeight()), 85, out);
      return out.toByteArray();
    } catch (Exception e) {
      return null;
    } finally {
      if (image != null) image.close();
    }
  }
}
