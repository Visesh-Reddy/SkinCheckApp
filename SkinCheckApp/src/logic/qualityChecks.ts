// Reference implementation of the quality-check math, ported from the
// browser prototype where it was tested against synthetic sharp/blurred/flat
// images (see project history). Native modules (Swift/Kotlin) implement this
// SAME formula directly against camera pixel buffers for performance — this
// file exists so both native implementations have one canonical spec to
// match, and so it's testable in isolation here.

export function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

// NOTE: this threshold (12) was tuned against synthetic test images in the
// browser prototype, on a heavily downsampled region. Real camera sensors
// (auto-exposure, noise floor, compression) behave differently — re-tune
// against real captures from ARKit/ARCore during device testing before
// shipping. Treat this as a starting point, not a final calibrated value.
export const BLUR_VARIANCE_THRESHOLD = 12;

export function checkBlur(gray: Float32Array, w: number, h: number): boolean {
  return laplacianVariance(gray, w, h) > BLUR_VARIANCE_THRESHOLD;
}

export function checkLighting(avgLuminance: number): { ok: boolean; reason?: 'dark' | 'bright' } {
  if (avgLuminance < 45) return { ok: false, reason: 'dark' };
  if (avgLuminance > 235) return { ok: false, reason: 'bright' };
  return { ok: true };
}

export function checkFraming(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  frameW: number,
  frameH: number,
  margin = 6
): boolean {
  return !(minX < margin || minY < margin || maxX > frameW - margin || maxY > frameH - margin);
}
