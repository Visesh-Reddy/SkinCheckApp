import React from 'react';
import { View, StyleSheet, Text, Pressable, requireNativeComponent } from 'react-native';
import { FaceMeshData } from '../types/FaceScan.types';
import { colors, radius, spacing, typography, shadow } from '../theme';

interface Props {
  mesh: FaceMeshData;
  photoUri: string;
  onClose: () => void;
  onExport: () => void;
  onDelete: () => void;
}

interface NativeMeshViewerProps {
  style?: any;
  verticesJson: string;
  uvsJson: string;
  indicesJson: string;
  photoPath: string;
}

// Native OpenGL ES viewer (see FaceMeshViewerView.java) -- deliberately not
// using @react-three/fiber/expo-gl here, since those require the `expo`
// package as a peer dependency and additional bare-workflow native wiring
// that this project doesn't have set up. This avoids that fragile chain
// entirely while still giving real rotate/zoom on the actual scanned mesh.
const NativeMeshViewer = requireNativeComponent<NativeMeshViewerProps>('FaceMeshViewer');

export function MeshViewerScreen({ mesh, photoUri, onClose, onExport, onDelete }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>3D MODEL</Text>
          <Text style={styles.title}>Your face scan</Text>
        </View>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.canvasWrap}>
        <NativeMeshViewer
          style={styles.canvas}
          verticesJson={JSON.stringify(mesh.vertices)}
          uvsJson={JSON.stringify(mesh.uvs)}
          indicesJson={JSON.stringify(mesh.triangleIndices)}
          photoPath={photoUri}
        />
      </View>

      <Text style={styles.hint}>Drag to rotate, pinch to zoom</Text>
      <Text style={styles.sourceNote}>
        {mesh.source === 'arkit-truedepth'
          ? 'Built from ARKit + TrueDepth (real depth scan)'
          : 'Built from ARCore Augmented Faces (fitted mesh, no depth sensor)'}
      </Text>

      <View style={styles.buttonRow}>
        <Pressable onPress={onExport} style={({ pressed }) => [styles.buttonOutline, pressed && { opacity: 0.7 }]}>
          <Text style={styles.buttonOutlineText}>Export .glb</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={({ pressed }) => [styles.buttonDanger, pressed && { opacity: 0.7 }]}>
          <Text style={styles.buttonDangerText}>Delete scan</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  eyebrow: { ...typography.caption, color: colors.accentStart, letterSpacing: 1.2, marginBottom: 2 },
  title: { ...typography.title, fontSize: 20, color: colors.textPrimary },
  closeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  closeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  canvasWrap: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  canvas: { flex: 1 },
  hint: { textAlign: 'center', color: colors.textSecondary, fontSize: 12.5, marginTop: spacing.md },
  sourceNote: { textAlign: 'center', color: colors.textMuted, fontSize: 11.5, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  buttonOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
  },
  buttonOutlineText: { color: colors.textPrimary, fontWeight: '700' },
  buttonDanger: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
  },
  buttonDangerText: { color: colors.danger, fontWeight: '700' },
});
