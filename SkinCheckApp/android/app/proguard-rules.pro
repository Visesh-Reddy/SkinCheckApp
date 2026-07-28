# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# --- Project-specific keep rules ---
# React Native's bridge finds @ReactMethod-annotated methods via reflection
# at runtime. Without these keep rules, R8 could rename or strip methods it
# thinks are unused (since it can't see the reflection-based call sites),
# silently breaking every native module call in a release build.
-keep class com.skincheck.facescanner.** { *; }
-keepclassmembers class com.skincheck.facescanner.** {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# ARCore's SDK also relies on reflection/JNI in places; keeping its classes
# intact avoids obfuscation breaking the native <-> Java bridge it depends on.
-keep class com.google.ar.core.** { *; }
-dontwarn com.google.ar.core.**

# react-native-encrypted-storage depends on Google's Tink crypto library
# (used internally by Android's EncryptedSharedPreferences), which
# references several annotation-only classes (error-prone, javax.annotation,
# checker-framework) that are compile-time-only static-analysis hints, not
# present at runtime -- safe to ignore, not safe to leave unaddressed, since
# R8 treats a missing reference as a hard build failure by default (AGP 8+).
# This is a widely-documented issue with Tink specifically (confirmed across
# multiple unrelated libraries that depend on it), not something specific
# to our code.
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn javax.annotation.concurrent.**
-dontwarn org.checkerframework.**
-dontwarn com.google.j2objc.annotations.**

# Separately: Tink's internal protobuf-generated classes have been reported
# to have fields stripped by R8 in a way that causes a RUNTIME crash
# (NoClassDefFoundError / "Field ... not found") rather than just a build
# warning -- a different, more serious issue than the missing-annotation
# one above. Keeping Tink's own classes intact avoids that class of crash.
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
