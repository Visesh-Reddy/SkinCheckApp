# SkinCheck — React Native app (Android / ARCore)

A complete, real React Native project — not just loose feature files. Built by
scaffolding the actual `react-native@0.73.6` template, renaming its package to
`com.skincheck`, and merging in the ARCore Augmented Faces native module.

## What's been verified vs. what hasn't

| Step | Status |
|---|---|
| Project scaffold | **Real** — copied directly from the `react-native@0.73.6` npm package's own template (not hand-typed boilerplate) |
| Package rename (`com.helloworld` to `com.skincheck`) | Done and double-checked - including a real bug I caught: `MainActivity.getMainComponentName()` has to match `app.json`'s `name` field or the app crashes on launch trying to find its root component. Fixed. |
| `MainApplication.kt` registration of `FaceScannerPackage` | Done, edited against the real generated file |
| `AndroidManifest.xml` (camera permission, ARCore metadata) | Done, edited against the real generated file |
| `build.gradle` (ARCore dependency) | Done - confirmed Google's Maven repo (where `com.google.ar:core` lives) is already declared in `android/build.gradle`, so no extra repo config needed |
| TypeScript (all screens + native bridge + logic) | **Actually type-checks** - `npx tsc --noEmit` passes clean using the project's own real `tsconfig.json` (`@react-native/typescript-config`), not just a hand-written config |
| `FaceScannerModule.kt` / `.swift` compiling | **Not verified.** This sandbox has no Android SDK, no Gradle, no `dl.google.com` network access (that's specifically where the ARCore artifact itself is hosted) - so `./gradlew assembleDebug` has never actually run. That's exactly what the GitHub Actions workflow below does for you, on a real Ubuntu runner with full tooling and network access. |

## Get the APK — no local Android Studio required

1. **Create a new GitHub repo** (empty, public or private) at github.com/new
2. **Push this project to it:**
   ```bash
   cd SkinCheckApp
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to your repo on GitHub, the **Actions** tab. You should see "Build
   Android APK" already queued or ready to run (it triggers automatically on
   push, and also has a manual **Run workflow** button).
4. Wait for the green checkmark (a first build usually takes 5-10 minutes).
5. Click into the finished run, scroll to **Artifacts**, download
   **skin-check-debug-apk**. It downloads as a `.zip` - unzip it to get
   `app-debug.apk`.
6. **Get it onto your phone** - easiest options:
   - Email/AirDrop/cloud-drive the `.apk` to yourself, open it on your phone
   - Or with your phone plugged into a computer via USB (Developer Options,
     USB debugging enabled, as before):
     ```bash
     adb install app-debug.apk
     ```
7. On your phone, tapping the downloaded APK will prompt **"Install unknown
   apps"** - Android blocks this by default for files not from the Play
   Store. Allow it for your file manager/browser, then install.

## Before you scan on the phone

Check your specific device is ARCore-supported:
developers.google.com/ar/devices.
If Play Store shows "Google Play Services for AR" as installable, that's a
good sign. Unsupported devices will get `isSupported() -> false` from the
native module rather than crashing - the app should route those to a
graceful "not supported" state (verify this is wired up in your app's entry
flow before relying on it).

## Known gaps (see the module-level comments for exactly where)

- **Per-zone skin pixel sampling** isn't implemented yet - `ResultsScreen`
  expects region stats as a prop. Add one more native method to
  `FaceScannerModule.kt`, following the same pattern as the working
  `checkLastCaptureQuality()`.
- **`.glb` export** for the 3D model isn't wired up on the RN side yet.
- **Sign calibration**: the yaw/pitch math is mathematically verified, but
  ARCore's exact matrix convention needs confirming on a real device. If
  turning left moves the guide the wrong way, flip `YAW_SIGN`/`PITCH_SIGN`
  in `FaceScannerGLRenderer.kt`.
- This build config only targets **Android**. The `ios/FaceScannerModule.swift`
  and `.m` files are included for reference (see `ios_native_module_reference/`)
  but wiring them into a real iOS project is separate future work.
