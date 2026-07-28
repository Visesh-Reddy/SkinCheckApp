package com.skincheck.facescanner;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import org.json.JSONArray;
import org.json.JSONException;

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
  // size -- avoids needing extra file I/O just to hand data across the bridge.
  @ReactProp(name = "verticesJson")
  public void setVerticesJson(FaceMeshViewerView view, String json) {
    pendingVerticesJson = json;
    tryLoadMesh(view);
  }

  @ReactProp(name = "uvsJson")
  public void setUvsJson(FaceMeshViewerView view, String json) {
    pendingUvsJson = json;
    tryLoadMesh(view);
  }

  @ReactProp(name = "indicesJson")
  public void setIndicesJson(FaceMeshViewerView view, String json) {
    pendingIndicesJson = json;
    tryLoadMesh(view);
  }

  @ReactProp(name = "photoPath")
  public void setPhotoPath(FaceMeshViewerView view, String path) {
    if (path != null) {
      String cleaned = path.startsWith("file://") ? path.substring(7) : path;
      view.loadTexture(cleaned);
    }
  }

  // Simple per-manager-instance staging (RN creates one manager instance
  // per view type, shared across view instances of that type -- fine here
  // since props for a given view arrive together in one commit in practice).
  private String pendingVerticesJson, pendingUvsJson, pendingIndicesJson;

  private void tryLoadMesh(FaceMeshViewerView view) {
    if (pendingVerticesJson == null || pendingUvsJson == null || pendingIndicesJson == null) return;
    try {
      float[] vertices = jsonToFloatArray(pendingVerticesJson);
      float[] uvs = jsonToFloatArray(pendingUvsJson);
      short[] indices = jsonToShortArray(pendingIndicesJson);
      view.loadMesh(vertices, uvs, indices);
    } catch (JSONException e) {
      // Malformed mesh JSON -- view simply won't render a mesh; the JS
      // side should treat a screen with no visible model as a soft failure.
    }
  }

  private static float[] jsonToFloatArray(String json) throws JSONException {
    JSONArray arr = new JSONArray(json);
    float[] out = new float[arr.length()];
    for (int i = 0; i < arr.length(); i++) out[i] = (float) arr.getDouble(i);
    return out;
  }

  private static short[] jsonToShortArray(String json) throws JSONException {
    JSONArray arr = new JSONArray(json);
    short[] out = new short[arr.length()];
    for (int i = 0; i < arr.length(); i++) out[i] = (short) arr.getInt(i);
    return out;
  }
}
