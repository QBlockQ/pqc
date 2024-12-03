declare module '*.wasm' {
  const content: string;
  export default content;
}

declare module './wasm/dist/kyber.js' {
  interface KyberModule {
    _malloc_wrapper: (size: number) => number;
    _free_wrapper: (ptr: number) => void;
    _crypto_kem_keypair: (publicKeyPtr: number, privateKeyPtr: number) => number;
    _crypto_kem_enc: (ciphertextPtr: number, sharedSecretPtr: number, publicKeyPtr: number) => number;
    _crypto_kem_dec: (sharedSecretPtr: number, ciphertextPtr: number, privateKeyPtr: number) => number;
    HEAPU8: Uint8Array;
  }

  function createKyberModule(options: {
    locateFile?: (path: string) => string;
    ENVIRONMENT?: string;
  }): Promise<KyberModule>;

  export default createKyberModule;
}
