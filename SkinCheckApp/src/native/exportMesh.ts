import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import RNFS from 'react-native-fs';
import { FaceMeshData } from '../types/FaceScan.types';

/**
 * Exports the scanned face mesh as a real, openable .glb file, written to
 * device storage. Uses three.js's own GLTFExporter (a real dependency, no
 * native rendering needed for this — export is pure data transformation).
 *
 * NOTE: this exports geometry only, without the captured photo baked in as
 * a texture. three.js's TextureLoader relies on browser DOM APIs
 * (`Image()`) that don't exist in React Native's JS runtime — using it here
 * would throw at runtime the moment this function ran, not something worth
 * shipping just to check a feature box. Loading the photo as a texture
 * properly would need a native image-decode step (similar to what
 * FaceMeshViewerView.java already does for the live viewer) feeding raw
 * pixel data into a THREE.DataTexture instead — a reasonable next step, but
 * a real enough gap that it's called out explicitly rather than papered
 * over with code that looks like it works.
 */
export async function exportMeshAsGlb(mesh: FaceMeshData, photoUri: string): Promise<string> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.vertices), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(mesh.uvs), 2));
  geometry.setIndex(mesh.triangleIndices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0xd9b899, side: THREE.DoubleSide });
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
