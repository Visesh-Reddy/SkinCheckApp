package com.skincheck.facescanner;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.opengl.GLSurfaceView;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;

public class FaceMeshViewerView extends GLSurfaceView {

  private final FaceMeshViewerRenderer renderer;
  private final ScaleGestureDetector scaleDetector;
  private float lastTouchX, lastTouchY;
  private static final float ROTATE_SENSITIVITY = 0.4f;
  private static final float MIN_DISTANCE = 0.15f;
  private static final float MAX_DISTANCE = 0.8f;

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

  public void loadMesh(float[] vertices, float[] uvs, short[] indices) {
    renderer.setMesh(vertices, uvs, indices);
  }

  public void loadTexture(String photoPath) {
    Bitmap bitmap = BitmapFactory.decodeFile(photoPath);
    if (bitmap != null) {
      renderer.setTextureBitmap(bitmap);
    }
  }
}
