import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { AgeScreen } from './src/screens/AgeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { sampleFaceRegions } from './src/native/FaceScannerModule';
import { saveScanRecord } from './src/native/scanHistory';
import { scoreZone } from './src/logic/skinScoring';
import { CaptureResult, ScanStepKey } from './src/types/FaceScan.types';
import { RegionStats } from './src/logic/skinScoring';
import { colors } from './src/theme';

type AppStep = 'age' | 'guidelines' | 'scan' | 'analyzing' | 'results';

export default function App() {
  const [step, setStep] = useState<AppStep>('age');
  const [age, setAge] = useState<number | null>(null);
  const [zoneStats, setZoneStats] = useState<Record<string, RegionStats>>({});
  const [straightPhotoUri, setStraightPhotoUri] = useState<string>('');

  const handleScanComplete = async (result: Record<ScanStepKey, CaptureResult>) => {
    const straight = result.straight;
    setStraightPhotoUri(straight.photoUri);
    setStep('analyzing');
    try {
      const stats = await sampleFaceRegions(straight.photoUri);
      setZoneStats(stats);

      // Save this scan to local history for day/week/month progress
      // tracking -- never leaves the device (see scanHistory.ts).
      const brightest = Math.max(...Object.values(stats).map((s) => s.avgLum));
      const zoneScores: Record<string, number> = {};
      let scoreSum = 0;
      let scoreCount = 0;
      for (const [key, regionStats] of Object.entries(stats)) {
        const { score } = scoreZone(regionStats, brightest, age);
        zoneScores[key] = score;
        scoreSum += score;
        scoreCount++;
      }
      const overallScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;

      await saveScanRecord({
        id: `${Date.now()}`,
        dateIso: new Date().toISOString(),
        overallScore,
        zoneScores,
        photoUri: straight.photoUri,
        age,
      });
    } catch (err) {
      // ResultsScreen's own empty-state (hasData === false) handles showing
      // a clear failure message with a retry button -- no separate banner
      // needed here, avoiding two overlapping "something went wrong"
      // messages stacked on screen at once.
      setZoneStats({});
    } finally {
      setStep('results');
    }
  };

  const resetScanState = () => {
    setZoneStats({});
    setStraightPhotoUri('');
    setStep('scan');
  };

  return (
    <SafeAreaView style={styles.flex}>
      {step === 'age' && (
        <AgeScreen
          onContinue={(selectedAge) => {
            setAge(selectedAge);
            setStep('guidelines');
          }}
        />
      )}

      {step === 'guidelines' && <OnboardingScreen onContinue={() => setStep('scan')} />}

      {step === 'scan' && <ScanScreen onComplete={handleScanComplete} />}

      {step === 'analyzing' && (
        <View style={styles.centerBox}>
          <Text style={styles.analyzingText}>Analyzing your scan...</Text>
        </View>
      )}

      {step === 'results' && (
        <ResultsScreen
          zoneStats={zoneStats}
          age={age}
          photoUri={straightPhotoUri}
          onScanAgain={resetScanState}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  analyzingText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
