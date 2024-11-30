#!/bin/bash

# Ensure Emscripten environment is set up
if [ -z "$EMSDK" ]; then
    echo "Error: Emscripten SDK not found. Please install and activate it first."
    exit 1
fi

# Create output directories if they don't exist
mkdir -p ../dist

# Compile Kyber to WebAssembly
emcc kyber.c \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="['_malloc_wrapper', '_free_wrapper', '_crypto_kem_keypair', '_crypto_kem_enc', '_crypto_kem_dec']" \
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'setValue', 'getValue']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MAXIMUM_MEMORY=33554432 \
    -s NO_EXIT_RUNTIME=1 \
    -s ENVIRONMENT='web' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createKyberModule' \
    -s USE_ES6_IMPORT_META=0 \
    -s SINGLE_FILE=0 \
    -s STRICT=1 \
    -o ../dist/kyber.js

echo "Build complete. WebAssembly module is ready."
