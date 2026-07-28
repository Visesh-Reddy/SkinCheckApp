// Shared contract between the JS layer and BOTH native modules
// (iOS ARKit/TrueDepth and Android ARCore Augmented Faces).
// Each native module must emit/return data in exactly this shape so the
// rest of the app (UI, scoring, mesh viewer) never needs to know which
// platform it's running on.

export interface FacePose {
  yaw: number; // degrees, positive = turned right (device-calibrated, see native code comments)
  pitch: number; // degrees, positive = tilted up
  roll: number; // degrees
  trackingState: 'tracking' | 'limited' | 'none';
}

export interface QualityCheckResult {
  ok: boolean;
  blurOk: boolean;
  lightingOk: boolean;
  framingOk: boolean;
  reason?: 'blur' | 'dark' | 'bright' | 'off-center' | 'none';
}

export interface CaptureResult {
  photoUri: string; // local file:// URI, never uploaded
  quality: QualityCheckResult;
}

export type ScanStepKey = 'straight' | 'left' | 'right';

export interface PoseTarget {
  yaw: number;
  pitch: number;
  yawTol: number;
  pitchTol: number;
}

// A single saved scan, stored locally on-device for progress tracking over
// time. Never leaves the device -- see scanHistory.ts.
export interface ScanRecord {
  id: string;
  dateIso: string; // ISO 8601 timestamp of when the scan was taken
  overallScore: number;
  zoneScores: Record<string, number>; // zone key -> score, for per-zone trend if needed later
  photoUri: string; // local file:// URI of the straight-face capture
  age: number | null;
}
