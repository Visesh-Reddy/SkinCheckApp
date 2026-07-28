import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, PermissionsAndroid, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { FaceScannerCameraView } from '../native/FaceScannerCameraView';
import {
  captureCurrentMesh,
  capturePhoto,
  checkLastCaptureQuality,
} from '../native/FaceScannerModule';
import { HOLD_MS_REQUIRED, SCAN_STEPS, isAligned } from '../logic/poseTargets';
import { CaptureResult, FacePose, ScanStepKey } from '../types/FaceScan.types';
import { colors, gradients, radius, spacing, typography, shadow } from '../theme';

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

type PermissionState = 'checking' | 'granted' | 'denied';

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
  if (already) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera permission needed',
    message: 'SkinCheck needs your camera to scan your face. Nothing is uploaded — scanning happens entirely on this device.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function ScanScreen({ onComplete }: Props) {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [stepIndex, setStepIndex] = useState(0);
  const [message, setMessage] = useState('Move into position and hold still.');
  const [failCount, setFailCount] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureCameraPermission().then((granted) => {
      if (!cancelled) setPermissionState(granted ? 'granted' : 'denied');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const holdMsRef = useRef(0);
  const lastPoseTimeRef = useRef<number>(Date.now());
  const capturesRef = useRef<Record<string, CaptureResult>>({});
  const busyRef = useRef(false);

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
    if (currentStep === 'straight') return;
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
      {permissionState === 'checking' && (
        <View style={styles.centerBox}>
          <Text style={styles.hint}>Requesting camera permission...</Text>
        </View>
      )}

      {permissionState === 'denied' && (
        <View style={styles.centerBox}>
          <Text style={styles.instruction}>Camera permission is required to scan</Text>
          <Text style={styles.hint}>
            Enable it in Settings → Apps → SkinCheck → Permissions → Camera, then reopen the app.
          </Text>
        </View>
      )}

      {permissionState === 'granted' && (
        <>
          <View style={styles.progressRow}>
            {SCAN_STEPS.map((step, i) => (
              <View
                key={step}
                style={[styles.dot, i < stepIndex && styles.dotDone, i === stepIndex && styles.dotActive]}
              />
            ))}
          </View>
          <Text style={styles.stepCounter}>
            STEP {stepIndex + 1} OF {SCAN_STEPS.length}
          </Text>
          <Text style={styles.instruction}>{STEP_LABELS[currentStep]}</Text>

          <View style={styles.cameraArea}>
            <FaceScannerCameraView onPose={handlePose} style={styles.camera} />
            <View style={styles.cameraFrameOverlay} pointerEvents="none" />
          </View>

          <Text style={styles.hint}>{message}</Text>

          {showSkip && (
            <Pressable onPress={skipCurrentStep} style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.7 }]}>
              <Text style={styles.skipButtonText}>Skip this angle</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 20 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.accentStart },
  dotActive: { backgroundColor: colors.warning },
  stepCounter: {
    ...typography.caption,
    color: colors.accentStart,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  instruction: { ...typography.title, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.md },
  cameraArea: {
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  camera: { flex: 1 },
  cameraFrameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(0,217,163,0.35)',
  },
  hint: { textAlign: 'center', color: colors.textSecondary, fontSize: 13.5, marginTop: spacing.md },
  skipButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
  },
  skipButtonText: { color: colors.textPrimary, fontWeight: '700' },
});
