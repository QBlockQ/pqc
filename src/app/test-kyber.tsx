'use client';

import { useEffect, useState } from 'react';
import { KyberKEM } from '@/lib/pqc/kyber';

export default function TestKyber() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testKyber() {
      try {
        setStatus('Creating Kyber instance...');
        const kyber = KyberKEM.getInstance();

        setStatus('Generating key pair...');
        const { publicKey, privateKey } = await kyber.generateKeyPair();

        setStatus('Key pair generated successfully!');
        console.log('Public key length:', publicKey.length);
        console.log('Private key length:', privateKey.length);
      } catch (err) {
        console.error('Error testing Kyber:', err);
        setError(err.message);
        setStatus('Failed');
      }
    }

    testKyber();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Kyber Test</h1>
      <div className="mb-4">
        <strong>Status:</strong> {status}
      </div>
      {error && (
        <div className="text-red-500">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
