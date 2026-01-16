import { seckeySigner } from 'rx-nostr-crypto';
import { KeyCache } from './key-cache.js';
import { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';
import type {
  GetPrfSecretOptions,
  KeyCacheOptions,
  KeyOptions,
  NosskeyManagerLike,
  NosskeyManagerOptions,
  NostrEvent,
  NostrKeyInfo,
  NostrKeyStorageOptions,
  PasskeyCreationOptions,
  SignOptions,
} from './types.js';
/**
 * Nosskey class for Passkey-Derived Nostr Identity
 * @packageDocumentation
 */
import { bytesToHex, hexToBytes } from './utils.js';

// salt（"nostr-key" UTF-8）
const STANDARD_SALT = '6e6f7374722d6b6579';

/**
 * Nosskey - Passkey-Derived Nostr Keys
 */
export class NosskeyManager implements NosskeyManagerLike {
  #keyCache: KeyCache;

  // NostrKeyInfo
  #currentKeyInfo: NostrKeyInfo | null = null;

  // NostrKeyInfo
  #storageOptions: NostrKeyStorageOptions = {
    enabled: true,
    storageKey: 'nosskey_keyinfo',
  };

  // PRF
  #prfOptions: GetPrfSecretOptions = {};

  /**
   * NosskeyManager
   * @param options
   */
  constructor(options?: NosskeyManagerOptions) {
    // KeyCache
    this.#keyCache = new KeyCache(options?.cacheOptions);

    if (options?.storageOptions) {
      this.#storageOptions = { ...this.#storageOptions, ...options.storageOptions };
    }

    // option
    const userVerification = options?.prfOptions?.userVerification ?? 'required';
    if (options?.prfOptions) {
      this.#prfOptions = { ...options.prfOptions, userVerification };
    } else {
      this.#prfOptions = { userVerification };
    }

    // NostrKeyInfo
    if (this.#storageOptions.enabled) {
      const loadedKeyInfo = this.#loadKeyInfoFromStorage();
      if (loadedKeyInfo) {
        this.#currentKeyInfo = loadedKeyInfo;
      }
    }
  }

  /**
   * NostrKeyInfo
   * @param options
   */
  setStorageOptions(options: Partial<NostrKeyStorageOptions>): void {
    this.#storageOptions = { ...this.#storageOptions, ...options };

    if (options.enabled === false) {
      this.clearStoredKeyInfo();
    }
  }

  /**
   * NostrKeyInfo
   */
  getStorageOptions(): NostrKeyStorageOptions {
    return { ...this.#storageOptions };
  }

  /**
   * NostrKeyInfo
   * @param keyInfo NostrKeyInfo
   */
  setCurrentKeyInfo(keyInfo: NostrKeyInfo): void {
    this.#currentKeyInfo = keyInfo;

    if (this.#storageOptions.enabled) {
      void this.#saveKeyInfoToStorage(keyInfo);
    }
  }

  /**
   * NostrKeyInfo
   */
  getCurrentKeyInfo(): NostrKeyInfo | null {
    // NostrKeyInfo
    if (!this.#currentKeyInfo && this.#storageOptions.enabled) {
      this.#currentKeyInfo = this.#loadKeyInfoFromStorage();
    }
    return this.#currentKeyInfo;
  }

  /**
   * NostrKeyInfo
   * @returns NostrKeyInfo
   */
  hasKeyInfo(): boolean {
    if (this.#currentKeyInfo) {
      return true;
    }

    if (this.#storageOptions.enabled) {
      const loadedKeyInfo = this.#loadKeyInfoFromStorage();
      if (loadedKeyInfo) {
        this.#currentKeyInfo = loadedKeyInfo;
        return true;
      }
    }

    return false;
  }

  /**
   * NostrKeyInfo
   * @param keyInfo NostrKeyInfo
   */
  async #saveKeyInfoToStorage(keyInfo: NostrKeyInfo): Promise<void> {
    if (!this.#storageOptions.enabled) return;

    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return;

    const key = this.#storageOptions.storageKey || 'nosskey_keyinfo';
    storage.setItem(key, JSON.stringify(keyInfo));
  }

  /**
   * NostrKeyInfo
   */
  #loadKeyInfoFromStorage(): NostrKeyInfo | null {
    if (!this.#storageOptions.enabled) return null;

    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return null;

    const key = this.#storageOptions.storageKey || 'nosskey_keyinfo';
    const data = storage.getItem(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as NostrKeyInfo;
    } catch (e) {
      console.error('Failed to parse stored NostrKeyInfo', e);
      return null;
    }
  }

  /**
   * NostrKeyInfo
   */
  clearStoredKeyInfo(): void {
    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return;

    const key = this.#storageOptions.storageKey || 'nosskey_keyinfo';
    storage.removeItem(key);

    // NostrKeyInfo
    this.#currentKeyInfo = null;
  }

  /**
   * NIP-07
   * NostrKeyInfo
   */
  async getPublicKey(): Promise<string> {
    const keyInfo = this.getCurrentKeyInfo();
    if (!keyInfo) {
      throw new Error('No current NostrKeyInfo set');
    }
    return keyInfo.pubkey;
  }

  /**
   * NIP-07
   * NostrKeyInfo
   * @param event Nostr
   */
  async signEvent(event: NostrEvent): Promise<NostrEvent> {
    const keyInfo = this.getCurrentKeyInfo();
    if (!keyInfo) {
      throw new Error('No current NostrKeyInfo set');
    }
    return this.signEventWithKeyInfo(event, keyInfo);
  }

  /**
   * @param options
   */
  setCacheOptions(options: Partial<KeyCacheOptions>): void {
    this.#keyCache.setCacheOptions(options);
  }

  getCacheOptions(): KeyCacheOptions {
    return this.#keyCache.getCacheOptions();
  }

  /**
   * @param credentialId
   */
  clearCachedKey(credentialId: Uint8Array | string): void {
    this.#keyCache.clearCachedKey(credentialId);
  }

  clearAllCachedKeys(): void {
    this.#keyCache.clearAllCachedKeys();
  }

  /**
   * @param options
   * @returns Credential
   */
  async createPasskey(options: PasskeyCreationOptions = {}): Promise<Uint8Array> {
    return createPasskey({
      rp: {
        id: this.#prfOptions.rpId,
        name: this.#prfOptions.rpId,
      },
      authenticatorSelection: {
        userVerification: this.#prfOptions.userVerification,
      },
      ...options,
    });
  }

  /**
   * PRF NostrKeyInfo
   * @param credentialId
   * @param options
   */
  async createNostrKey(credentialId?: Uint8Array, options: KeyOptions = {}): Promise<NostrKeyInfo> {
    const { secret: sk, id: responseId } = await getPrfSecret(credentialId, this.#prfOptions);

    // secp256k1
    if (sk.every((byte) => byte === 0)) {
      throw new Error('Invalid PRF output: all zeros');
    }

    // HEX
    const skHex = bytesToHex(sk);

    // rx-nostr-crypto
    const signer = seckeySigner(skHex);
    const publicKey = await signer.getPublicKey();

    // NostrKeyInfo
    const keyInfo: NostrKeyInfo = {
      credentialId: bytesToHex(credentialId || responseId),
      pubkey: publicKey,
      salt: STANDARD_SALT, // salt
      ...(options.username && { username: options.username }), // username
    };

    // Cache the secret key so subsequent signEvent() calls don't require biometric
    if (this.#keyCache.isEnabled()) {
      this.#keyCache.setKey(keyInfo.credentialId, sk);
    }

    return keyInfo;
  }

  /**
   * @param event Nostr
   * @param keyInfo NostrKeyInfo
   * @param options
   */
  async signEventWithKeyInfo(
    event: NostrEvent,
    keyInfo: NostrKeyInfo,
    options: SignOptions = {}
  ): Promise<NostrEvent> {
    const { clearMemory = true, tags } = options;

    const shouldUseCache = this.#keyCache.isEnabled();

    let sk: Uint8Array | undefined;

    if (shouldUseCache) {
      sk = this.#keyCache.getKey(keyInfo.credentialId);
    }

    if (!sk) {
      const { secret: prfSecret } = await getPrfSecret(
        hexToBytes(keyInfo.credentialId),
        this.#prfOptions
      );
      sk = prfSecret;

      if (shouldUseCache) {
        this.#keyCache.setKey(keyInfo.credentialId, sk);
      }
    }

    const skHex = bytesToHex(sk);

    // rx-nostr-crypto seckeySigner
    const signer = seckeySigner(skHex, { tags });
    const signedEvent = await signer.signEvent(event);

    // clearMemory=true
    if (!shouldUseCache && clearMemory) {
      this.#clearKey(sk);
    }

    return signedEvent;
  }

  /**
   * @param keyInfo NostrKeyInfo
   * @param credentialId NostrKeyInfoのcredentialId
   * @param options
   * @returns 
   */
  async exportNostrKey(keyInfo: NostrKeyInfo, credentialId?: Uint8Array): Promise<string> {
    // NostrKeyInfo credentialId
    let usedCredentialId = credentialId;

    // credentialId NostrKeyInfo
    if (!usedCredentialId && keyInfo.credentialId) {
      usedCredentialId = hexToBytes(keyInfo.credentialId);
    }

    // PRF
    const { secret: sk } = await getPrfSecret(usedCredentialId, this.#prfOptions);

    // HEX
    const skHex = bytesToHex(sk);

    return skHex;
  }

  /**
   * PRF
   */
  async isPrfSupported(): Promise<boolean> {
    return isPrfSupported();
  }

  /**
   * @param key
   */
  #clearKey(key: Uint8Array): void {
    key?.fill?.(0);
  }
}
