package com.skincheck.facescanner;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;

import java.util.Map;

public class FaceScannerViewManager extends SimpleViewManager<FaceScannerCameraView> {

  private final ReactApplicationContext reactContext;

  public FaceScannerViewManager(ReactApplicationContext reactContext) {
    this.reactContext = reactContext;
  }

  @NonNull
  @Override
  public String getName() {
    return "FaceScannerCameraView";
  }

  @NonNull
  @Override
  protected FaceScannerCameraView createViewInstance(@NonNull ThemedReactContext context) {
    return new FaceScannerCameraView(context);
  }

  @Override
  public void onDropViewInstance(@NonNull FaceScannerCameraView view) {
    view.teardown();
    super.onDropViewInstance(view);
  }

  // Emits: onPoseUpdate -> { yaw, pitch, roll, trackingState }
  @Override
  public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    return MapBuilder.<String, Object>of(
      "onPoseUpdate", MapBuilder.of("registrationName", "onPoseUpdate")
    );
  }
}
