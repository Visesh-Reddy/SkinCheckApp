package com.skincheck.facescanner;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.opengl.GLSurfaceView;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;

import org.json.JSONArray;
import org.json.JSONException;

public class FaceMeshViewerView extends GLSurfaceView {

  private final FaceMeshViewerRenderer renderer;
  private final ScaleGestureDetector scaleDetector;
  private float lastTouchX, lastTouchY;
  private static final float ROTATE_SENSITIVITY = 0.4f;
  private static final float MIN_DISTANCE = 0.15f;
  private static final float MAX_DISTANCE = 0.8f;

  // Per-instance pending mesh JSON staging (deliberately NOT on the
  // ViewManager -- that's a single shared instance across all views of this
  // type, so state stored there would leak between separate mesh viewer
  // instances or across a remount with new data).
  private String pendingVerticesJson, pendingUvsJson, pendingIndicesJson;

  public FaceMeshViewerView(Context context) {
    super(context);
    setEGLContextClientVersion(2);
    renderer = new FaceMeshViewerRenderer();
    setRenderer(renderer);
    setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);

    scaleDetector = new ScaleGestureDetector(context, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
      @Override
      public boolean onScale(ScaleGestureDetector detector) {
        float newDistance = renderer.distance / detector.getScaleFactor();
        renderer.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, newDistance));
        return true;
      }
    });
  }

  @Override
  public boolean onTouchEvent(MotionEvent event) {
    scaleDetector.onTouchEvent(event);

    switch (event.getActionMasked()) {
      case MotionEvent.ACTION_DOWN:
        lastTouchX = event.getX();
        lastTouchY = event.getY();
        return true;
      case MotionEvent.ACTION_MOVE:
        if (!scaleDetector.isInProgress() && event.getPointerCount() == 1) {
          float dx = event.getX() - lastTouchX;
          float dy = event.getY() - lastTouchY;
          renderer.rotationY += dx * ROTATE_SENSITIVITY;
          renderer.rotationX += dy * ROTATE_SENSITIVITY;
          lastTouchX = event.getX();
          lastTouchY = event.getY();
        }
        return true;
      default:
        return true;
    }
  }

  public void setVerticesJson(String json) {
    pendingVerticesJson = json;
    tryLoadMesh();
  }

  public void setUvsJson(String json) {
    pendingUvsJson = json;
    tryLoadMesh();
  }

  public void setIndicesJson(String json) {
    pendingIndicesJson = json;
    tryLoadMesh();
  }

  private void tryLoadMesh() {
    if (pendingVerticesJson == null || pendingUvsJson == null || pendingIndicesJson == null) return;
    try {
      float[] vertices = jsonToFloatArray(pendingVerticesJson);
      float[] uvs = jsonToFloatArray(pendingUvsJson);
      short[] indices = jsonToShortArray(pendingIndicesJson);
      renderer.setMesh(vertices, uvs, indices);
    } catch (JSONException e) {
      // Malformed mesh JSON -- view simply won't render a mesh; the JS side
      // should treat a screen with no visible model as a soft failure.
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

  public void loadTexture(String photoPath) {
    Bitmap bitmap = BitmapFactory.decodeFile(photoPath);
    if (bitmap != null) {
      renderer.setTextureBitmap(bitmap);
    }
  }
}
