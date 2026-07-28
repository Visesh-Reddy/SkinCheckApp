package com.skincheck.facescanner

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class FaceScannerViewManager(private val reactContext: ReactApplicationContext) :
  SimpleViewManager<FaceScannerCameraView>() {

  override fun getName() = "FaceScannerCameraView"

  override fun createViewInstance(context: ThemedReactContext): FaceScannerCameraView {
    return FaceScannerCameraView(context)
  }

  override fun onDropViewInstance(view: FaceScannerCameraView) {
    view.teardown()
    super.onDropViewInstance(view)
  }

  // Emits: onPoseUpdate -> { yaw, pitch, roll, trackingState }
  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
    return MapBuilder.of("onPoseUpdate", MapBuilder.of("registrationName", "onPoseUpdate"))
  }
}
