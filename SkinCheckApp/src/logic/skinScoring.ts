// Ported directly from the browser prototype's computeZoneScores/scoreColor.
// This part is platform-agnostic: it just takes already-computed region pixel
// stats (from whichever native module captured them) and turns them into a
// score + issue label. The stats themselves (avgR/avgG/avgB/avgLum/variance)
// are computed natively per-platform for performance — see
// ios/FaceScannerModule.swift and android/.../FaceScannerModule.kt.

export interface RegionStats {
  avgR: number;
  avgG: number;
  avgB: number;
  avgLum: number;
  variance: number;
}

export interface ZoneScoreResult {
  score: number;
  issue: 'healthy' | 'redness' | 'texture' | 'tan';
}

export function varianceToleranceForAge(age: number | null): number {
  if (age === null) return 35;
  if (age < 20) return 30;
  if (age <= 35) return 35;
  if (age <= 50) return 42;
  return 50;
}

export function scoreZone(
  stats: RegionStats,
  brightestLumAcrossZones: number,
  age: number | null
): ZoneScoreResult {
  const varianceTolerance = varianceToleranceForAge(age);

  const rednessRaw = stats.avgR - (stats.avgG + stats.avgB) / 2;
  const rednessNorm = Math.max(0, Math.min(1, rednessRaw / 25));

  const varianceNorm = Math.max(0, Math.min(1, stats.variance / varianceTolerance));

  const tanDeviation =
    brightestLumAcrossZones > 0
      ? Math.max(0, (brightestLumAcrossZones - stats.avgLum) / brightestLumAcrossZones)
      : 0;
  const tanNorm = Math.max(0, Math.min(1, tanDeviation / 0.35));

  const penalty = (rednessNorm * 0.4 + varianceNorm * 0.35 + tanNorm * 0.25) * 100;
  const score = Math.max(10, Math.round(100 - penalty));

  let issue: ZoneScoreResult['issue'] = 'healthy';
  const top = Math.max(rednessNorm, varianceNorm, tanNorm);
  if (top > 0.3) {
    if (top === rednessNorm) issue = 'redness';
    else if (top === varianceNorm) issue = 'texture';
    else issue = 'tan';
  }

  return { score, issue };
}

export function scoreColor(score: number): { text: string; bg: string } {
  if (score <= 20) return { text: '#B23A2E', bg: '#FBEAE7' };
  if (score <= 40) return { text: '#C2542E', bg: '#FCEEE7' };
  if (score <= 60) return { text: '#B0651E', bg: '#FCF1E4' };
  if (score <= 80) return { text: '#6B8A2E', bg: '#EFF5E2' };
  return { text: '#3E7C6B', bg: '#E3F0EB' };
}
