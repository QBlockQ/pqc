# Qbits Post-Quantum Cryptography

A modern web application for secure file encryption using post-quantum cryptography algorithms. This project implements Kyber, a lattice-based Key Encapsulation Mechanism (KEM) that is designed to be secure against both classical and quantum computer attacks.

## Version 1.0.1

Current stable release with full encryption and decryption capabilities, featuring the new Quantum-Safe Qbits branding.

## Features

- 🔒 Post-quantum secure file encryption using Kyber
- 🔑 Hybrid encryption combining Kyber KEM with AES-GCM
- 📁 Intuitive drag-and-drop interface for files
- 🎯 Separate tabs for encryption and decryption operations
- 🔄 WebAssembly integration for optimal performance
- 🎨 Modern UI with shadcn/ui components
- 🌓 Light/dark mode with smooth transitions
- 🔔 Toast notifications for user feedback
- ⚡ Built with Next.js for optimal performance

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Post-Quantum Cryptography Implementation

This project includes a TypeScript implementation of the Kyber key encapsulation mechanism integrated with WebAssembly. The current implementation demonstrates the complete encryption workflow:

1. Hybrid encryption system using Kyber for key exchange
2. AES-GCM for file content encryption
3. Secure key encapsulation and decapsulation
4. File integrity protection

### Security Features

- Hybrid encryption combining classical (AES-GCM) and post-quantum (Kyber) algorithms
- Secure key generation and management
- File integrity verification
- Proper error handling and user feedback

## Tech Stack

- Next.js 15.0.3
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI components
- WebAssembly
- Kyber (post-quantum cryptography)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this code for your own projects.

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [Kyber Algorithm](https://pq-crystals.org/kyber/)
- [shadcn/ui Documentation](https://ui.shadcn.com)
