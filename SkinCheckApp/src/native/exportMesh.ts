import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import RNFS from 'react-native-fs';
import { FaceMeshData } from '../types/FaceScan.types';

/**
 * Exports the scanned face mesh as a real, openable .glb file, written to
 * device storage. Uses three.js's own GLTFExporter (already a project
 * dependency via @react-three/fiber) rather than a placeholder.
 */
export async function exportMeshAsGlb(mesh: FaceMeshData, photoUri: string): Promise<string> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.vertices), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(mesh.uvs), 2));
  geometry.setIndex(mesh.triangleIndices);
  geometry.computeVertexNormals();

  const texture = await new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(photoUri, resolve, undefined, reject);
  });

  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const threeMesh = new THREE.Mesh(geometry, material);

  const glbArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      threeMesh,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('Expected binary GLB output'));
      },
      (err) => reject(err),
      { binary: true }
    );
  });

  const base64 = arrayBufferToBase64(glbArrayBuffer);
  const path = `${RNFS.DocumentDirectoryPath}/face-scan-${Date.now()}.glb`;
  await RNFS.writeFile(path, base64, 'base64');
  return path;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // React Native globally polyfills Buffer (from the 'buffer' package) --
  // more reliable across JS engines (Hermes/JSC) than the browser-only
  // btoa/atob APIs, which aren't guaranteed to exist in RN's runtime.
  return Buffer.from(buffer).toString('base64');
}
