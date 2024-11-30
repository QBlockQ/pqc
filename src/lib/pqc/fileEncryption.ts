import { KyberKEM } from './kyber';

export class FileEncryptionService {
  private kyber: KyberKEM;

  constructor() {
    this.kyber = KyberKEM.getInstance();
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
    return await this.kyber.generateKeyPair();
  }

  public async encrypt(file: File, publicKey: Uint8Array): Promise<{ encryptedFile: File; encryptedKey: Uint8Array }> {
    try {
      // Generate AES key for file encryption
      const aesKey = await this.generateAESKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Convert file to ArrayBuffer
      const fileBuffer = await this.fileToArrayBuffer(file);
      
      // Encrypt file with AES key
      const encryptedContent = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        aesKey,
        fileBuffer
      );

      // Export AES key
      const aesKeyBuffer = await this.exportKey(aesKey);
      
      // Encrypt AES key with Kyber
      const { ciphertext } = await this.kyber.encapsulate(publicKey);
      
      // Combine IV and encrypted content
      const encryptedBuffer = new Uint8Array(iv.length + encryptedContent.byteLength);
      encryptedBuffer.set(iv, 0);
      encryptedBuffer.set(new Uint8Array(encryptedContent), iv.length);
      
      // Create encrypted file
      const encryptedFile = await this.arrayBufferToFile(
        encryptedBuffer,
        `${file.name}.encrypted`,
        'application/octet-stream'
      );

      return {
        encryptedFile,
        encryptedKey: ciphertext
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  public async decrypt(encryptedFile: File, encryptedKey: Uint8Array, privateKey: Uint8Array): Promise<File> {
    try {
      // Decrypt the AES key using Kyber
      const decryptedKeyBuffer = await this.kyber.decapsulate(privateKey, encryptedKey);
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
      const originalFileName = encryptedFile.name.replace('.encrypted', '');
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
