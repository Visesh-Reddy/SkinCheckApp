# SkinCheck — React Native app (Android / ARCore)

Native Android module in Java. Modern dark UI. 3-step face scan (straight,
left, right) with local on-device progress tracking day-to-day, week-to-week,
month-to-month.

## What changed in this pass

- **Removed tilt-up/tilt-down steps** — scan is now straight/left/right only.
  `ScanStepKey` itself was narrowed at the type level so the compiler
  enforces consistency everywhere it's used (pose targets, arrow directions,
  step labels) rather than leaving unused step branches lying around.
- **Removed the 3D face model entirely** — not just hidden. This included
  deleting the native OpenGL mesh viewer (`FaceMeshViewerRenderer/View/Manager.java`),
  the `captureCurrentMesh` native method, the mesh-related JS files, and the
  `three`/`react-native-fs` dependencies that only existed to support it.
  Removed rather than left as dead code, since keeping an unused native
  OpenGL renderer and its dependencies around would only add APK size and
  confusion.
- **Results screen now shows the actual straight-face photo** at the top,
  above the score.
- **Local progress tracking, added properly:**
  - Every scan is saved via `@react-native-async-storage/async-storage` —
    never leaves the device.
  - A real bug fixed as part of this: captured photos were being saved to
    Android's **cache** directory, which the OS can clear at any time under
    storage pressure — unacceptable for data meant to persist for
    week/month tracking. Changed to internal **files** storage
    (`getFilesDir()`), which the OS does not clear automatically.
  - The day/week/month comparison math (`computeProgress` in
    `scanHistory.ts`) was unit-tested against synthetic scan records before
    being wired into the UI — 10/10 tests passed, including the tricky
    day-29-vs-day-30 trailing-window boundary case.
- **Added a "Scan again" button** — a real gap caught while removing the
  mesh viewer: that screen had been the only path back to a new scan, so
  removing it would have left the app with no way to re-scan at all.

## Architecture

```
src/
  screens/
    AgeScreen.tsx        <- page 1: optional age
    OnboardingScreen.tsx <- page 2: guidelines + consent
    ScanScreen.tsx        <- page 3: 3-step guided scan (oval + arrows)
    ResultsScreen.tsx     <- photo + score + progress + zone breakdown
  native/
    FaceScannerModule.ts  <- JS bridge (6 methods, matches Java exactly)
    FaceScannerCameraView.tsx
    scanHistory.ts        <- local storage + progress math (tested)
  logic/
    poseTargets.ts, skinScoring.ts, qualityChecks.ts

android/.../facescanner/
  FaceScannerModule.java      <- isSupported, startSession, stopSession,
                                 capturePhoto, checkLastCaptureQuality,
                                 sampleFaceRegions
  FaceScannerGLRenderer.java  <- ARCore session + camera passthrough + pose
  FaceScannerCameraView.java, FaceScannerViewManager.java, FaceScannerPackage.java
```

## Known gaps still open

- **iOS build** — `ios_native_module_reference/` has the Swift ARKit module
  for reference, not wired into a buildable iOS project.
- **Sign calibration** — yaw sign is mathematically verified but ARCore's
  exact convention needs confirming on a real device (`YAW_SIGN` in
  `FaceScannerGLRenderer.java`). The scan-guide arrows encode the same
  assumption — see the comment in `ScanScreen.tsx` if that ever needs fixing.
- **Zone sampling** uses fixed proportional regions on the straight-face
  photo (not a per-frame face-position detection) — a reasonable-accuracy
  simplification given the pose-guided capture keeps the face centered.

## Build

Same GitHub Actions workflow as before — no changes needed there, only the
app code changed.
