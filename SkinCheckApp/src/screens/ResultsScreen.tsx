import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RegionStats, scoreColor, scoreZone } from '../logic/skinScoring';
import { colors, gradients, radius, spacing, typography, shadow } from '../theme';

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
  hasMesh?: boolean;
  onViewMesh?: () => void;
}

export function ResultsScreen({ zoneStats, age, hasMesh, onViewMesh }: Props) {
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
        <Text style={styles.emptyTitle}>Analyzing your scan...</Text>
        <Text style={styles.emptyBody}>
          If this doesn't resolve, the scan may need to be retaken with better lighting.
        </Text>
      </View>
    );
  }

  const overall = Math.round(scored.reduce((sum, z) => sum + z.score, 0) / scored.length);
  const overallColor = scoreColor(overall);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.overallCard}>
        <Text style={styles.overallLabel}>OVERALL SKIN SCORE</Text>
        <Text style={[styles.overallScore, { color: overallColor.text }]}>{overall}</Text>
        <View style={[styles.overallPill, { backgroundColor: overallColor.bg }]}>
          <Text style={[styles.overallPillText, { color: overallColor.text }]}>
            {overall > 80 ? 'Glowing' : overall > 60 ? 'Good' : overall > 40 ? 'Fair' : overall > 20 ? 'Needs some care' : 'Needs care'}
          </Text>
        </View>
      </View>

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

      {hasMesh && onViewMesh && (
        <Pressable onPress={onViewMesh} style={({ pressed }) => [{ marginTop: spacing.md }, pressed && { opacity: 0.85 }]}>
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.meshButton}
          >
            <Text style={styles.meshButtonText}>View your 3D face model →</Text>
          </LinearGradient>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  emptyContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyTitle: { ...typography.title, color: colors.textPrimary },
  emptyBody: { color: colors.textSecondary, textAlign: 'center', fontSize: 13.5, lineHeight: 20 },
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
    ...shadow.card,
  },
  cardHeading: { ...typography.title, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm },
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
  meshButton: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow.card,
  },
  meshButtonText: { color: '#001410', fontWeight: '800', fontSize: 15 },
});
