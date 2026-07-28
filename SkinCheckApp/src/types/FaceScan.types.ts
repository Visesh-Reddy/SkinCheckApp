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

export interface FaceMeshData {
  // Flat Float32-compatible arrays, ready to hand to a BufferGeometry.
  vertices: number[]; // [x0,y0,z0, x1,y1,z1, ...] in meters, face-local space
  uvs: number[]; // [u0,v0, u1,v1, ...]
  triangleIndices: number[]; // flat index triplets
  vertexCount: number;
  triangleCount: number;
  source: 'arkit-truedepth' | 'arcore-augmented-faces';
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
  mesh: FaceMeshData | null; // null if mesh capture failed but photo succeeded
  quality: QualityCheckResult;
}

export type ScanStepKey = 'straight' | 'left' | 'right' | 'top' | 'bottom';

export interface PoseTarget {
  yaw: number;
  pitch: number;
  yawTol: number;
  pitchTol: number;
}
