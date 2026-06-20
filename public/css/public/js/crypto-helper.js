class CryptoHelper {
  constructor() {
    this.key = null;
  }

  /**
   * Derive a 256-bit AES-GCM key from a password and room salt
   */
  async initKey(password, roomId) {
    const encoder = new TextEncoder();
    
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    let salt = encoder.encode(roomId);
    if (salt.length < 16) {
      const paddedSalt = new Uint8Array(16);
      paddedSalt.set(salt);
      salt = paddedSalt;
    }

    this.key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    
    console.log("E2EE Cryptographic key derived successfully.");
    return this.key;
  }

  async encryptText(text) {
    if (!this.key) throw new Error("Key not initialized");
    
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      this.key,
      data
    );

    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    return this.arrayBufferToBase64(combined.buffer);
  }

  async decryptText(base64Payload) {
    if (!this.key) throw new Error("Key not initialized");

    const combined = new Uint8Array(this.base64ToArrayBuffer(base64Payload));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      this.key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  async encryptBuffer(buffer) {
    if (!this.key) throw new Error("Key not initialized");

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      this.key,
      buffer
    );

    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    return combined.buffer;
  }

  async decryptBuffer(encryptedBuffer) {
    if (!this.key) throw new Error("Key not initialized");

    const combined = new Uint8Array(encryptedBuffer);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      this.key,
      ciphertext
    );
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

window.cryptoHelper = new CryptoHelper();
