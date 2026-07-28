package com.skincheck.facescanner;

import android.graphics.Bitmap;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

// A minimal OpenGL ES 2.0 textured-mesh renderer -- built to avoid depending
// on expo-gl/@react-three/fiber, which require additional native "bare
// workflow" wiring (expo-modules-autolinking) not set up in this project and
// which caused real Metro bundling failures. This does the same job (show a
// rotating, zoomable textured face mesh) with zero extra native dependencies,
// using the same GLSurfaceView pattern already proven in
// FaceScannerGLRenderer.java.
public class FaceMeshViewerRenderer implements GLSurfaceView.Renderer {

  private static final String VERTEX_SHADER =
    "uniform mat4 uMVPMatrix;" +
    "attribute vec4 aPosition;" +
    "attribute vec2 aTexCoord;" +
    "varying vec2 vTexCoord;" +
    "void main() {" +
    "  gl_Position = uMVPMatrix * aPosition;" +
    "  vTexCoord = aTexCoord;" +
    "}";

  private static final String FRAGMENT_SHADER =
    "precision mediump float;" +
    "uniform sampler2D uTexture;" +
    "varying vec2 vTexCoord;" +
    "void main() {" +
    "  gl_FragColor = texture2D(uTexture, vTexCoord);" +
    "}";

  private FloatBuffer vertexBuffer;
  private FloatBuffer uvBuffer;
  private ShortBuffer indexBuffer;
  private int indexCount;
  private Bitmap pendingTextureBitmap;
  private int textureId = -1;
  private int program;
  private int aPositionHandle, aTexCoordHandle, uMVPMatrixHandle, uTextureHandle;

  private int surfaceWidth = 1, surfaceHeight = 1;

  // Public, touch-driven camera state (updated from FaceMeshViewerView).
  public volatile float rotationX = 0f;
  public volatile float rotationY = 0f;
  public volatile float distance = 0.35f; // meters -- matches ARCore's metric mesh scale

  public synchronized void setMesh(float[] vertices, float[] uvs, short[] indices) {
    ByteBuffer vb = ByteBuffer.allocateDirect(vertices.length * 4);
    vb.order(ByteOrder.nativeOrder());
    vertexBuffer = vb.asFloatBuffer();
    vertexBuffer.put(vertices).position(0);

    ByteBuffer ub = ByteBuffer.allocateDirect(uvs.length * 4);
    ub.order(ByteOrder.nativeOrder());
    uvBuffer = ub.asFloatBuffer();
    uvBuffer.put(uvs).position(0);

    ByteBuffer ib = ByteBuffer.allocateDirect(indices.length * 2);
    ib.order(ByteOrder.nativeOrder());
    indexBuffer = ib.asShortBuffer();
    indexBuffer.put(indices).position(0);
    indexCount = indices.length;
  }

  public synchronized void setTextureBitmap(Bitmap bitmap) {
    pendingTextureBitmap = bitmap;
  }

  @Override
  public void onSurfaceCreated(GL10 gl, EGLConfig config) {
    GLES20.glClearColor(0.08f, 0.09f, 0.13f, 1f); // matches app's dark surface color
    GLES20.glEnable(GLES20.GL_DEPTH_TEST);

    int vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER);
    int fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = GLES20.glCreateProgram();
    GLES20.glAttachShader(program, vertexShader);
    GLES20.glAttachShader(program, fragmentShader);
    GLES20.glLinkProgram(program);

    aPositionHandle = GLES20.glGetAttribLocation(program, "aPosition");
    aTexCoordHandle = GLES20.glGetAttribLocation(program, "aTexCoord");
    uMVPMatrixHandle = GLES20.glGetUniformLocation(program, "uMVPMatrix");
    uTextureHandle = GLES20.glGetUniformLocation(program, "uTexture");
  }

  @Override
  public void onSurfaceChanged(GL10 gl, int width, int height) {
    surfaceWidth = width;
    surfaceHeight = height;
    GLES20.glViewport(0, 0, width, height);
  }

  @Override
  public synchronized void onDrawFrame(GL10 gl) {
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);

    if (pendingTextureBitmap != null) {
      uploadTexture(pendingTextureBitmap);
      pendingTextureBitmap = null;
    }
    if (vertexBuffer == null || textureId == -1) return;

    GLES20.glUseProgram(program);

    float[] model = new float[16];
    Matrix.setIdentityM(model, 0);
    Matrix.rotateM(model, 0, rotationX, 1f, 0f, 0f);
    Matrix.rotateM(model, 0, rotationY, 0f, 1f, 0f);

    float[] view = new float[16];
    Matrix.setLookAtM(view, 0, 0f, 0f, distance, 0f, 0f, 0f, 0f, 1f, 0f);

    float[] projection = new float[16];
    float aspect = (float) surfaceWidth / surfaceHeight;
    Matrix.perspectiveM(projection, 0, 35f, aspect, 0.01f, 10f);

    float[] mv = new float[16];
    Matrix.multiplyMM(mv, 0, view, 0, model, 0);
    float[] mvp = new float[16];
    Matrix.multiplyMM(mvp, 0, projection, 0, mv, 0);

    GLES20.glUniformMatrix4fv(uMVPMatrixHandle, 1, false, mvp, 0);

    vertexBuffer.position(0);
    GLES20.glEnableVertexAttribArray(aPositionHandle);
    GLES20.glVertexAttribPointer(aPositionHandle, 3, GLES20.GL_FLOAT, false, 0, vertexBuffer);

    uvBuffer.position(0);
    GLES20.glEnableVertexAttribArray(aTexCoordHandle);
    GLES20.glVertexAttribPointer(aTexCoordHandle, 2, GLES20.GL_FLOAT, false, 0, uvBuffer);

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId);
    GLES20.glUniform1i(uTextureHandle, 0);

    indexBuffer.position(0);
    GLES20.glDrawElements(GLES20.GL_TRIANGLES, indexCount, GLES20.GL_UNSIGNED_SHORT, indexBuffer);

    GLES20.glDisableVertexAttribArray(aPositionHandle);
    GLES20.glDisableVertexAttribArray(aTexCoordHandle);
  }

  private void uploadTexture(Bitmap bitmap) {
    int[] textures = new int[1];
    GLES20.glGenTextures(1, textures, 0);
    textureId = textures[0];
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId);
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0);
    bitmap.recycle();
  }

  private int compileShader(int type, String source) {
    int shader = GLES20.glCreateShader(type);
    GLES20.glShaderSource(shader, source);
    GLES20.glCompileShader(shader);
    return shader;
  }
}
