'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileEncryptionService } from '@/lib/pqc/fileEncryption';
import { Lock, Unlock, Key } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from 'next/image';

export default function Home() {
  const [encryptFile, setEncryptFile] = useState<File | null>(null);
  const [decryptFile, setDecryptFile] = useState<File | null>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  const [encryptedKeyFile, setEncryptedKeyFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [encryptionService, setEncryptionService] = useState<FileEncryptionService | null>(null);
  const [serviceReady, setServiceReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const initService = async () => {
      try {
        console.log('Creating FileEncryptionService...');
        const service = new FileEncryptionService();
        setEncryptionService(service);

        console.log('Waiting for service to be ready...');
        await service.waitForReady();
        console.log('Service is ready');
        setServiceReady(true);
      } catch (error) {
        console.error('Failed to initialize encryption service:', error);
        toast({
          title: "Initialization Error",
          description: "Failed to initialize encryption service. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    initService();
  }, [toast]);

  const onEncryptDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setEncryptFile(acceptedFiles[0]);
      toast({
        title: "File selected for encryption",
        description: `${acceptedFiles[0].name} (${(acceptedFiles[0].size / 1024 / 1024).toFixed(2)} MB)`,
      });
    }
  }, [toast]);

  const onDecryptDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setDecryptFile(acceptedFiles[0]);
      toast({
        title: "File selected for decryption",
        description: `${acceptedFiles[0].name} (${(acceptedFiles[0].size / 1024 / 1024).toFixed(2)} MB)`,
      });
    }
  }, [toast]);

  const onPrivateKeyDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setPrivateKeyFile(acceptedFiles[0]);
      toast({
        title: "Private key file selected",
        description: `${acceptedFiles[0].name} (${(acceptedFiles[0].size / 1024 / 1024).toFixed(2)} MB)`,
      });
    }
  }, [toast]);

  const onEncryptedKeyDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setEncryptedKeyFile(acceptedFiles[0]);
      toast({
        title: "Encrypted key file selected",
        description: `${acceptedFiles[0].name}`,
      });
    }
  }, [toast]);

  const { getRootProps: getEncryptRootProps, getInputProps: getEncryptInputProps, isDragActive: isEncryptDragActive } = useDropzone({
    onDrop: onEncryptDrop,
    multiple: false
  });

  const { getRootProps: getDecryptRootProps, getInputProps: getDecryptInputProps, isDragActive: isDecryptDragActive } = useDropzone({
    onDrop: onDecryptDrop,
    multiple: false
  });

  const { getRootProps: getKeyRootProps, getInputProps: getKeyInputProps, isDragActive: isKeyDragActive } = useDropzone({
    onDrop: onPrivateKeyDrop,
    multiple: false,
    accept: {
      'application/x-pem-file': ['.pem', '.key'],
      'application/octet-stream': ['.key']
    }
  });

  const { getRootProps: getEncryptedKeyRootProps, getInputProps: getEncryptedKeyInputProps, isDragActive: isEncryptedKeyDragActive } = useDropzone({
    onDrop: onEncryptedKeyDrop,
    multiple: false,
    accept: {
      'application/octet-stream': ['.key']
    }
  });

  const handleEncrypt = async () => {
    if (!encryptFile || !encryptionService || !serviceReady) {
      toast({
        title: "Error",
        description: "Please select a file to encrypt and wait for the encryption service to initialize.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      console.log('Encryption service ready, generating keys...');
      toast({
        title: "Generating keys",
        description: "Please wait while we generate post-quantum cryptographic keys...",
      });

      // Generate key pair
      const keyPair = await encryptionService.generateKeyPair();
      console.log('Key pair generated successfully');

      toast({
        title: "Encrypting file",
        description: "Please wait while we encrypt your file using post-quantum cryptography...",
      });

      console.log('Starting file encryption...');
      const result = await encryptionService.encrypt(encryptFile, keyPair.publicKey);
      console.log('File encrypted successfully');
      
      // Download encrypted file first
      console.log('Creating download for encrypted file...');
      const encryptedUrl = URL.createObjectURL(result.encryptedFile);
      const encryptedLink = document.createElement('a');
      encryptedLink.href = encryptedUrl;
      encryptedLink.download = result.encryptedFile.name;
      document.body.appendChild(encryptedLink);
      encryptedLink.click();
      document.body.removeChild(encryptedLink);
      URL.revokeObjectURL(encryptedUrl);

      // Save private key as a file
      console.log('Creating download for private key...');
      const privateKeyBlob = new Blob([keyPair.privateKey], { type: 'application/octet-stream' });
      const privateKeyUrl = URL.createObjectURL(privateKeyBlob);
      const privateKeyLink = document.createElement('a');
      privateKeyLink.href = privateKeyUrl;
      privateKeyLink.download = `${encryptFile.name}.private.key`;
      document.body.appendChild(privateKeyLink);
      privateKeyLink.click();
      document.body.removeChild(privateKeyLink);
      URL.revokeObjectURL(privateKeyUrl);

      // Save encrypted key as a file
      console.log('Creating download for encrypted key...');
      const encryptedKeyBlob = new Blob([result.encryptedKey], { type: 'application/octet-stream' });
      const encryptedKeyUrl = URL.createObjectURL(encryptedKeyBlob);
      const encryptedKeyLink = document.createElement('a');
      encryptedKeyLink.href = encryptedKeyUrl;
      encryptedKeyLink.download = `${encryptFile.name}.encrypted.key`;
      document.body.appendChild(encryptedKeyLink);
      encryptedKeyLink.click();
      document.body.removeChild(encryptedKeyLink);
      URL.revokeObjectURL(encryptedKeyUrl);
      
      setEncryptFile(null);
      toast({
        title: "Encryption complete",
        description: "Your file has been encrypted and downloaded along with the private key and encrypted key.",
      });
    } catch (error) {
      console.error('Encryption failed:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      
      // Try to get more information about the encryption service state
      try {
        const isReady = encryptionService.isReady();
        console.log('Encryption service ready state:', isReady);
      } catch (e) {
        console.error('Failed to check encryption service state:', e);
      }

      toast({
        title: "Encryption failed",
        description: `Error: ${error.message}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecrypt = async () => {
    if (!decryptFile || !privateKeyFile || !encryptedKeyFile || !encryptionService || !serviceReady) return;
    
    setProcessing(true);
    try {
      toast({
        title: "Reading keys",
        description: "Please wait while we read the cryptographic keys...",
      });

      // Read private key file
      const privateKeyArrayBuffer = await privateKeyFile.arrayBuffer();
      const privateKey = new Uint8Array(privateKeyArrayBuffer);

      // Read encrypted key file
      const encryptedKeyArrayBuffer = await encryptedKeyFile.arrayBuffer();
      const encryptedKey = new Uint8Array(encryptedKeyArrayBuffer);

      toast({
        title: "Decrypting file",
        description: "Please wait while we decrypt your file...",
      });

      const decryptedFile = await encryptionService.decrypt(decryptFile, encryptedKey, privateKey);
      
      // Create download link for decrypted file
      const url = URL.createObjectURL(decryptedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = decryptedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setDecryptFile(null);
      setPrivateKeyFile(null);
      setEncryptedKeyFile(null);
      toast({
        title: "Decryption complete",
        description: "Your file has been decrypted and downloaded.",
      });
    } catch (error) {
      console.error('Decryption failed:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      
      // Try to get more information about the encryption service state
      try {
        const isReady = encryptionService.isReady();
        console.log('Encryption service ready state:', isReady);
      } catch (e) {
        console.error('Failed to check encryption service state:', e);
      }

      toast({
        title: "Decryption failed",
        description: `Error: ${error.message}. Please make sure you have the correct private key and encrypted key.`,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  interface FileDropzoneProps {
    getRootProps: ReturnType<typeof useDropzone>['getRootProps'];
    getInputProps: ReturnType<typeof useDropzone>['getInputProps'];
    isDragActive: boolean;
    file: File | null;
    icon: React.ElementType;
    text: string;
    onFileSelect: (file: File | null) => void;
    accept?: string;
  }

  const FileDropzone = ({ 
    getRootProps, 
    getInputProps, 
    isDragActive: _isDragActive, 
    file, 
    icon: Icon, 
    text, 
    onFileSelect, 
    accept = '*/*' 
  }: FileDropzoneProps) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = React.useState(false);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
      if (file && file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setObjectUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      }
    }, [file]);

    return (
      <div
        {...getRootProps()}
        className={`relative rounded-lg border-2 border-dashed border-gray-300 p-6 transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : ''
        }`}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
      >
        <input {...getInputProps()} ref={fileInputRef} accept={accept} />
        <div className="flex flex-col items-center justify-center gap-4">
          <Icon className={`w-8 h-8 ${dragActive ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
          {file ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {file.type.startsWith('image/') && objectUrl && (
                <div className="relative w-32 h-32 mx-auto mt-2 rounded-lg overflow-hidden border border-border">
                  <Image
                    src={objectUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Change File
              </Button>
            </div>
          ) : dragActive ? (
            <p className="text-primary font-medium">Drop your file here</p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">{text}</p>
              <p className="text-sm text-muted-foreground">Drag & drop or click anywhere to browse</p>
              <Button 
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Browse Files
              </Button>
            </div>
          )}
        </div>
        {file && (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              className="mt-4"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                onFileSelect(null);
              }}
            >
              Remove File
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex flex-col items-center justify-center mb-8 text-center">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Image
            src="/postquantum.png"
            alt="Post Quantum Cryptography"
            width={540}
            height={540}
            priority={true}
            className="max-w-full h-auto mb-8"
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Qbits Post-Quantum Cryptography
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl">
          Secure your files using post-quantum cryptography. Drag and drop any file to encrypt or decrypt it using the Kyber algorithm.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-6 h-6" />
            Quantum-Safe File Encryption
          </CardTitle>
          <CardDescription>
            Secure your files using post-quantum cryptography (Kyber) - protecting against both classical and quantum computer attacks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="encrypt" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="encrypt">Encrypt File</TabsTrigger>
              <TabsTrigger value="decrypt">Decrypt File</TabsTrigger>
            </TabsList>
            
            <TabsContent value="encrypt" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Encrypt File</CardTitle>
                    <CardDescription>
                      Upload a file to encrypt it using post-quantum cryptography. You will receive an encrypted file, a private key for decryption, and an encrypted key.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div {...getEncryptRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isEncryptDragActive ? 'border-primary bg-secondary/50' : 'border-border hover:border-primary hover:bg-secondary/25'}`}>
                      <input {...getEncryptInputProps()} />
                      <p>{encryptFile ? `Selected: ${encryptFile.name}` : 'Drop file here or click to select'}</p>
                    </div>

                    <Button 
                      onClick={handleEncrypt} 
                      className="w-full" 
                      disabled={!encryptFile || processing || !serviceReady}
                    >
                      {processing ? (
                        <>
                          <Lock className="mr-2 h-4 w-4 animate-spin" />
                          Encrypting...
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Encrypt File
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="decrypt" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Decrypt File</CardTitle>
                    <CardDescription>
                      Upload an encrypted file, the private key, and the encrypted key to decrypt your file.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div {...getDecryptRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDecryptDragActive ? 'border-primary bg-secondary/50' : 'border-border hover:border-primary hover:bg-secondary/25'}`}>
                      <input {...getDecryptInputProps()} />
                      <p>{decryptFile ? `Selected: ${decryptFile.name}` : 'Drop encrypted file here or click to select'}</p>
                    </div>

                    <div {...getKeyRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isKeyDragActive ? 'border-primary bg-secondary/50' : 'border-border hover:border-primary hover:bg-secondary/25'}`}>
                      <input {...getKeyInputProps()} />
                      <p>{privateKeyFile ? `Selected: ${privateKeyFile.name}` : 'Drop private key file here or click to select'}</p>
                    </div>

                    <div {...getEncryptedKeyRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isEncryptedKeyDragActive ? 'border-primary bg-secondary/50' : 'border-border hover:border-primary hover:bg-secondary/25'}`}>
                      <input {...getEncryptedKeyInputProps()} />
                      <p>{encryptedKeyFile ? `Selected: ${encryptedKeyFile.name}` : 'Drop encrypted key file here or click to select'}</p>
                    </div>

                    <Button 
                      onClick={handleDecrypt} 
                      className="w-full" 
                      disabled={!decryptFile || !privateKeyFile || !encryptedKeyFile || processing || !serviceReady}
                    >
                      {processing ? (
                        <>
                          <Unlock className="mr-2 h-4 w-4 animate-spin" />
                          Decrypting...
                        </>
                      ) : (
                        <>
                          <Unlock className="mr-2 h-4 w-4" />
                          Decrypt File
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
