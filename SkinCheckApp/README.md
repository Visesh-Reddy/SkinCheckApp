# SkinCheck — React Native app (Android / ARCore)

A complete, real React Native project. Native Android module is written in
**Java**. Modern dark UI with gradient accents. 3D mesh viewer is a native
OpenGL ES component (not react-three-fiber/expo-gl — see below for why).

## What's been verified vs. what hasn't

| Step | Status |
|---|---|
| Project scaffold | Real — copied directly from the `react-native@0.73.6` npm package's own template |
| Native Android module | Java — every ARCore API used confirmed against Google's official reference docs |
| TypeScript (all screens + native bridge + logic) | Actually type-checks — `npx tsc --noEmit` passes clean |
| Gradle build itself | **Confirmed working** via GitHub Actions — this went through several real iterations (see below) |
| The 3D viewer's native OpenGL code | Not compiled locally (no Android SDK in this dev sandbox) — same caveat as the rest of the native module, resolved the same way (GitHub Actions build) |

## The real debugging history on this one (multiple genuine iterations)

1. **`NaN` on results screen** — nothing ever produced real zone-score data. Fixed by adding a native `sampleFaceRegions` method.
2. **3D viewer built but never connected to the app** — fixed by wiring a full navigation state machine.
3. **First Gradle build attempt failed**: `expo-file-system` could not be resolved by Metro. Root cause: `@react-three/fiber/native` + `expo-gl` — the libraries originally used for the 3D viewer — require the `expo` package itself as a peer dependency (confirmed via `npm view`), and reliable use in a bare React Native project (not an Expo project) needs additional native "bare workflow" wiring that wasn't set up.
4. **Rather than patch around that repeatedly**, the 3D viewer was rewritten as a **native OpenGL ES 2.0 component in Java** (`FaceMeshViewerRenderer`/`FaceMeshViewerView`/`FaceMeshViewerManager`), using the exact same `GLSurfaceView` pattern already proven for the camera scanning. Zero Expo dependency, full rotate (drag) and zoom (pinch) support, verified against the actual mesh data shape already flowing through the app.
5. **Found in the same pass**: the mesh export function used `THREE.TextureLoader`, which depends on browser DOM APIs (`Image()`) that don't exist in React Native's JS runtime — this would have crashed the instant someone tapped "Export .glb". Fixed by exporting geometry with a neutral material instead of attempting a texture load that was never going to work. Documented as a known simplification (see below) rather than silently shipped as if it were the real thing.

## Known gaps still open

- **Exported `.glb` has no texture** — geometry only, neutral material color. Baking the actual captured photo onto the exported mesh would need a native image-decode step feeding a `THREE.DataTexture` with raw pixel data, since the DOM-based texture loading approach doesn't work in RN. A reasonable next step, not done here.
- **iOS build** — `ios_native_module_reference/` has the Swift ARKit/TrueDepth module for reference, but isn't wired into a buildable iOS project (Android was the confirmed target).
- **Sign calibration** — yaw/pitch math is mathematically verified against synthetic data, but ARCore's exact matrix convention needs confirming on a real device. Flip `YAW_SIGN`/`PITCH_SIGN` in `FaceScannerGLRenderer.java` if turning left moves the pose guide the wrong way.
- **Zone sampling accuracy** — `sampleFaceRegions` uses fixed proportional zones assuming a reasonably face-centered "straight" capture, not a true per-frame face-position detection. Reasonable starting accuracy given the pose-guided capture flow.

## Get the APK — GitHub Actions builds it for you

Same workflow file as before — no changes needed there, only the app code
changed. If you don't already have `.github/workflows/main.yml` (or
similar) at the true repo root with the corrected `working-directory:
SkinCheckApp` paths, see the earlier setup instructions.
