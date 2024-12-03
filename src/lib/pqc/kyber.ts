// Import the Kyber WASM module
import kyberWasm from './wasm/dist/kyber.js';

// Kyber parameters for different security levels
export const KYBER_K = {
  KYBER512: 2,
  KYBER768: 3,
  KYBER1024: 4,
};

// Kyber implementation using WebAssembly
export class KyberKEM {
  private static instance: KyberKEM;
  private securityLevel: number;
  private wasmModule: any;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor(securityLevel = KYBER_K.KYBER768) {
    this.securityLevel = securityLevel;
    this.initializationPromise = this.initialize();
  }

  public static getInstance(securityLevel = KYBER_K.KYBER768): KyberKEM {
    if (!KyberKEM.instance) {
      KyberKEM.instance = new KyberKEM(securityLevel);
    }
    return KyberKEM.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('Initializing Kyber WASM module...');
      
      // Configure the module
      const wasmUrl = '/kyber.wasm';
      const wasmResponse = await fetch(wasmUrl);
      if (!wasmResponse.ok) {
        throw new Error(`Failed to fetch WASM file: ${wasmResponse.status} ${wasmResponse.statusText}`);
      }

      const wasmBinary = await wasmResponse.arrayBuffer();
      
      this.wasmModule = await kyberWasm({
        wasmBinary,
        onRuntimeInitialized: () => {
          console.log('Kyber WASM runtime initialized successfully');
        }
      });
      
      // Verify the module was loaded correctly
      if (!this.wasmModule._malloc_wrapper || !this.wasmModule._crypto_kem_keypair) {
        throw new Error('WASM module initialization failed: required functions not found');
      }

      this.isInitialized = true;
      console.log('Kyber WASM module initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Kyber module:', error);
      throw error;
    }
  }

  private async ensureInitialized() {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this.isInitialized) {
      throw new Error('Kyber module not initialized');
    }
  }

  // Generate a key pair
  public async generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    await this.ensureInitialized();
    
    try {
      console.log('Generating key pair...');
      
      console.log('Allocating memory for keys...');
      const publicKeyPtr = this.wasmModule._malloc_wrapper(this.securityLevel * 384);
      const privateKeyPtr = this.wasmModule._malloc_wrapper(this.securityLevel * 384);
      
      try {
        console.log('Calling crypto_kem_keypair...');
        const result = this.wasmModule._crypto_kem_keypair(publicKeyPtr, privateKeyPtr);
        if (result !== 0) {
          throw new Error('Failed to generate key pair');
        }

        console.log('Creating Uint8Arrays from pointers...');
        const publicKey = new Uint8Array(this.wasmModule.HEAPU8.buffer, publicKeyPtr, this.securityLevel * 384);
        const privateKey = new Uint8Array(this.wasmModule.HEAPU8.buffer, privateKeyPtr, this.securityLevel * 384);

        console.log('Key pair generated successfully');
        return {
          publicKey: new Uint8Array(publicKey),
          privateKey: new Uint8Array(privateKey),
        };
      } finally {
        console.log('Freeing memory...');
        this.wasmModule._free_wrapper(publicKeyPtr);
        this.wasmModule._free_wrapper(privateKeyPtr);
      }
    } catch (error) {
      console.error('Error in generateKeyPair:', error);
      throw error;
    }
  }

  // Encapsulate a shared secret using a public key
  public async encapsulate(publicKey: Uint8Array): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }> {
    await this.ensureInitialized();
    
    const publicKeyPtr = this.wasmModule._malloc_wrapper(this.securityLevel * 384);
    const ciphertextPtr = this.wasmModule._malloc_wrapper(this.securityLevel * 736);
    const sharedSecretPtr = this.wasmModule._malloc_wrapper(32);
    
    try {
      this.wasmModule.HEAPU8.set(publicKey, publicKeyPtr);
      
      const result = this.wasmModule._crypto_kem_enc(ciphertextPtr, sharedSecretPtr, publicKeyPtr);
      if (result !== 0) {
        throw new Error('Failed to encapsulate shared secret');
      }

      const ciphertext = new Uint8Array(this.wasmModule.HEAPU8.buffer, ciphertextPtr, this.securityLevel * 736);
      const sharedSecret = new Uint8Array(this.wasmModule.HEAPU8.buffer, sharedSecretPtr, 32);

      return {
        ciphertext: new Uint8Array(ciphertext),
        sharedSecret: new Uint8Array(sharedSecret),
      };
    } finally {
      this.wasmModule._free_wrapper(publicKeyPtr);
      this.wasmModule._free_wrapper(ciphertextPtr);
      this.wasmModule._free_wrapper(sharedSecretPtr);
    }
  }

  // Decapsulate a shared secret using a private key and ciphertext
  public async decapsulate(privateKey: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    await this.ensureInitialized();
    
    const privateKeyPtr = this.wasmModule._malloc_wrapper(this.securityLevel * 384);
    const ciphertextPtr = this.wasmModule._malloc_wrapper(this.securityLevel * 736);
    const sharedSecretPtr = this.wasmModule._malloc_wrapper(32);
    
    try {
      this.wasmModule.HEAPU8.set(privateKey, privateKeyPtr);
      this.wasmModule.HEAPU8.set(ciphertext, ciphertextPtr);
      
      const result = this.wasmModule._crypto_kem_dec(sharedSecretPtr, ciphertextPtr, privateKeyPtr);
      if (result !== 0) {
        throw new Error('Failed to decapsulate shared secret');
      }

      const sharedSecret = new Uint8Array(this.wasmModule.HEAPU8.buffer, sharedSecretPtr, 32);
      return new Uint8Array(sharedSecret);
    } finally {
      this.wasmModule._free_wrapper(privateKeyPtr);
      this.wasmModule._free_wrapper(ciphertextPtr);
      this.wasmModule._free_wrapper(sharedSecretPtr);
    }
  }
}
