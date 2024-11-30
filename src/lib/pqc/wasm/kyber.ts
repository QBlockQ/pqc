// WebAssembly module for CRYSTALS-Kyber
import type { EmscriptenModule } from '@types/emscripten';

// Constants for Kyber768 (NIST security level 3)
const KYBER_PUBLICKEYBYTES = 1184;  // Size of public key
const KYBER_SECRETKEYBYTES = 2400;  // Size of private key
const KYBER_CIPHERTEXTBYTES = 1088; // Size of ciphertext
const KYBER_BYTES = 32;             // Size of shared secret

interface KyberModule extends EmscriptenModule {
    _malloc_wrapper: (size: number) => number;
    _free_wrapper: (ptr: number) => void;
    _crypto_kem_keypair: (pk_ptr: number, sk_ptr: number) => number;
    _crypto_kem_enc: (ct_ptr: number, ss_ptr: number, pk_ptr: number) => number;
    _crypto_kem_dec: (ss_ptr: number, ct_ptr: number, sk_ptr: number) => number;
    HEAPU8: Uint8Array;
}

declare global {
    interface Window {
        Module: any;
        createKyberModule: () => Promise<KyberModule>;
    }
}

// Initialize WebAssembly module
let wasmModule: KyberModule | null = null;

export async function initKyber(): Promise<KyberModule> {
    if (wasmModule) return wasmModule;

    try {
        // Load the JavaScript loader
        const script = document.createElement('script');
        script.src = '/static/wasm/kyber.js';
        document.body.appendChild(script);

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });

        // Configure the module
        window.Module = {
            locateFile: (path: string) => {
                if (path.endsWith('.wasm')) {
                    return '/static/wasm/kyber.wasm';
                }
                return path;
            },
            onRuntimeInitialized: () => {
                console.log('Kyber WASM runtime initialized');
            }
        };

        // Wait for the module to be created
        wasmModule = await new Promise((resolve) => {
            const checkModule = () => {
                if (window.Module && window.Module._malloc_wrapper) {
                    resolve(window.Module as KyberModule);
                } else {
                    setTimeout(checkModule, 100);
                }
            };
            checkModule();
        });

        return wasmModule;
    } catch (error) {
        console.error('Failed to initialize Kyber module:', error);
        throw new Error('Failed to initialize Kyber encryption');
    }
}

export class KyberEncryption {
    private static instance: KyberEncryption;
    private module: KyberModule | null = null;

    private constructor() {}

    public static getInstance(): KyberEncryption {
        if (!KyberEncryption.instance) {
            KyberEncryption.instance = new KyberEncryption();
        }
        return KyberEncryption.instance;
    }

    private async ensureInitialized() {
        if (!this.module) {
            this.module = await initKyber();
        }
    }

    public async generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
        await this.ensureInitialized();
        if (!this.module) throw new Error('Module not initialized');

        const publicKeyPtr = this.module._malloc_wrapper(KYBER_PUBLICKEYBYTES);
        const privateKeyPtr = this.module._malloc_wrapper(KYBER_SECRETKEYBYTES);

        try {
            const result = this.module._crypto_kem_keypair(publicKeyPtr, privateKeyPtr);
            if (result !== 0) {
                throw new Error('Failed to generate key pair');
            }

            const publicKey = new Uint8Array(this.module.HEAPU8.buffer, publicKeyPtr, KYBER_PUBLICKEYBYTES);
            const privateKey = new Uint8Array(this.module.HEAPU8.buffer, privateKeyPtr, KYBER_SECRETKEYBYTES);

            return {
                publicKey: new Uint8Array(publicKey),
                privateKey: new Uint8Array(privateKey),
            };
        } finally {
            this.module._free_wrapper(publicKeyPtr);
            this.module._free_wrapper(privateKeyPtr);
        }
    }

    public async encrypt(
        data: ArrayBuffer,
        publicKey: Uint8Array
    ): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }> {
        await this.ensureInitialized();
        if (!this.module) throw new Error('Module not initialized');

        const publicKeyPtr = this.module._malloc_wrapper(KYBER_PUBLICKEYBYTES);
        const ciphertextPtr = this.module._malloc_wrapper(KYBER_CIPHERTEXTBYTES);
        const sharedSecretPtr = this.module._malloc_wrapper(KYBER_BYTES);

        try {
            this.module.HEAPU8.set(publicKey, publicKeyPtr);
            
            const result = this.module._crypto_kem_enc(ciphertextPtr, sharedSecretPtr, publicKeyPtr);
            if (result !== 0) {
                throw new Error('Failed to encrypt data');
            }

            const ciphertext = new Uint8Array(this.module.HEAPU8.buffer, ciphertextPtr, KYBER_CIPHERTEXTBYTES);
            const sharedSecret = new Uint8Array(this.module.HEAPU8.buffer, sharedSecretPtr, KYBER_BYTES);

            return {
                ciphertext: new Uint8Array(ciphertext),
                sharedSecret: new Uint8Array(sharedSecret),
            };
        } finally {
            this.module._free_wrapper(publicKeyPtr);
            this.module._free_wrapper(ciphertextPtr);
            this.module._free_wrapper(sharedSecretPtr);
        }
    }

    public async decrypt(
        ciphertext: Uint8Array,
        privateKey: Uint8Array
    ): Promise<Uint8Array> {
        await this.ensureInitialized();
        if (!this.module) throw new Error('Module not initialized');

        const privateKeyPtr = this.module._malloc_wrapper(KYBER_SECRETKEYBYTES);
        const ciphertextPtr = this.module._malloc_wrapper(KYBER_CIPHERTEXTBYTES);
        const sharedSecretPtr = this.module._malloc_wrapper(KYBER_BYTES);

        try {
            this.module.HEAPU8.set(privateKey, privateKeyPtr);
            this.module.HEAPU8.set(ciphertext, ciphertextPtr);

            const result = this.module._crypto_kem_dec(sharedSecretPtr, ciphertextPtr, privateKeyPtr);
            if (result !== 0) {
                throw new Error('Failed to decrypt data');
            }

            const sharedSecret = new Uint8Array(this.module.HEAPU8.buffer, sharedSecretPtr, KYBER_BYTES);
            return new Uint8Array(sharedSecret);
        } finally {
            this.module._free_wrapper(privateKeyPtr);
            this.module._free_wrapper(ciphertextPtr);
            this.module._free_wrapper(sharedSecretPtr);
        }
    }
}
