package com.skincheck.facescanner

import android.content.Context
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.ar.core.ArCoreApk
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class FaceScannerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "FaceScannerModule"

  @ReactMethod
  fun isSupported(promise: Promise) {
    val availability = ArCoreApk.getInstance().checkAvailability(reactContext)
    promise.resolve(availability.isSupported)
  }

  // Session lifecycle is actually driven by FaceScannerCameraView mounting/
  // unmounting (see architectural note in FaceScannerGLRenderer.kt) — these
  // two methods exist to match the shared JS contract with iOS, and mostly
  // just confirm state for the caller.
  @ReactMethod
  fun startSession(promise: Promise) {
    if (FaceScannerState.session != null) {
      promise.resolve(null)
    } else {
      promise.reject("NOT_STARTED", "Mount <FaceScannerCameraView /> first — it owns the ARCore session.")
    }
  }

  @ReactMethod
  fun stopSession(promise: Promise) {
    FaceScannerState.session?.pause()
    promise.resolve(null)
  }

  @ReactMethod
  fun captureCurrentMesh(promise: Promise) {
    val face = FaceScannerState.latestFace
    if (face == null) {
      promise.reject("NO_FACE", "No face currently tracked.")
      return
    }
    val verticesBuf = face.meshVertices
    val uvsBuf = face.meshTextureCoordinates
    val indicesBuf = face.meshTriangleIndices

    val vertices = Arguments.createArray()
    verticesBuf.rewind()
    while (verticesBuf.hasRemaining()) vertices.pushDouble(verticesBuf.get().toDouble())

    val uvs = Arguments.createArray()
    uvsBuf.rewind()
    while (uvsBuf.hasRemaining()) uvs.pushDouble(uvsBuf.get().toDouble())

    val indices = Arguments.createArray()
    indicesBuf.rewind()
    while (indicesBuf.hasRemaining()) indices.pushInt(indicesBuf.get().toInt())

    val result = Arguments.createMap()
    result.putArray("vertices", vertices)
    result.putArray("uvs", uvs)
    result.putArray("triangleIndices", indices)
    result.putInt("vertexCount", verticesBuf.capacity() / 3)
    result.putInt("triangleCount", indicesBuf.capacity() / 3)
    result.putString("source", "arcore-augmented-faces")
    promise.resolve(result)
  }

  @ReactMethod
  fun capturePhoto(promise: Promise) {
    val frame = FaceScannerState.latestFrame
    if (frame == null) {
      promise.reject("NO_FRAME", "No camera frame available.")
      return
    }
    val jpegBytes = FaceScannerGLRenderer.frameToJpegBytes(frame)
    if (jpegBytes == null) {
      promise.reject("ENCODE_FAILED", "Could not encode captured frame.")
      return
    }
    try {
      val file = File(reactContext.cacheDir, "face-scan-${UUID.randomUUID()}.jpg")
      FileOutputStream(file).use { it.write(jpegBytes) }
      promise.resolve("file://${file.absolutePath}")
    } catch (e: Exception) {
      promise.reject("WRITE_FAILED", "Could not write captured frame to disk.", e)
    }
  }

  @ReactMethod
  fun checkLastCaptureQuality(promise: Promise) {
    val frame = FaceScannerState.latestFrame
    if (frame == null) {
      promise.reject("NO_FRAME", "No camera frame available.")
      return
    }
    val (blurOk, lightingOk, reason) = FaceScannerGLRenderer.computeQualityFromFrame(frame)
    val result = Arguments.createMap()
    result.putBoolean("ok", blurOk && lightingOk)
    result.putBoolean("blurOk", blurOk)
    result.putBoolean("lightingOk", lightingOk)
    result.putString("reason", reason)
    promise.resolve(result)
  }
}
