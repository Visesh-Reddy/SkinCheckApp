import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { RegionStats, scoreColor, scoreZone } from '../logic/skinScoring';

// NOTE: region-based pixel sampling (forehead/cheeks/nose/etc.) is not yet
// implemented in the native modules — this screen expects already-computed
// RegionStats per zone as a prop. To finish this, add one more native
// method to both FaceScannerModule implementations following the exact
// pattern already used in checkLastCaptureQuality() (average color + local
// variance), but parameterized by a normalized region box per zone instead
// of the whole frame. The scoring math below is already ported and tested.

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

interface Props {
  zoneStats: Record<string, RegionStats>;
  age: number | null;
}

export function ResultsScreen({ zoneStats, age }: Props) {
  const scored = useMemo(() => {
    const brightest = Math.max(...Object.values(zoneStats).map((s) => s.avgLum));
    return Object.entries(zoneStats).map(([key, stats]) => ({
      key,
      ...scoreZone(stats, brightest, age),
    }));
  }, [zoneStats, age]);

  const overall = Math.round(scored.reduce((sum, z) => sum + z.score, 0) / scored.length);
  const overallColor = scoreColor(overall);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.overallCard}>
        <Text style={[styles.overallScore, { color: overallColor.text }]}>{overall}</Text>
        <Text style={styles.overallLabel}>overall skin score</Text>
      </View>

      <View style={styles.card}>
        {scored.map(({ key, score, issue }) => {
          const colors = scoreColor(score);
          return (
            <View key={key} style={styles.zoneRow}>
              <View style={styles.zoneText}>
                <Text style={styles.zoneName}>{ZONE_LABELS[key] ?? key}</Text>
                <Text style={styles.zoneIssue}>{ISSUE_LABELS[issue]}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.scoreBadgeText, { color: colors.text }]}>{score}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF1F0' },
  content: { padding: 16 },
  overallCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16 },
  overallScore: { fontSize: 40, fontWeight: '700' },
  overallLabel: { color: '#5C6B67', fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF1EF',
  },
  zoneText: { flex: 1 },
  zoneName: { fontSize: 14, fontWeight: '600', color: '#1F2A28' },
  zoneIssue: { fontSize: 12, color: '#5C6B67' },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  scoreBadgeText: { fontWeight: '600', fontSize: 15 },
});
