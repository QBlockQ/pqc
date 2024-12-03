const fs = require('fs');
const path = require('path');

// Source WASM file
const sourceWasm = path.join(__dirname, '../src/lib/pqc/wasm/dist/kyber.wasm');
const sourceJs = path.join(__dirname, '../src/lib/pqc/wasm/dist/kyber.js');

// Destination directories
const publicWasmDir = path.join(__dirname, '../public/static/wasm');
const nextWasmDir = path.join(__dirname, '../.next/static/wasm');

// Create directories if they don't exist
[publicWasmDir, nextWasmDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Copy files
[
  { src: sourceWasm, dest: path.join(publicWasmDir, 'kyber.wasm') },
  { src: sourceWasm, dest: path.join(nextWasmDir, 'kyber.wasm') },
  { src: sourceJs, dest: path.join(publicWasmDir, 'kyber.js') },
  { src: sourceJs, dest: path.join(nextWasmDir, 'kyber.js') }
].forEach(({ src, dest }) => {
  try {
    if (!fs.existsSync(src)) {
      console.error(`Source file not found: ${src}`);
      process.exit(1);
    }
    fs.copyFileSync(src, dest);
    console.log(`Copied file from ${src} to ${dest}`);
  } catch (error) {
    console.error(`Failed to copy file from ${src} to ${dest}:`, error);
    process.exit(1);
  }
});
