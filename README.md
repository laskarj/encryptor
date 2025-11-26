# AES Encryptor (Browser-only)

A single-page tool to encrypt and decrypt text in your browser using the Web Crypto API. No data leaves the page.

## Features
- Mode-first flow with a pill toggle for Encrypt / Decrypt and animated panel transitions.
- AES-GCM encryption with PBKDF2 (SHA-256, 200k iterations).
- Password strength indicator (segmented bar), show/hide toggle, and inline status messages.
- Copy-to-clipboard for encrypted and decrypted outputs.
- Mobile-friendly responsive layout using Tailwind utility classes.

## Usage
1. Choose a mode (Encrypt or Decrypt) via the pill toggle.
2. Enter a strong password (12+ chars recommended). The strength hint updates as you type.
3. For Encrypt: type or paste plaintext, click **Encrypt**, then copy the Base64 output.
4. For Decrypt: paste the Base64 payload, click **Decrypt**, and read the plaintext.
5. Use the **Copy** buttons to quickly copy outputs. Nothing is stored or sent anywhere.

## Crypto Format
- Payload: `Base64(salt16 | nonce12 | ciphertext+tag)`
- Salt: 16 bytes random.
- Nonce (IV): 12 bytes random.
- Auth tag is included with the ciphertext by AES-GCM.

## Browser Support
- Uses the Web Crypto API; requires a secure context (HTTPS). GitHub Pages provides HTTPS by default.
- Clipboard API may prompt for permission.

## Deployment (GitHub Pages)
- Static assets only; no build step required.
- Serve from the repository root on the main branch (default GitHub Pages configuration).

## Notes
- Passwords are never stored. If you lose your password, data cannot be recovered.
