const DB_NAME = 'callsphere_e2ee_v2';
const STORE_NAME = 'identity_keys';

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadKeyPair(uid: string): Promise<CryptoKeyPair | null> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(uid);
    req.onsuccess = () => resolve((req.result as CryptoKeyPair | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveKeyPair(uid: string, pair: CryptoKeyPair): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(pair, uid);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return view;
}

class E2EEClient {
  private readonly sharedKeyCache = new Map<string, CryptoKey>();
  private readonly pairCache = new Map<string, CryptoKeyPair>();

  async ensureIdentity(uid: string): Promise<JsonWebKey> {
    let pair = this.pairCache.get(uid) ?? (await loadKeyPair(uid));
    if (!pair) {
      pair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey'],
      );
      await saveKeyPair(uid, pair);
    }
    this.pairCache.set(uid, pair);
    return crypto.subtle.exportKey('jwk', pair.publicKey);
  }

  async getSharedKey(myUid: string, peerUid: string, peerPublicJwk: JsonWebKey): Promise<CryptoKey> {
    const keyFingerprint = peerPublicJwk.x ?? '';
    const cacheKey = `${myUid}:${peerUid}:${keyFingerprint}`;
    const cached = this.sharedKeyCache.get(cacheKey);
    if (cached) return cached;

    let pair = this.pairCache.get(myUid) ?? (await loadKeyPair(myUid));
    if (!pair) {
      await this.ensureIdentity(myUid);
      pair = this.pairCache.get(myUid)!;
    }

    const peerKey = await crypto.subtle.importKey(
      'jwk',
      peerPublicJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    const aesKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerKey },
      pair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    this.sharedKeyCache.set(cacheKey, aesKey);
    return aesKey;
  }

  async encryptText(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return {
      ciphertext: toBase64(new Uint8Array(cipherBuf)),
      iv: toBase64(iv),
    };
  }

  async decryptText(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      key,
      fromBase64(ciphertext),
    );
    return new TextDecoder().decode(plainBuf);
  }

  async encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<{ blob: Blob; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return {
      blob: new Blob([cipherBuf], { type: 'application/octet-stream' }),
      iv: toBase64(iv),
    };
  }

  async decryptBytes(key: CryptoKey, encryptedData: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, encryptedData);
  }
}

export const e2eeClient = new E2EEClient();
