import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, gradients, radius, spacing, typography, shadow } from '../theme';

interface Props {
  onContinue: () => void;
}

const ITEMS = [
  {
    icon: '☀',
    title: 'Find even, bright light',
    body: 'Face a window or lamp — avoid strong backlight or deep shadows.',
  },
  {
    icon: '↻',
    title: "You'll turn your head slowly",
    body: 'Straight, left, right, then up and down. On-screen prompts guide each move.',
  },
  {
    icon: '🔒',
    title: 'Your scan stays on this device',
    body: 'Face tracking and the 3D model are processed on-device via ARCore. Nothing is uploaded.',
  },
  {
    icon: '📷',
    title: 'Camera access needed',
    body: "Your device will ask permission to use the camera. If it's denied, scanning can't proceed.",
  },
];

export function OnboardingScreen({ onContinue }: Props) {
  const [consent, setConsent] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SKIN CHECK</Text>
      <Text style={styles.title}>Before you scan</Text>

      {ITEMS.map((item) => (
        <View key={item.title} style={styles.itemRow}>
          <View style={styles.iconBubble}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <View style={styles.itemTextWrap}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemBody}>{item.body}</Text>
          </View>
        </View>
      ))}

      <View style={styles.consentRow}>
        <Switch
          value={consent}
          onValueChange={setConsent}
          trackColor={{ false: colors.border, true: colors.accentStart }}
          thumbColor={colors.textPrimary}
          accessibilityLabel="Consent to on-device scanning"
        />
        <Text style={styles.consentLabel}>
          I understand my scan and 3D model stay on this device and are not uploaded anywhere.
        </Text>
      </View>

      <Pressable
        onPress={onContinue}
        disabled={!consent}
        accessibilityRole="button"
        accessibilityState={{ disabled: !consent }}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient
          colors={consent ? gradients.primary : [colors.border, colors.border]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <Text style={[styles.buttonText, !consent && styles.buttonTextDisabled]}>Continue</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: { color: colors.accentStart, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.lg },
  itemRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, alignItems: 'flex-start' },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 17 },
  itemTextWrap: { flex: 1, paddingTop: 2 },
  itemTitle: { ...typography.title, fontSize: 15, color: colors.textPrimary, marginBottom: 3 },
  itemBody: { ...typography.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  consentLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  button: { borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', ...shadow.card },
  buttonText: { color: '#001410', fontWeight: '800', fontSize: 16 },
  buttonTextDisabled: { color: colors.textMuted },
});
