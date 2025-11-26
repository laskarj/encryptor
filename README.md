# Encryptor

A small client-side utility for password-based text encryption and decryption in the browser. It uses the Web Crypto API (AES-GCM) with keys derived from your password via PBKDF2 (SHA-256, 200k iterations). Nothing is sent to a server—everything happens locally.

## How Encryption Works Here

- **Key derivation:** Your password is turned into a 256-bit AES key using PBKDF2 with a random 16-byte salt and 200,000 iterations of SHA-256. The salt is bundled with the output so the same key can be regenerated during decryption.
- **Nonce generation:** A fresh 12-byte nonce (initialization vector) is generated for every encryption to keep ciphertexts unique even if the same password/plaintext is reused.
- **AES-GCM encryption:** The plaintext is encoded (UTF-8), then encrypted with AES-GCM using the derived key and nonce. AES-GCM produces both ciphertext and an authentication tag to detect tampering.
- **Output format:** The app concatenates `salt | nonce | ciphertext+tag` and renders the result as a hexadecimal string for easy copying and storage.

## How Decryption Works Here

- **Input parsing:** The provided hex string is parsed back into bytes. It must include at least the 16-byte salt and 12-byte nonce; otherwise, the app raises a payload format error.
- **Key recreation:** Using the extracted salt and your password, the same PBKDF2 parameters regenerate the AES-GCM key.
- **AES-GCM decryption:** The nonce and ciphertext+tag are fed to AES-GCM. If the password is wrong or the data was altered, decryption fails with an authentication error.
- **Plaintext recovery:** On success, the original UTF-8 text is returned to the output box. The app never persists data.

## Using the App

1. Open `index.html` in a modern browser (Web Crypto and Clipboard API support required).
2. Enter a strong password—this is the basis for the encryption key. It cannot be recovered if lost.
3. Pick a mode:
   - **Encrypt:** Type or paste plaintext; click **Encrypt Text** to get the hex payload (`salt | nonce | ciphertext+tag`).
   - **Decrypt:** Paste a previously produced hex payload; click **Decrypt Text** to recover the original text.
4. Use **Copy** to place the result on your clipboard. **Clear** resets the input area.

## Validation and Errors

- **Invalid hex input:** Triggered when the ciphertext field contains non-hex characters or an odd number of characters.
- **Invalid data format:** Raised when the payload is too short to include salt and nonce or contains no ciphertext.
- **Decryption failed:** Appears when authentication fails—commonly a wrong password or corrupted/edited payload.

## Notes and Caveats

- Security depends on password strength; choose long, unique passphrases.
- The salt and nonce are safe to store/transmit; never reuse the ciphertext with a different password.
- The app runs entirely in-browser; refreshes or tab closes clear all data.
