package com.skincheck.facescanner;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Frame;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class FaceScannerModule extends ReactContextBaseJavaModule {

  private final ReactApplicationContext reactContext;

  public FaceScannerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @NonNull
  @Override
  public String getName() {
    return "FaceScannerModule";
  }

  @ReactMethod
  public void isSupported(Promise promise) {
    ArCoreApk.Availability availability = ArCoreApk.getInstance().checkAvailability(reactContext);
    promise.resolve(availability.isSupported());
  }

  // Session lifecycle is actually driven by FaceScannerCameraView mounting/
  // unmounting (see architectural note in FaceScannerGLRenderer.java) --
  // these two methods exist to match the shared JS contract with iOS, and
  // mostly just confirm state for the caller.
  @ReactMethod
  public void startSession(Promise promise) {
    if (FaceScannerGLRenderer.FaceScannerState.session != null) {
      promise.resolve(null);
    } else {
      promise.reject("NOT_STARTED", "Mount <FaceScannerCameraView /> first -- it owns the ARCore session.");
    }
  }

  @ReactMethod
  public void stopSession(Promise promise) {
    if (FaceScannerGLRenderer.FaceScannerState.session != null) {
      FaceScannerGLRenderer.FaceScannerState.session.pause();
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void capturePhoto(Promise promise) {
    Frame frame = FaceScannerGLRenderer.FaceScannerState.latestFrame;
    if (frame == null) {
      promise.reject("NO_FRAME", "No camera frame available.");
      return;
    }
    byte[] jpegBytes = FaceScannerGLRenderer.frameToJpegBytes(frame);
    if (jpegBytes == null) {
      promise.reject("ENCODE_FAILED", "Could not encode captured frame.");
      return;
    }
    try {
      // Internal files storage (not cache) -- cache directories can be
      // cleared by the OS under storage pressure at any time, which would
      // silently break the day/week/month progress tracking this photo is
      // being saved for.
      byte[] encrypted = PhotoCipher.encrypt(jpegBytes);
      File file = new File(reactContext.getFilesDir(), "face-scan-" + UUID.randomUUID() + ".enc");
      try (FileOutputStream fos = new FileOutputStream(file)) {
        fos.write(encrypted);
      }
      promise.resolve("file://" + file.getAbsolutePath());
    } catch (Exception e) {
      promise.reject("WRITE_FAILED", "Could not write captured frame to disk.", e);
    }
  }

  @ReactMethod
  public void deletePhoto(String photoUri, Promise promise) {
    try {
      String path = photoUri.replace("file://", "");
      File file = new File(path);
      if (file.exists()) {
        file.delete();
      }
      promise.resolve(null);
    } catch (Exception e) {
      // Not fatal -- a leftover file just wastes a little storage, doesn't
      // break app function. Resolve rather than reject so pruning old
      // history doesn't get interrupted by one bad path.
      promise.resolve(null);
    }
  }

  @ReactMethod
  public void checkLastCaptureQuality(Promise promise) {
    Frame frame = FaceScannerGLRenderer.FaceScannerState.latestFrame;
    if (frame == null) {
      promise.reject("NO_FRAME", "No camera frame available.");
      return;
    }
    FaceScannerGLRenderer.QualityResult quality = FaceScannerGLRenderer.computeQualityFromFrame(frame);
    WritableMap result = Arguments.createMap();
    result.putBoolean("ok", quality.blurOk && quality.lightingOk);
    result.putBoolean("blurOk", quality.blurOk);
    result.putBoolean("lightingOk", quality.lightingOk);
    result.putString("reason", quality.reason);
    promise.resolve(result);
  }

  // Fixed proportional face zones (forehead/cheeks/nose/etc), composed from
  // the same oval+zone proportions already tested in the web prototype.
  // This assumes the "straight" capture is reasonably face-centered, which
  // the pose-guided capture flow (yaw/pitch near zero to trigger a capture)
  // makes a fair assumption -- not perfect, but consistent with tested math
  // rather than an unverified 3D mesh-to-screen projection.
  private static final Map<String, float[]> ZONE_PROPORTIONS = new HashMap<>();
  static {
    ZONE_PROPORTIONS.put("forehead", new float[]{0.3040f, 0.1426f, 0.3920f, 0.1579f});
    ZONE_PROPORTIONS.put("leftTemple", new float[]{0.2312f, 0.2646f, 0.1008f, 0.1005f});
    ZONE_PROPORTIONS.put("rightTemple", new float[]{0.6680f, 0.2646f, 0.1008f, 0.1005f});
    ZONE_PROPORTIONS.put("leftCheek", new float[]{0.2424f, 0.4369f, 0.1456f, 0.1579f});
    ZONE_PROPORTIONS.put("rightCheek", new float[]{0.6120f, 0.4369f, 0.1456f, 0.1579f});
    ZONE_PROPORTIONS.put("nose", new float[]{0.4440f, 0.3723f, 0.1120f, 0.2154f});
    ZONE_PROPORTIONS.put("lips", new float[]{0.4104f, 0.6236f, 0.1792f, 0.0790f});
    ZONE_PROPORTIONS.put("chin", new float[]{0.3880f, 0.7169f, 0.2240f, 0.1005f});
  }

  @ReactMethod
  public void sampleFaceRegions(String photoUri, Promise promise) {
    Bitmap bitmap = null;
    try {
      String path = photoUri.replace("file://", "");
      byte[] decrypted = readAndDecryptFile(path);
      bitmap = BitmapFactory.decodeByteArray(decrypted, 0, decrypted.length);
      if (bitmap == null) {
        promise.reject("DECODE_FAILED", "Could not decode captured photo.");
        return;
      }

      WritableMap result = Arguments.createMap();
      int bw = bitmap.getWidth();
      int bh = bitmap.getHeight();

      for (Map.Entry<String, float[]> entry : ZONE_PROPORTIONS.entrySet()) {
        float[] p = entry.getValue();
        int x = clampInt((int) (p[0] * bw), 0, bw - 1);
        int y = clampInt((int) (p[1] * bh), 0, bh - 1);
        int w = Math.max(2, Math.min((int) (p[2] * bw), bw - x));
        int h = Math.max(2, Math.min((int) (p[3] * bh), bh - y));

        RegionStats stats = computeRegionStats(bitmap, x, y, w, h);
        WritableMap statsMap = Arguments.createMap();
        statsMap.putDouble("avgR", stats.avgR);
        statsMap.putDouble("avgG", stats.avgG);
        statsMap.putDouble("avgB", stats.avgB);
        statsMap.putDouble("avgLum", stats.avgLum);
        statsMap.putDouble("variance", stats.variance);
        result.putMap(entry.getKey(), statsMap);
      }
      promise.resolve(result);
    } catch (Exception e) {
      promise.reject("SAMPLE_FAILED", "Could not sample face regions.", e);
    } finally {
      if (bitmap != null) bitmap.recycle();
    }
  }

  private static int clampInt(int v, int min, int max) {
    return Math.max(min, Math.min(max, v));
  }

  private static class RegionStats {
    double avgR, avgG, avgB, avgLum, variance;
  }

  // Same redness/luminance/variance math as the web prototype's
  // regionStats() and skinScoring.ts's RegionStats input -- keep in sync.
  private static RegionStats computeRegionStats(Bitmap bitmap, int x, int y, int w, int h) {
    RegionStats stats = new RegionStats();
    int step = Math.max(1, Math.min(w, h) / 30); // downsample for performance
    double sumR = 0, sumG = 0, sumB = 0, lumSum = 0;
    int count = 0;
    double[] lums = new double[((w / step) + 1) * ((h / step) + 1)];
    int lumIdx = 0;

    for (int dy = 0; dy < h; dy += step) {
      for (int dx = 0; dx < w; dx += step) {
        int px = bitmap.getPixel(x + dx, y + dy);
        int r = (px >> 16) & 0xFF;
        int g = (px >> 8) & 0xFF;
        int b = px & 0xFF;
        sumR += r; sumG += g; sumB += b;
        double lum = 0.299 * r + 0.587 * g + 0.114 * b;
        lumSum += lum;
        if (lumIdx < lums.length) lums[lumIdx++] = lum;
        count++;
      }
    }

    if (count == 0) {
      stats.avgR = 0; stats.avgG = 0; stats.avgB = 0; stats.avgLum = 0; stats.variance = 0;
      return stats;
    }

    stats.avgR = sumR / count;
    stats.avgG = sumG / count;
    stats.avgB = sumB / count;
    stats.avgLum = lumSum / count;

    double varSum = 0;
    for (int i = 0; i < lumIdx; i++) {
      double diff = lums[i] - stats.avgLum;
      varSum += diff * diff;
    }
    stats.variance = Math.sqrt(varSum / lumIdx);
    return stats;
  }

  // Reads an encrypted photo file from disk and decrypts it, returning raw
  // JPEG bytes ready to decode. Centralizes the "read file -> decrypt"
  // sequence so both sampleFaceRegions and getPhotoBase64 use exactly the
  // same logic rather than duplicating it.
  private static byte[] readAndDecryptFile(String path) throws Exception {
    File file = new File(path);
    byte[] encrypted = new byte[(int) file.length()];
    try (FileInputStream fis = new FileInputStream(file)) {
      int read = 0;
      while (read < encrypted.length) {
        int n = fis.read(encrypted, read, encrypted.length - read);
        if (n == -1) break;
        read += n;
      }
    }
    return PhotoCipher.decrypt(encrypted);
  }

  // Photos are stored encrypted at rest, so React Native's <Image> component
  // can't load the file directly (it's ciphertext, not valid JPEG data on
  // disk). This decrypts in memory and returns a base64 string the JS side
  // wraps in a `data:image/jpeg;base64,...` URI instead -- the decrypted
  // bytes are never written back to disk.
  @ReactMethod
  public void getPhotoBase64(String photoUri, Promise promise) {
    try {
      String path = photoUri.replace("file://", "");
      byte[] decrypted = readAndDecryptFile(path);
      String base64 = Base64.encodeToString(decrypted, Base64.NO_WRAP);
      promise.resolve(base64);
    } catch (Exception e) {
      promise.reject("DECRYPT_FAILED", "Could not decrypt photo for display.", e);
    }
  }
}
