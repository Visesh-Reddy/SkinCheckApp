import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanRecord } from '../types/FaceScan.types';
import { deletePhoto } from './FaceScannerModule';

const STORAGE_KEY = 'skincheck_scan_history_v1';

// Keep a generous buffer beyond a year -- plenty for month-over-month
// comparisons -- so history and photo files don't accumulate forever with
// daily use over months/years.
const RETENTION_DAYS = 400;

export async function saveScanRecord(record: ScanRecord): Promise<void> {
  const existing = await getAllScanRecords();
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const kept: ScanRecord[] = [];
  const expired: ScanRecord[] = [];
  for (const r of existing) {
    if (new Date(r.dateIso).getTime() >= cutoffMs) kept.push(r);
    else expired.push(r);
  }

  const updated = [...kept, record];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // Best-effort cleanup of photo files for pruned records -- doesn't block
  // or fail the save if an individual delete has trouble.
  for (const r of expired) {
    deletePhoto(r.photoUri).catch(() => {});
  }
}

export async function getAllScanRecords(): Promise<ScanRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function deleteAllScanRecords(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// --- Progress comparison (pure logic, unit-tested against synthetic
// records before being wired into the UI — see the isolated test run in
// project history). ---

export interface ProgressComparison {
  label: string;
  currentAvg: number | null;
  previousAvg: number | null;
  delta: number | null; // currentAvg - previousAvg; positive = score improved
}

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function averageScoreInRange(records: ScanRecord[], startMs: number, endMs: number): number | null {
  const inRange = records.filter((r) => {
    const t = new Date(r.dateIso).getTime();
    return t >= startMs && t < endMs;
  });
  if (inRange.length === 0) return null;
  return Math.round(inRange.reduce((sum, r) => sum + r.overallScore, 0) / inRange.length);
}

function deltaOf(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

export interface ProgressSummary {
  daily: ProgressComparison;
  weekly: ProgressComparison;
  monthly: ProgressComparison;
}

export function computeProgress(records: ScanRecord[], now: Date = new Date()): ProgressSummary {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = startOfDay(now).getTime();
  const todayEnd = todayStart + dayMs;
  const yesterdayStart = todayStart - dayMs;

  const weekStart = todayStart - 6 * dayMs; // trailing 7-day window including today
  const prevWeekStart = weekStart - 7 * dayMs;

  const monthStart = todayStart - 29 * dayMs; // trailing 30-day window including today
  const prevMonthStart = monthStart - 30 * dayMs;

  const daily: ProgressComparison = {
    label: 'vs yesterday',
    currentAvg: averageScoreInRange(records, todayStart, todayEnd),
    previousAvg: averageScoreInRange(records, yesterdayStart, todayStart),
    delta: null,
  };
  daily.delta = deltaOf(daily.currentAvg, daily.previousAvg);

  const weekly: ProgressComparison = {
    label: 'vs last week',
    currentAvg: averageScoreInRange(records, weekStart, todayEnd),
    previousAvg: averageScoreInRange(records, prevWeekStart, weekStart),
    delta: null,
  };
  weekly.delta = deltaOf(weekly.currentAvg, weekly.previousAvg);

  const monthly: ProgressComparison = {
    label: 'vs last month',
    currentAvg: averageScoreInRange(records, monthStart, todayEnd),
    previousAvg: averageScoreInRange(records, prevMonthStart, monthStart),
    delta: null,
  };
  monthly.delta = deltaOf(monthly.currentAvg, monthly.previousAvg);

  return { daily, weekly, monthly };
}
