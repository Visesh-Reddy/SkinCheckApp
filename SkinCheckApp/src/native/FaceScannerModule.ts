import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { FacePose, QualityCheckResult } from '../types/FaceScan.types';

// Both native modules (ios/FaceScannerModule.swift and
// android/.../FaceScannerModule.kt) implement this exact same method set,
// so everything below this line is 100% cross-platform — the only
// platform-specific piece is HOW pose updates arrive (see
// FaceScannerCameraView.tsx for why).
const { FaceScannerModule: NativeFaceScanner } = NativeModules;

export async function isFaceScanSupported(): Promise<boolean> {
  if (!NativeFaceScanner) return false;
  return NativeFaceScanner.isSupported();
}

export async function startFaceScanSession(): Promise<void> {
  return NativeFaceScanner.startSession();
}

export async function stopFaceScanSession(): Promise<void> {
  return NativeFaceScanner.stopSession();
}

export async function capturePhoto(): Promise<string> {
  return NativeFaceScanner.capturePhoto();
}

export async function deletePhoto(photoUri: string): Promise<void> {
  return NativeFaceScanner.deletePhoto(photoUri);
}

// Photos are encrypted at rest (see PhotoCipher.java) -- React Native's
// <Image> can't load the raw file directly since it's ciphertext, not valid
// JPEG data on disk. This decrypts in memory and returns a base64 string
// for the JS side to wrap in a data: URI; the decrypted bytes are never
// written back to disk.
export async function getPhotoBase64(photoUri: string): Promise<string> {
  return NativeFaceScanner.getPhotoBase64(photoUri);
}

export async function checkLastCaptureQuality(): Promise<QualityCheckResult> {
  return NativeFaceScanner.checkLastCaptureQuality();
}

export async function sampleFaceRegions(photoUri: string): Promise<Record<string, import('../logic/skinScoring').RegionStats>> {
  return NativeFaceScanner.sampleFaceRegions(photoUri);
}

// --- Pose updates ---
// iOS: ARSession can run headless, so FaceScannerModule.swift emits a
//   global 'FaceScannerPose' event via RCTEventEmitter — no view required.
// Android: ARCore's Session.update() requires a bound GL texture (see
//   FaceScannerGLRenderer.kt's architectural note), so pose events instead
//   come from the mounted <FaceScannerCameraView /> component's
//   onPoseUpdate prop. subscribeToPose() below only covers the iOS path;
//   on Android, wire the camera view's onPoseUpdate prop directly in
//   ScanScreen.tsx instead (see that file for the platform branch).
let iosEmitter: NativeEventEmitter | null = null;

export function subscribeToPoseIOS(callback: (pose: FacePose) => void): () => void {
  if (Platform.OS !== 'ios') {
    return () => {};
  }
  if (!iosEmitter) {
    iosEmitter = new NativeEventEmitter(NativeFaceScanner);
  }
  const sub = iosEmitter.addListener('FaceScannerPose', callback);
  return () => sub.remove();
}
