package com.skincheck.facescanner;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

// AES-256-GCM encryption for photos at rest, using a key stored in
// Android's hardware-backed Keystore (the key material itself never
// leaves secure hardware on supported devices -- the app only ever
// handles ciphertext).
//
// Standard, well-documented Android pattern -- not hand-rolled crypto.
// Reference: developer.android.com/training/articles/keystore
public class PhotoCipher {

  private static final String KEY_ALIAS = "skincheck_photo_key_v1";
  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int GCM_IV_LENGTH_BYTES = 12;
  private static final int GCM_TAG_LENGTH_BITS = 128;

  // Synchronized: on first-ever use, this generates the Keystore key. If
  // two native calls happened to race here before the key exists, both
  // could try to generate the same alias simultaneously -- unlikely given
  // how React Native serializes native module calls, but cheap to close
  // off entirely rather than rely on that.
  private static synchronized SecretKey getOrCreateKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
    keyStore.load(null);

    if (!keyStore.containsAlias(KEY_ALIAS)) {
      KeyGenerator keyGenerator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
      );
      KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build();
      keyGenerator.init(spec);
      keyGenerator.generateKey();
    }

    return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
  }

  // Output layout: [12-byte IV][ciphertext + 16-byte GCM auth tag]
  public static byte[] encrypt(byte[] plaintext) throws Exception {
    SecretKey key = getOrCreateKey();
    Cipher cipher = Cipher.getInstance(TRANSFORMATION);
    cipher.init(Cipher.ENCRYPT_MODE, key);
    byte[] iv = cipher.getIV();
    byte[] ciphertext = cipher.doFinal(plaintext);

    byte[] result = new byte[iv.length + ciphertext.length];
    System.arraycopy(iv, 0, result, 0, iv.length);
    System.arraycopy(ciphertext, 0, result, iv.length, ciphertext.length);
    return result;
  }

  public static byte[] decrypt(byte[] combined) throws Exception {
    SecretKey key = getOrCreateKey();
    byte[] iv = Arrays.copyOfRange(combined, 0, GCM_IV_LENGTH_BYTES);
    byte[] ciphertext = Arrays.copyOfRange(combined, GCM_IV_LENGTH_BYTES, combined.length);

    Cipher cipher = Cipher.getInstance(TRANSFORMATION);
    GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
    cipher.init(Cipher.DECRYPT_MODE, key, spec);
    return cipher.doFinal(ciphertext);
  }
}
