import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FaceScannerCameraView } from '../native/FaceScannerCameraView';
import {
  captureCurrentMesh,
  capturePhoto,
  checkLastCaptureQuality,
} from '../native/FaceScannerModule';
import { HOLD_MS_REQUIRED, SCAN_STEPS, isAligned } from '../logic/poseTargets';
import { CaptureResult, FacePose, ScanStepKey } from '../types/FaceScan.types';

interface Props {
  onComplete: (captures: Record<ScanStepKey, CaptureResult>) => void;
}

const STEP_LABELS: Record<ScanStepKey, string> = {
  straight: 'Look straight at the camera',
  left: 'Turn to show your left cheek',
  right: 'Turn to show your right cheek',
  top: 'Tilt your face up slightly',
  bottom: 'Tilt your face down slightly',
};

export function ScanScreen({ onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [message, setMessage] = useState('Move into position and hold still.');
  const [failCount, setFailCount] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  const holdMsRef = useRef(0);
  const lastPoseTimeRef = useRef<number>(Date.now());
  const capturesRef = useRef<Record<string, CaptureResult>>({});
  const busyRef = useRef(false); // prevents double-capture while an async capture is in flight

  const currentStep = SCAN_STEPS[stepIndex];

  const finishStep = useCallback(
    (result: CaptureResult) => {
      capturesRef.current[currentStep] = result;
      holdMsRef.current = 0;
      setFailCount(0);
      setShowSkip(false);
      if (stepIndex + 1 < SCAN_STEPS.length) {
        setStepIndex((i) => i + 1);
        setMessage('Move into position and hold still.');
      } else {
        onComplete(capturesRef.current as Record<ScanStepKey, CaptureResult>);
      }
    },
    [currentStep, stepIndex, onComplete]
  );

  const skipCurrentStep = useCallback(() => {
    if (currentStep === 'straight') return; // straight is required for the mesh
    if (stepIndex + 1 < SCAN_STEPS.length) {
      setStepIndex((i) => i + 1);
      setFailCount(0);
      setShowSkip(false);
      setMessage('Move into position and hold still.');
    } else {
      onComplete(capturesRef.current as Record<ScanStepKey, CaptureResult>);
    }
  }, [currentStep, stepIndex, onComplete]);

  const handlePose = useCallback(
    async (pose: FacePose) => {
      const now = Date.now();
      const dt = now - lastPoseTimeRef.current;
      lastPoseTimeRef.current = now;

      if (pose.trackingState !== 'tracking') {
        holdMsRef.current = 0;
        setMessage('No face detected — center your face in frame.');
        return;
      }

      const aligned = isAligned(currentStep, pose.yaw, pose.pitch);
      if (!aligned) {
        holdMsRef.current = 0;
        return;
      }

      holdMsRef.current += dt;
      if (holdMsRef.current < HOLD_MS_REQUIRED) return;
      if (busyRef.current) return;

      busyRef.current = true;
      holdMsRef.current = 0;
      try {
        const quality = await checkLastCaptureQuality();
        if (!quality.ok) {
          const nextFailCount = failCount + 1;
          setFailCount(nextFailCount);
          setMessage(
            quality.reason === 'dark'
              ? 'Too dark — find better lighting, then hold still again.'
              : quality.reason === 'bright'
              ? 'Too bright — reduce direct light, then hold still again.'
              : 'Too blurry — hold steadier this time.'
          );
          if (nextFailCount >= 4 && currentStep !== 'straight') setShowSkip(true);
          return;
        }

        const [photoUri, mesh] = await Promise.all([
          capturePhoto(),
          captureCurrentMesh().catch(() => null),
        ]);

        finishStep({ photoUri, mesh, quality });
      } catch (err) {
        setMessage('Capture failed — hold still and try again.');
      } finally {
        busyRef.current = false;
      }
    },
    [currentStep, failCount, finishStep]
  );

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {SCAN_STEPS.map((step, i) => (
          <View key={step} style={[styles.dot, i < stepIndex && styles.dotDone, i === stepIndex && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.instruction}>
        Step {stepIndex + 1} of {SCAN_STEPS.length}: {STEP_LABELS[currentStep]}
      </Text>

      <View style={styles.cameraArea}>
        <FaceScannerCameraView onPose={handlePose} style={styles.camera} />
      </View>

      <Text style={styles.hint}>{message}</Text>

      {showSkip && (
        <Pressable style={styles.skipButton} onPress={skipCurrentStep}>
          <Text style={styles.skipButtonText}>Skip this angle</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF1F0', padding: 16 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DCE4E1' },
  dotDone: { backgroundColor: '#3E7C6B' },
  dotActive: { backgroundColor: '#D9A441' },
  instruction: { fontSize: 16, fontWeight: '700', color: '#1F2A28', marginBottom: 12 },
  cameraArea: { aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1F2A28' },
  camera: { flex: 1 },
  hint: { textAlign: 'center', color: '#5C6B67', fontSize: 13, marginTop: 12 },
  skipButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#DCE4E1',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: { color: '#1F2A28', fontWeight: '600' },
});
