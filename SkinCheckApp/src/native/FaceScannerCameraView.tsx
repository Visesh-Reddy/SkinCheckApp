import React, { useEffect } from 'react';
import { Platform, View, requireNativeComponent, NativeSyntheticEvent } from 'react-native';
import { FacePose } from '../types/FaceScan.types';
import { subscribeToPoseIOS } from './FaceScannerModule';

interface PoseEventPayload {
  yaw: number;
  pitch: number;
  roll: number;
  trackingState: string;
}

interface NativeCameraViewProps {
  style?: any;
  onPoseUpdate?: (event: NativeSyntheticEvent<PoseEventPayload>) => void;
}

// Android's native GL-backed view (see FaceScannerViewManager.kt) —
// only required/rendered on Android, since iOS's ARSession runs headless.
const NativeAndroidView =
  Platform.OS === 'android'
    ? requireNativeComponent<NativeCameraViewProps>('FaceScannerCameraView')
    : null;

interface Props {
  onPose: (pose: FacePose) => void;
  style?: any;
}

/**
 * Mount this once on the scan screen. On iOS it renders nothing (ARKit runs
 * headless via the native module) but still subscribes to pose events. On
 * Android it renders the actual GL surface that owns the ARCore session —
 * this MUST be in the view tree for face tracking to run at all on Android.
 */
export function FaceScannerCameraView({ onPose, style }: Props) {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const unsubscribe = subscribeToPoseIOS(onPose);
    return unsubscribe;
  }, [onPose]);

  if (Platform.OS === 'android' && NativeAndroidView) {
    const handlePoseUpdate = (event: NativeSyntheticEvent<PoseEventPayload>) => {
      const { yaw, pitch, roll, trackingState } = event.nativeEvent;
      onPose({
        yaw,
        pitch,
        roll,
        trackingState: trackingState === 'tracking' ? 'tracking' : 'none',
      });
    };
    return <NativeAndroidView style={style} onPoseUpdate={handlePoseUpdate} />;
  }

  // iOS: no visible native view needed for tracking itself. The actual
  // camera preview shown to the user should come from a standard
  // camera-preview library (e.g. react-native-vision-camera) layered here,
  // since ARKit's session doesn't provide its own preview view by default
  // unless you also stand up an ARSCNView/ARView.
  return <View style={style} />;
}
