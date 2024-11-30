# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2024-01-17

### Changed
- Updated application branding with new Quantum-Safe Qbits logo
- Improved UI with better icon choices for encryption/decryption operations
- Enhanced logo visibility in both light and dark modes

## [1.0.0] - 2024-01-17

### Added
- Initial release of Qbits Post-Quantum Cryptography application
- Modern UI with light/dark mode support using shadcn/ui components
- Drag-and-drop file upload interface
- Hybrid encryption system using Kyber for key exchange and AES for file encryption
- File encryption and decryption functionality
- Toast notifications for user feedback
- Tabs interface for separating encryption and decryption operations
- Theme toggle for switching between light and dark modes
- WebAssembly integration for Kyber algorithm (placeholder implementation)

### Technical Features
- Built with Next.js 15.0.3
- Implemented using TypeScript for type safety
- Responsive design using Tailwind CSS
- Component library based on shadcn/ui and Radix UI
- Post-quantum cryptography using Kyber algorithm
- Hybrid encryption with AES-GCM for file content
- WebAssembly module structure for future Kyber implementation
