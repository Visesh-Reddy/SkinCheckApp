import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { AgeScreen } from './src/screens/AgeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { MeshViewerScreen } from './src/screens/MeshViewerScreen';
import { sampleFaceRegions } from './src/native/FaceScannerModule';
import { exportMeshAsGlb } from './src/native/exportMesh';
import { CaptureResult, ScanStepKey } from './src/types/FaceScan.types';
import { RegionStats } from './src/logic/skinScoring';
import { colors } from './src/theme';

type AppStep = 'age' | 'guidelines' | 'scan' | 'analyzing' | 'results' | 'meshViewer';

export default function App() {
  const [step, setStep] = useState<AppStep>('age');
  const [age, setAge] = useState<number | null>(null);
  const [captures, setCaptures] = useState<Record<ScanStepKey, CaptureResult> | null>(null);
  const [zoneStats, setZoneStats] = useState<Record<string, RegionStats>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleScanComplete = async (result: Record<ScanStepKey, CaptureResult>) => {
    setCaptures(result);
    setStep('analyzing');
    try {
      const straight = result.straight;
      const stats = await sampleFaceRegions(straight.photoUri);
      setZoneStats(stats);
    } catch (err) {
      setAnalysisError('Could not analyze the scan — try retaking it with more even lighting.');
      setZoneStats({});
    } finally {
      setStep('results');
    }
  };

  const resetToStart = () => {
    setStep('age');
    setAge(null);
    setCaptures(null);
    setZoneStats({});
    setAnalysisError(null);
  };

  const straightCapture = captures?.straight;
  const hasMesh = !!(straightCapture && straightCapture.mesh);

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
        <>
          {analysisError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{analysisError}</Text>
            </View>
          )}
          <ResultsScreen
            zoneStats={zoneStats}
            age={age}
            hasMesh={hasMesh}
            onViewMesh={() => setStep('meshViewer')}
          />
        </>
      )}

      {step === 'meshViewer' && straightCapture && straightCapture.mesh && (
        <MeshViewerScreen
          mesh={straightCapture.mesh}
          photoUri={straightCapture.photoUri}
          onClose={() => setStep('results')}
          onExport={async () => {
            try {
              await exportMeshAsGlb(straightCapture.mesh!, straightCapture.photoUri);
            } catch (err) {
              // In a production app, surface this via a toast/snackbar rather
              // than silently failing.
            }
          }}
          onDelete={resetToStart}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  analyzingText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 12,
    margin: 16,
    padding: 12,
  },
  errorText: { color: colors.danger, fontSize: 13 },
});
