import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import { OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import { FaceMeshData } from '../types/FaceScan.types';

interface Props {
  mesh: FaceMeshData;
  photoUri: string;
  onClose: () => void;
  onExport: () => void;
  onDelete: () => void;
}

function FaceMesh({ mesh, photoUri }: { mesh: FaceMeshData; photoUri: string }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.vertices), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(mesh.uvs), 2));
    geo.setIndex(mesh.triangleIndices);
    geo.computeVertexNormals();
    return geo;
  }, [mesh]);

  const texture = useMemo(() => new THREE.TextureLoader().load(photoUri), [photoUri]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function MeshViewerScreen({ mesh, photoUri, onClose, onExport, onDelete }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your 3D face model</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.canvasWrap}>
        <Canvas camera={{ position: [0, 0, 0.3], fov: 35 }}>
          <ambientLight intensity={1.2} />
          <FaceMesh mesh={mesh} photoUri={photoUri} />
          <OrbitControls enablePan={false} minDistance={0.15} maxDistance={0.6} />
        </Canvas>
      </View>

      <Text style={styles.hint}>Drag to rotate, pinch to zoom.</Text>
      <Text style={styles.sourceNote}>
        Built from {mesh.source === 'arkit-truedepth' ? 'ARKit + TrueDepth (real depth scan)' : 'ARCore Augmented Faces (fitted mesh, no depth sensor)'}.
      </Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.buttonOutline} onPress={onExport}>
          <Text style={styles.buttonOutlineText}>Export .glb</Text>
        </Pressable>
        <Pressable style={styles.buttonDanger} onPress={onDelete}>
          <Text style={styles.buttonDangerText}>Delete scan</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF1F0', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '600', color: '#1F2A28' },
  closeText: { color: '#5C6B67', fontSize: 14 },
  canvasWrap: { aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1F2A28' },
  hint: { textAlign: 'center', color: '#5C6B67', fontSize: 12.5, marginTop: 10 },
  sourceNote: { textAlign: 'center', color: '#8A9188', fontSize: 11.5, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  buttonOutline: { flex: 1, borderWidth: 1, borderColor: '#DCE4E1', borderRadius: 10, padding: 12, alignItems: 'center' },
  buttonOutlineText: { color: '#1F2A28', fontWeight: '600' },
  buttonDanger: { flex: 1, borderWidth: 1, borderColor: '#F0C7C1', borderRadius: 10, padding: 12, alignItems: 'center' },
  buttonDangerText: { color: '#B23A2E', fontWeight: '600' },
});
