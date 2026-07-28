package com.skincheck.facescanner

import android.content.Context
import android.opengl.GLSurfaceView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

// The RN scan screen must mount this view (even at 1x1 size behind the
// visible camera preview) for ARCore's session to run at all — see the
// architectural note in FaceScannerGLRenderer.kt.
class FaceScannerCameraView(context: Context) : GLSurfaceView(context) {

  private val glRenderer: FaceScannerGLRenderer = FaceScannerGLRenderer(context)

  init {
    setEGLContextClientVersion(2)
    setRenderer(glRenderer)
    renderMode = RENDERMODE_CONTINUOUSLY

    glRenderer.poseListener = { yaw, pitch, roll, tracking ->
      val reactContext = context as? ReactContext
      reactContext?.let {
        val payload = Arguments.createMap().apply {
          putDouble("yaw", yaw.toDouble())
          putDouble("pitch", pitch.toDouble())
          putDouble("roll", roll.toDouble())
          putString("trackingState", if (tracking) "tracking" else "none")
        }
        it.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onPoseUpdate", payload)
      }
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    glRenderer.pause()
  }

  fun teardown() {
    glRenderer.destroy()
  }
}
