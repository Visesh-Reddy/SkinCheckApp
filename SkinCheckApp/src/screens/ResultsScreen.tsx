import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { RegionStats, scoreColor, scoreZone } from '../logic/skinScoring';
import { computeProgress, getAllScanRecords, ProgressComparison } from '../native/scanHistory';
import { colors, radius, spacing, typography, shadow } from '../theme';

const ZONE_LABELS: Record<string, string> = {
  forehead: 'Forehead',
  leftTemple: 'Left temple',
  rightTemple: 'Right temple',
  leftCheek: 'Left cheek',
  rightCheek: 'Right cheek',
  nose: 'Nose',
  lips: 'Lips',
  chin: 'Chin',
};

const ISSUE_LABELS: Record<string, string> = {
  healthy: 'Looking healthy',
  redness: 'Redness / breakout-prone',
  texture: 'Uneven texture',
  tan: 'Tan / uneven tone',
};

const ISSUE_DOT: Record<string, string> = {
  healthy: colors.accentStart,
  redness: '#FF6B6B',
  texture: colors.warning,
  tan: '#B98BFF',
};

interface Props {
  zoneStats: Record<string, RegionStats>;
  age: number | null;
  photoUri: string;
  onScanAgain: () => void;
}

function ProgressRow({ comparison }: { comparison: ProgressComparison }) {
  const hasData = comparison.currentAvg !== null;
  const hasComparison = comparison.delta !== null;

  let deltaText = 'Not enough history yet';
  let deltaColor = colors.textMuted;
  if (hasComparison) {
    const d = comparison.delta!;
    if (d > 0) { deltaText = `+${d} improved`; deltaColor = colors.accentStart; }
    else if (d < 0) { deltaText = `${d} lower`; deltaColor = colors.danger; }
    else { deltaText = 'No change'; deltaColor = colors.textSecondary; }
  }

  return (
    <View style={styles.progressRow}>
      <Text style={styles.progressLabel}>{comparison.label}</Text>
      <View style={styles.progressValueWrap}>
        <Text style={styles.progressScore}>{hasData ? comparison.currentAvg : '—'}</Text>
        <Text style={[styles.progressDelta, { color: deltaColor }]}>{deltaText}</Text>
      </View>
    </View>
  );
}

export function ResultsScreen({ zoneStats, age, photoUri, onScanAgain }: Props) {
  const [progress, setProgress] = useState<ReturnType<typeof computeProgress> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllScanRecords().then((records) => {
      if (!cancelled) setProgress(computeProgress(records));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasData = Object.keys(zoneStats).length > 0;

  const scored = useMemo(() => {
    if (!hasData) return [];
    const brightest = Math.max(...Object.values(zoneStats).map((s) => s.avgLum));
    return Object.entries(zoneStats).map(([key, stats]) => ({
      key,
      ...scoreZone(stats, brightest, age),
    }));
  }, [zoneStats, age, hasData]);

  if (!hasData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Couldn't analyze this scan</Text>
        <Text style={styles.emptyBody}>
          Try retaking the scan with more even lighting and your face centered in frame.
        </Text>
        <Pressable onPress={onScanAgain} style={({ pressed }) => [styles.scanAgainButton, pressed && { opacity: 0.7 }]}>
          <Text style={styles.scanAgainText}>Scan again</Text>
        </Pressable>
      </View>
    );
  }

  const overall = Math.round(scored.reduce((sum, z) => sum + z.score, 0) / scored.length);
  const overallColor = scoreColor(overall);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.photoCard}>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      </View>

      <View style={styles.overallCard}>
        <Text style={styles.overallLabel}>OVERALL SKIN SCORE</Text>
        <Text style={[styles.overallScore, { color: overallColor.text }]}>{overall}</Text>
        <View style={[styles.overallPill, { backgroundColor: overallColor.bg }]}>
          <Text style={[styles.overallPillText, { color: overallColor.text }]}>
            {overall > 80 ? 'Glowing' : overall > 60 ? 'Good' : overall > 40 ? 'Fair' : overall > 20 ? 'Needs some care' : 'Needs care'}
          </Text>
        </View>
      </View>

      {progress && (
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Your progress</Text>
          <ProgressRow comparison={progress.daily} />
          <ProgressRow comparison={progress.weekly} />
          <ProgressRow comparison={progress.monthly} />
          <Text style={styles.progressNote}>
            Saved only on this device — used to track your trend over time.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardHeading}>By zone</Text>
        {scored.map(({ key, score, issue }) => {
          const colorSet = scoreColor(score);
          return (
            <View key={key} style={styles.zoneRow}>
              <View style={[styles.issueDot, { backgroundColor: ISSUE_DOT[issue] }]} />
              <View style={styles.zoneText}>
                <Text style={styles.zoneName}>{ZONE_LABELS[key] ?? key}</Text>
                <Text style={styles.zoneIssue}>{ISSUE_LABELS[issue]}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: colorSet.bg }]}>
                <Text style={[styles.scoreBadgeText, { color: colorSet.text }]}>{score}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Pressable onPress={onScanAgain} style={({ pressed }) => [styles.scanAgainButton, pressed && { opacity: 0.7 }]}>
        <Text style={styles.scanAgainText}>Scan again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  emptyContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyTitle: { ...typography.title, color: colors.textPrimary },
  emptyBody: { color: colors.textSecondary, textAlign: 'center', fontSize: 13.5, lineHeight: 20 },

  photoCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  photo: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surface },

  overallCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.card,
  },
  overallLabel: { ...typography.caption, color: colors.textMuted, letterSpacing: 1.2, marginBottom: 6 },
  overallScore: { fontSize: 52, fontWeight: '800', letterSpacing: -1 },
  overallPill: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.pill },
  overallPillText: { fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardHeading: { ...typography.title, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressLabel: { fontSize: 13.5, color: colors.textSecondary, fontWeight: '600' },
  progressValueWrap: { alignItems: 'flex-end' },
  progressScore: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  progressDelta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  progressNote: { fontSize: 11.5, color: colors.textMuted, marginTop: spacing.sm },

  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  issueDot: { width: 9, height: 9, borderRadius: 5 },
  zoneText: { flex: 1 },
  zoneName: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  zoneIssue: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.sm },
  scoreBadgeText: { fontWeight: '800', fontSize: 15 },
  scanAgainButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  scanAgainText: { color: colors.textPrimary, fontWeight: '700' },
});
