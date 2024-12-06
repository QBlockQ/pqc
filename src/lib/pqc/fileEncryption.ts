import { KyberKEM } from './kyber';

export class FileEncryptionService {
  private kyber: KyberKEM | null = null;
  private initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.initialize();
  }

  private async initialize() {
    try {
      console.log('Initializing FileEncryptionService...');
      this.kyber = await KyberKEM.getInstance();
      console.log('FileEncryptionService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      throw new Error(`Failed to initialize encryption service: ${error.message}`);
    }
  }

  public isReady(): boolean {
    const ready = this.kyber !== null && this.kyber.isInitialized();
    console.log('FileEncryptionService ready state:', ready);
    return ready;
  }

  public async waitForReady(timeout: number = 10000): Promise<void> {
    console.log('Waiting for FileEncryptionService to be ready...');
    try {
      await Promise.race([
        this.initializationPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), timeout))
      ]);
      console.log('FileEncryptionService is now ready');
    } catch (error) {
      console.error('FileEncryptionService initialization failed:', error);
      // Retry initialization
      console.log('Retrying initialization...');
      this.initializationPromise = this.initialize();
      throw error;
    }
  }

  private async ensureInitialized() {
    if (!this.isReady()) {
      console.log('FileEncryptionService not ready, waiting for initialization...');
      await this.waitForReady();
    }
  }

  private async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private async arrayBufferToFile(buffer: ArrayBuffer, fileName: string, type: string): Promise<File> {
    return new File([buffer], fileName, { type });
  }

  private async generateAESKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await window.crypto.subtle.exportKey('raw', key);
  }

  private async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  public async generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    console.log('Generating key pair...');
    await this.ensureInitialized();
    try {
      const keyPair = await this.kyber!.generateKeyPair();
      console.log('Key pair generated successfully');
      return keyPair;
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  public async encrypt(file: File, publicKey: Uint8Array): Promise<{ encryptedFile: File; encryptedKey: Uint8Array }> {
    await this.ensureInitialized();
    try {
      console.log('Starting file encryption process...');
      
      // Generate AES key for file encryption
      console.log('Generating AES key...');
      const aesKey = await this.generateAESKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      console.log('AES key generated successfully');
      
      // Convert file to ArrayBuffer
      console.log('Converting file to ArrayBuffer...');
      const fileBuffer = await this.fileToArrayBuffer(file);
      console.log('File converted to ArrayBuffer, size:', fileBuffer.byteLength);
      
      // Encrypt file with AES key
      console.log('Encrypting file with AES-GCM...');
      const encryptedContent = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        aesKey,
        fileBuffer
      );
      console.log('File encrypted successfully');

      // Export AES key
      console.log('Exporting AES key...');
      const aesKeyBuffer = await this.exportKey(aesKey);
      console.log('AES key exported successfully');
      
      // Encrypt AES key with Kyber
      console.log('Encapsulating key with Kyber...');
      console.log('Public key length:', publicKey.length);
      const { ciphertext } = await this.kyber!.encapsulate(publicKey);
      console.log('Key encapsulated successfully');
      
      // Combine IV and encrypted content
      console.log('Combining IV and encrypted content...');
      const encryptedBuffer = new Uint8Array(iv.length + encryptedContent.byteLength);
      encryptedBuffer.set(iv, 0);
      encryptedBuffer.set(new Uint8Array(encryptedContent), iv.length);
      console.log('Combined successfully');
      
      // Create encrypted file
      console.log('Creating final encrypted file...');
      const encryptedFile = await this.arrayBufferToFile(
        encryptedBuffer,
        `${file.name}.enc`,
        file.type || 'application/octet-stream'
      );
      console.log('Encrypted file created successfully');

      return {
        encryptedFile,
        encryptedKey: ciphertext
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to encrypt file: ${error.message}`);
    }
  }

  public async decrypt(encryptedFile: File, encryptedKey: Uint8Array, privateKey: Uint8Array): Promise<File> {
    await this.ensureInitialized();
    try {
      // Decrypt the AES key using Kyber
      const decryptedKeyBuffer = await this.kyber!.decapsulate(privateKey, encryptedKey);
      const aesKey = await this.importKey(decryptedKeyBuffer);

      // Get encrypted content and IV
      const encryptedBuffer = await this.fileToArrayBuffer(encryptedFile);
      const iv = new Uint8Array(encryptedBuffer.slice(0, 12));
      const encryptedContent = encryptedBuffer.slice(12);

      // Decrypt the file content
      const decryptedContent = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        aesKey,
        encryptedContent
      );

      // Create decrypted file
      const originalFileName = encryptedFile.name.replace('.enc', '');
      return await this.arrayBufferToFile(
        decryptedContent,
        originalFileName,
        'application/octet-stream'
      );
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt file');
    }
  }
}
