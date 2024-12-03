#!/bin/bash

# Exit on any error
set -e

# Create dist directory if it doesn't exist
mkdir -p dist

# Compile Kyber to WebAssembly
emcc kyber-src/kyber.c \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="['_malloc_wrapper', '_free_wrapper', '_crypto_kem_keypair', '_crypto_kem_enc', '_crypto_kem_dec']" \
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'setValue', 'getValue', 'HEAPU8']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MAXIMUM_MEMORY=33554432 \
    -s NO_EXIT_RUNTIME=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createKyberModule' \
    -s USE_ES6_IMPORT_META=0 \
    -s SINGLE_FILE=0 \
    -s STRICT=1 \
    -s ASSERTIONS=1 \
    -s INCOMING_MODULE_JS_API="['wasmBinary','ENVIRONMENT','onRuntimeInitialized']" \
    -s ENVIRONMENT='web,webview,worker' \
    -o dist/kyber.js

# Copy WASM file to public directory
cp dist/kyber.wasm ../../../../public/

echo "Build complete. WebAssembly module is ready."
