# SkinCheck — React Native app (Android / ARCore)

Native Android module in Java, encrypted local storage, 3-step face scan
with progress tracking and personalized suggestions.

## What changed in this pass

### Arrow direction fix (confirmed on real device)
The pose-guide arrows were pointing the wrong way. Root cause: `YAW_SIGN` in
`FaceScannerGLRenderer.java` was inverted — exactly the calibration risk
flagged since the first pose-tracking build. Flipped from `1f` to `-1f`.
Since both the alignment-detection targets and the arrow directions are
driven by this same constant, one fix corrects both simultaneously.

### Security hardening
- **Removed the `INTERNET` permission** from the release build entirely —
  verified first that zero network calls exist anywhere in the app. Debug
  builds keep it (needed for the local Metro dev server), release does not.
- **Enabled R8 code shrinking + obfuscation** for release builds (was
  `false` — meaning every prior APK shipped as fully readable, unobfuscated
  bytecode). Added explicit ProGuard keep rules for our native module (so
  React Native's reflection-based bridge doesn't get stripped) and ARCore.
- **Photos are now encrypted at rest** using AES-256-GCM with a key held in
  Android's hardware-backed Keystore (`PhotoCipher.java`) — the standard
  documented Android pattern, not hand-rolled crypto. Files on disk are now
  ciphertext; a new `getPhotoBase64` method decrypts in memory only when
  actually needed for display or analysis, and the decrypted bytes are
  never written back to disk.
- **Scan history moved from AsyncStorage to `react-native-encrypted-storage`**
  — encrypted via Android Keystore-backed EncryptedSharedPreferences
  (Keychain on iOS).
- **`FLAG_SECURE` added** to block screenshots and screen recording
  app-wide, since this app handles face photos.
- **`allowBackup="false"`** (was already set) and explicit
  `usesCleartextTraffic="false"` on the release build.

### New: personalized suggestions
Results now include a "What you can do" card — up to 3 tips based on the
zones that scored worst, plus one age-tuned tip, ported from the logic
already used (and boundary-tested) in the original web prototype.

### UI refinements
Added a secondary violet accent color and a subtle colored border on the
overall-score card matching its score band, for a bit more visual distinction
without a full redesign.

## Known gaps still open

- **iOS build** — `ios_native_module_reference/` has the Swift ARKit module
  for reference, not wired into a buildable iOS project. The security
  measures described above (encrypted storage, no network permission) are
  Android-specific in this pass; the same principles (Keychain for photos,
  no network entitlements) should be applied when iOS is actually built.
- **Sign calibration** — pitch sign (`PITCH_SIGN`) hasn't been reported as
  wrong, only yaw — left as-is, but the same real-device-confirmation
  caveat applies if tilt-based steps are ever reintroduced.
- Zone sampling still uses fixed proportional regions on the straight-face
  photo, as before.

## Build

Same GitHub Actions workflow as before — no changes needed there, only the
app code changed.
