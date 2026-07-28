import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { CaptureResult, ScanStepKey } from './src/types/FaceScan.types';

type AppStep = 'onboarding' | 'scan' | 'results';

export default function App() {
  const [step, setStep] = useState<AppStep>('onboarding');
  const [captures, setCaptures] = useState<Record<ScanStepKey, CaptureResult> | null>(null);

  return (
    <SafeAreaView style={styles.flex}>
      {step === 'onboarding' && <OnboardingScreen onContinue={() => setStep('scan')} />}

      {step === 'scan' && (
        <ScanScreen
          onComplete={(result) => {
            setCaptures(result);
            setStep('results');
          }}
        />
      )}

      {/* Results screen currently needs per-zone RegionStats — see README's
          "What's left to build" section for the native method that produces
          this from `captures`. Wired here with a placeholder empty object so
          the screen renders; replace once that native method exists. */}
      {step === 'results' && captures && <ResultsScreen zoneStats={{}} age={null} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
