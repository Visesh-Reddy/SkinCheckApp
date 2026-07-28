import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';

interface Props {
  onContinue: () => void;
}

const ITEMS = [
  {
    title: 'Find even, bright light',
    body: 'Face a window or lamp — avoid strong backlight or deep shadows.',
  },
  {
    title: "You'll turn your head slowly",
    body: 'Straight, left, right, then up and down. On-screen prompts guide each move.',
  },
  {
    title: 'Your scan stays on this device',
    body: 'Face tracking and the 3D model are processed on-device via ARKit/ARCore. Nothing is uploaded.',
  },
  {
    title: 'Camera access needed',
    body: "Your device will ask permission to use the camera. If it's denied, scanning can't proceed.",
  },
];

export function OnboardingScreen({ onContinue }: Props) {
  const [consent, setConsent] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Before you scan</Text>
      {ITEMS.map((item) => (
        <View key={item.title} style={styles.item}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemBody}>{item.body}</Text>
        </View>
      ))}

      <View style={styles.consentRow}>
        <Switch value={consent} onValueChange={setConsent} accessibilityLabel="Consent to on-device scanning" />
        <Text style={styles.consentLabel}>
          I understand my scan and 3D model stay on this device and are not uploaded anywhere.
        </Text>
      </View>

      <Pressable
        style={[styles.button, !consent && styles.buttonDisabled]}
        disabled={!consent}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityState={{ disabled: !consent }}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#EDF1F0' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#1F2A28' },
  item: { marginBottom: 14 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#1F2A28', marginBottom: 2 },
  itemBody: { fontSize: 13, color: '#5C6B67', lineHeight: 18 },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginVertical: 16,
    gap: 10,
  },
  consentLabel: { flex: 1, fontSize: 13, color: '#1F2A28', lineHeight: 18 },
  button: { backgroundColor: '#3E7C6B', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
