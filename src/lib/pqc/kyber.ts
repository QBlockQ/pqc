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
  private _isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private static initializationAttempts: number = 0;
  private static readonly MAX_ATTEMPTS = 3;

  private constructor(securityLevel = KYBER_K.KYBER768) {
    this.securityLevel = securityLevel;
    this.initializationPromise = this.initialize();
  }

  public isInitialized(): boolean {
    return this._isInitialized;
  }

  public static async getInstance(securityLevel = KYBER_K.KYBER768): Promise<KyberKEM> {
    if (!KyberKEM.instance) {
      KyberKEM.instance = new KyberKEM(securityLevel);
      try {
        await KyberKEM.instance.initializationPromise;
      } catch (error) {
        console.error('Failed to initialize KyberKEM instance:', error);
        KyberKEM.instance = null;
        throw error;
      }
    }
    return KyberKEM.instance;
  }

  private async initialize(): Promise<void> {
    if (this._isInitialized) return;

    while (KyberKEM.initializationAttempts < KyberKEM.MAX_ATTEMPTS) {
      try {
        console.log(`Initializing Kyber WASM module (attempt ${KyberKEM.initializationAttempts + 1}/${KyberKEM.MAX_ATTEMPTS})...`);
        
        // Try different paths for the WASM file
        const possiblePaths = [
          '/static/wasm/kyber.wasm',
          '/kyber.wasm',
          './static/wasm/kyber.wasm',
          './kyber.wasm'
        ];

        let wasmResponse = null;
        let usedPath = '';

        for (const wasmUrl of possiblePaths) {
          try {
            console.log('Trying to fetch WASM from:', wasmUrl);
            wasmResponse = await fetch(wasmUrl);
            if (wasmResponse.ok) {
              usedPath = wasmUrl;
              break;
            }
          } catch (error) {
            console.log('Failed to fetch from', wasmUrl, ':', error.message);
          }
        }

        if (!wasmResponse?.ok) {
          throw new Error('Failed to fetch WASM file from any known location');
        }

        console.log('Successfully fetched WASM from:', usedPath);
        const wasmBinary = await wasmResponse.arrayBuffer();
        console.log('WASM binary loaded, size:', wasmBinary.byteLength);

        console.log('Creating WASM module...');
        this.wasmModule = await kyberWasm({
          wasmBinary,
          onRuntimeInitialized: () => {
            console.log('Kyber WASM runtime initialized successfully');
            this._isInitialized = true;
          }
        });

        // Wait for initialization with timeout
        const timeout = 5000;
        const startTime = Date.now();
        while (!this._isInitialized && Date.now() - startTime < timeout) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!this._isInitialized) {
          throw new Error('WASM module initialization timeout');
        }

        // Verify the module was loaded correctly
        if (!this.wasmModule._malloc_wrapper || !this.wasmModule._crypto_kem_keypair) {
          throw new Error('WASM module initialization failed: required functions not found');
        }

        console.log('Kyber WASM module initialized successfully');
        return;

      } catch (error) {
        console.error(`Initialization attempt ${KyberKEM.initializationAttempts + 1} failed:`, error);
        KyberKEM.initializationAttempts++;
        
        if (KyberKEM.initializationAttempts >= KyberKEM.MAX_ATTEMPTS) {
          throw new Error(`Failed to initialize Kyber module after ${KyberKEM.MAX_ATTEMPTS} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async ensureInitialized() {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this._isInitialized) {
      throw new Error('Kyber module not initialized');
    }
  }

  // Generate a key pair
  public async generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    await this.ensureInitialized();
    console.log('Generating key pair...');

    // Constants for Kyber768
    const PUBLIC_KEY_SIZE = 1184;  // Size in bytes for Kyber768 public key
    const PRIVATE_KEY_SIZE = 2400; // Size in bytes for Kyber768 private key

    // Allocate memory for keys
    console.log('Allocating memory for keys...');
    const publicKeyPtr = this.wasmModule._malloc_wrapper(PUBLIC_KEY_SIZE);
    const privateKeyPtr = this.wasmModule._malloc_wrapper(PRIVATE_KEY_SIZE);

    if (!publicKeyPtr || !privateKeyPtr) {
      throw new Error('Failed to allocate memory for keys');
    }

    try {
      console.log('Calling crypto_kem_keypair...');
      const result = this.wasmModule._crypto_kem_keypair(publicKeyPtr, privateKeyPtr);
      
      if (result !== 0) {
        throw new Error(`Key generation failed with error code: ${result}`);
      }

      console.log('Creating Uint8Arrays from pointers...');
      const publicKey = new Uint8Array(this.wasmModule.HEAPU8.subarray(publicKeyPtr, publicKeyPtr + PUBLIC_KEY_SIZE));
      const privateKey = new Uint8Array(this.wasmModule.HEAPU8.subarray(privateKeyPtr, privateKeyPtr + PRIVATE_KEY_SIZE));

      // Create copies of the data before freeing memory
      const publicKeyCopy = new Uint8Array(publicKey);
      const privateKeyCopy = new Uint8Array(privateKey);

      console.log('Key pair generated successfully');
      return { publicKey: publicKeyCopy, privateKey: privateKeyCopy };
    } catch (error) {
      console.error('Error in key generation:', error);
      throw error;
    } finally {
      console.log('Freeing memory...');
      if (publicKeyPtr) this.wasmModule._free_wrapper(publicKeyPtr);
      if (privateKeyPtr) this.wasmModule._free_wrapper(privateKeyPtr);
    }
  }

  // Encapsulate a shared secret using a public key
  public async encapsulate(publicKey: Uint8Array): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }> {
    await this.ensureInitialized();

    // Constants for Kyber768
    const SHARED_SECRET_SIZE = 32;   // Size in bytes for shared secret
    const CIPHERTEXT_SIZE = 1088;    // Size in bytes for Kyber768 ciphertext
    const PUBLIC_KEY_SIZE = 1184;    // Size in bytes for Kyber768 public key

    // Allocate memory
    const publicKeyPtr = this.wasmModule._malloc_wrapper(PUBLIC_KEY_SIZE);
    const ciphertextPtr = this.wasmModule._malloc_wrapper(CIPHERTEXT_SIZE);
    const sharedSecretPtr = this.wasmModule._malloc_wrapper(SHARED_SECRET_SIZE);

    if (!publicKeyPtr || !ciphertextPtr || !sharedSecretPtr) {
      throw new Error('Failed to allocate memory for encapsulation');
    }

    try {
      // Copy public key to WASM memory
      this.wasmModule.HEAPU8.set(publicKey, publicKeyPtr);

      // Perform encapsulation
      const result = this.wasmModule._crypto_kem_enc(ciphertextPtr, sharedSecretPtr, publicKeyPtr);
      
      if (result !== 0) {
        throw new Error(`Encapsulation failed with error code: ${result}`);
      }

      // Create copies of the results
      const ciphertext = new Uint8Array(
        this.wasmModule.HEAPU8.subarray(ciphertextPtr, ciphertextPtr + CIPHERTEXT_SIZE)
      );
      const sharedSecret = new Uint8Array(
        this.wasmModule.HEAPU8.subarray(sharedSecretPtr, sharedSecretPtr + SHARED_SECRET_SIZE)
      );

      return {
        ciphertext: new Uint8Array(ciphertext),
        sharedSecret: new Uint8Array(sharedSecret)
      };
    } finally {
      // Free allocated memory
      if (publicKeyPtr) this.wasmModule._free_wrapper(publicKeyPtr);
      if (ciphertextPtr) this.wasmModule._free_wrapper(ciphertextPtr);
      if (sharedSecretPtr) this.wasmModule._free_wrapper(sharedSecretPtr);
    }
  }

  // Decapsulate a shared secret using a private key and ciphertext
  public async decapsulate(privateKey: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    await this.ensureInitialized();

    // Constants for Kyber768
    const SHARED_SECRET_SIZE = 32;   // Size in bytes for shared secret
    const CIPHERTEXT_SIZE = 1088;    // Size in bytes for Kyber768 ciphertext
    const PRIVATE_KEY_SIZE = 2400;   // Size in bytes for Kyber768 private key

    // Allocate memory
    const privateKeyPtr = this.wasmModule._malloc_wrapper(PRIVATE_KEY_SIZE);
    const ciphertextPtr = this.wasmModule._malloc_wrapper(CIPHERTEXT_SIZE);
    const sharedSecretPtr = this.wasmModule._malloc_wrapper(SHARED_SECRET_SIZE);

    if (!privateKeyPtr || !ciphertextPtr || !sharedSecretPtr) {
      throw new Error('Failed to allocate memory for decapsulation');
    }

    try {
      // Copy inputs to WASM memory
      this.wasmModule.HEAPU8.set(privateKey, privateKeyPtr);
      this.wasmModule.HEAPU8.set(ciphertext, ciphertextPtr);

      // Perform decapsulation
      const result = this.wasmModule._crypto_kem_dec(sharedSecretPtr, ciphertextPtr, privateKeyPtr);
      
      if (result !== 0) {
        throw new Error(`Decapsulation failed with error code: ${result}`);
      }

      // Create a copy of the result
      const sharedSecret = new Uint8Array(
        this.wasmModule.HEAPU8.subarray(sharedSecretPtr, sharedSecretPtr + SHARED_SECRET_SIZE)
      );

      return new Uint8Array(sharedSecret);
    } finally {
      // Free allocated memory
      if (privateKeyPtr) this.wasmModule._free_wrapper(privateKeyPtr);
      if (ciphertextPtr) this.wasmModule._free_wrapper(ciphertextPtr);
      if (sharedSecretPtr) this.wasmModule._free_wrapper(sharedSecretPtr);
    }
  }
}
