package com.skincheck.facescanner;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

public class FaceMeshViewerManager extends SimpleViewManager<FaceMeshViewerView> {

  private final ReactApplicationContext reactContext;

  public FaceMeshViewerManager(ReactApplicationContext reactContext) {
    this.reactContext = reactContext;
  }

  @NonNull
  @Override
  public String getName() {
    return "FaceMeshViewer";
  }

  @NonNull
  @Override
  protected FaceMeshViewerView createViewInstance(@NonNull ThemedReactContext context) {
    return new FaceMeshViewerView(context);
  }

  // Mesh data arrives as JSON-stringified arrays (a few KB for a 468-vertex
  // mesh) rather than a file, since that's simple and fast enough at this
  // size -- avoids needing extra file I/O just to hand data across the
  // bridge. Staging state for "all three props arrived" lives on the VIEW
  // itself (FaceMeshViewerView), not here -- this manager instance is
  // shared across every FaceMeshViewer on screen, so per-view state can't
  // live on the manager without leaking between instances.
  @ReactProp(name = "verticesJson")
  public void setVerticesJson(FaceMeshViewerView view, String json) {
    view.setVerticesJson(json);
  }

  @ReactProp(name = "uvsJson")
  public void setUvsJson(FaceMeshViewerView view, String json) {
    view.setUvsJson(json);
  }

  @ReactProp(name = "indicesJson")
  public void setIndicesJson(FaceMeshViewerView view, String json) {
    view.setIndicesJson(json);
  }

  @ReactProp(name = "photoPath")
  public void setPhotoPath(FaceMeshViewerView view, String path) {
    if (path != null) {
      String cleaned = path.startsWith("file://") ? path.substring(7) : path;
      view.loadTexture(cleaned);
    }
  }
}
