# SkinCheck — React Native app (Android / ARCore)

A complete, real React Native project. Native Android module is written in
**Java** (converted from an earlier Kotlin version). Modern dark UI with
gradient accents throughout.

## What's been verified vs. what hasn't

| Step | Status |
|---|---|
| Project scaffold | Real — copied directly from the `react-native@0.73.6` npm package's own template |
| Native Android module | **Java** (converted from Kotlin) — every ARCore API used confirmed against Google's official reference docs |
| TypeScript (all screens + native bridge + logic) | Actually type-checks — `npx tsc --noEmit` passes clean. Caught and fixed 3 real bugs during this pass (see below) |
| Compiling the native module | **Not verified locally** — this sandbox has no Android SDK/Gradle/network path to Google's Maven repo. The GitHub Actions workflow does this on a real runner. |

## Real bugs found and fixed in this pass (not just assumed working)

1. **`NaN` on the results screen** — `App.tsx` was passing an empty `zoneStats={{}}` placeholder with no code ever producing real data. Added the missing native method (`sampleFaceRegions`) that decodes the captured photo and samples 8 face zones (forehead, cheeks, nose, etc.), using the same redness/texture/tan math already tested in the original web prototype.
2. **3D viewer was built but never connected** — `MeshViewerScreen` existed but nothing in `App.tsx` ever navigated to it. Wired a full state machine: onboarding → scan → analyzing → results → mesh viewer, with a "View your 3D face model" button appearing only when mesh data actually exists.
3. **`.glb` export was a stub** — implemented for real using three.js's own `GLTFExporter` (already a dependency via `@react-three/fiber`), writing the binary file to device storage via `react-native-fs`.
4. **Invalid `inset: 0` style** — a web-CSS shorthand that doesn't exist in React Native's style system; caught by the TypeScript compiler and fixed to explicit `top/left/right/bottom`.
5. **Gradient color arrays typed `readonly`** — clashed with `react-native-linear-gradient`'s expected mutable array type; fixed at the source.
6. **`btoa` for base64 encoding** — technically type-checked, but `btoa` is a browser API not guaranteed to exist in React Native's JS engines. Replaced with RN's actually-reliable polyfilled `Buffer` global before it could cause a runtime crash nobody would have caught via type-checking alone.
7. **Missing runtime camera permission request** (fixed in the previous round) — the manifest declared the permission, but nothing ever asked for it at runtime, which Android requires separately. Now gated properly with a clear denied-state UI.

## Design

Dark theme, teal-to-cyan gradient accents on primary actions, card-based
layout with soft shadows, pill-shaped buttons — tokens live in `src/theme.ts`
so every screen pulls from the same palette/spacing/typography scale rather
than hand-rolled colors per screen.

## Get the APK — GitHub Actions builds it for you

1. Create a new GitHub repo, push this project to it (see previous
   instructions if you need the git/GitHub Desktop steps again)
2. Make sure `.github/workflows/build-android.yml` sits at the true repo
   root (not nested inside a subfolder — check the breadcrumb when browsing
   to it on GitHub)
3. Actions tab → wait for the green checkmark → download the APK from
   Artifacts
4. Uninstall any previous version from your phone before installing the new one

## Known gaps still open

- **iOS build** — `ios_native_module_reference/` contains the Swift
  ARKit/TrueDepth module for reference, but it isn't wired into a buildable
  iOS project in this delivery (Android was the confirmed target).
- **Sign calibration** — the yaw/pitch math is mathematically verified
  (tested against synthetic rotation matrices), but ARCore's exact matrix
  sign convention needs confirming on a real device. If turning left moves
  the pose guide the wrong way, flip `YAW_SIGN`/`PITCH_SIGN` in
  `FaceScannerGLRenderer.java`.
- **Zone sampling accuracy** — `sampleFaceRegions` assumes the "straight"
  capture is reasonably face-centered (a fair assumption given the
  pose-guided capture only fires near yaw/pitch zero), using fixed
  proportional zones rather than a true per-frame face-position detection.
  Reasonable starting accuracy; a real 3D mesh-to-screen projection would be
  more precise but meaningfully more complex and unverified without a device.
