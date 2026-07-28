import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, gradients, radius, spacing, typography, shadow } from '../theme';

interface Props {
  onContinue: (age: number | null) => void;
}

export function AgeScreen({ onContinue }: Props) {
  const [ageText, setAgeText] = useState('');

  const handleContinue = () => {
    const parsed = parseInt(ageText, 10);
    const age = !isNaN(parsed) && parsed >= 10 && parsed <= 100 ? parsed : null;
    onContinue(age);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SKIN CHECK</Text>
      <Text style={styles.title}>Let's get started</Text>
      <Text style={styles.subtitle}>
        Sharing your age helps tune scoring and suggestions to your skin's natural changes over time.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Your age (optional)</Text>
        <TextInput
          value={ageText}
          onChangeText={setAgeText}
          placeholder="e.g. 28"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={styles.input}
          autoFocus
        />
      </View>

      <Pressable onPress={handleContinue} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => onContinue(null)} style={styles.skipLink}>
        <Text style={styles.skipLinkText}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xl, flexGrow: 1 },
  eyebrow: { color: colors.accentStart, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  cardLabel: { ...typography.title, fontSize: 14, color: colors.textPrimary, marginBottom: 10 },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: { borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', ...shadow.card },
  buttonText: { color: '#001410', fontWeight: '800', fontSize: 16 },
  skipLink: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  skipLinkText: { color: colors.textMuted, fontSize: 13.5, fontWeight: '600' },
});
