package com.skincheck.facescanner;

import android.content.Context;
import android.opengl.GLSurfaceView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

// The RN scan screen must mount this view (even at 1x1 size behind the
// visible camera preview) for ARCore's session to run at all -- see the
// architectural note in FaceScannerGLRenderer.java.
public class FaceScannerCameraView extends GLSurfaceView {

  private final FaceScannerGLRenderer glRenderer;

  public FaceScannerCameraView(Context context) {
    super(context);
    glRenderer = new FaceScannerGLRenderer(context);

    setEGLContextClientVersion(2);
    setRenderer(glRenderer);
    setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);

    glRenderer.poseListener = (yaw, pitch, roll, tracking) -> {
      if (context instanceof ReactContext) {
        ReactContext reactContext = (ReactContext) context;
        WritableMap payload = Arguments.createMap();
        payload.putDouble("yaw", yaw);
        payload.putDouble("pitch", pitch);
        payload.putDouble("roll", roll);
        payload.putString("trackingState", tracking ? "tracking" : "none");
        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(getId(), "onPoseUpdate", payload);
      }
    };
  }

  @Override
  protected void onDetachedFromWindow() {
    super.onDetachedFromWindow();
    glRenderer.pause();
  }

  public void teardown() {
    glRenderer.destroy();
  }
}
