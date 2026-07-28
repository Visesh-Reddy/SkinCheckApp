import { PoseTarget, ScanStepKey } from '../types/FaceScan.types';

// Same target angles used (and hold-timer-tested) in the web prototype.
export const POSE_TARGETS: Record<ScanStepKey, PoseTarget> = {
  straight: { yaw: 0, pitch: 0, yawTol: 10, pitchTol: 10 },
  left: { yaw: -22, pitch: 0, yawTol: 9, pitchTol: 12 },
  right: { yaw: 22, pitch: 0, yawTol: 9, pitchTol: 12 },
  top: { yaw: 0, pitch: 14, yawTol: 12, pitchTol: 8 },
  bottom: { yaw: 0, pitch: -14, yawTol: 12, pitchTol: 8 },
};

export const SCAN_STEPS: ScanStepKey[] = ['straight', 'left', 'right', 'top', 'bottom'];

export const HOLD_MS_REQUIRED = 600;

export function isAligned(step: ScanStepKey, yaw: number, pitch: number): boolean {
  const t = POSE_TARGETS[step];
  return Math.abs(yaw - t.yaw) <= t.yawTol && Math.abs(pitch - t.pitch) <= t.pitchTol;
}
