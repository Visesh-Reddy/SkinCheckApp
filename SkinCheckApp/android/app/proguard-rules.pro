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
