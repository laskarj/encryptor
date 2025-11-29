# Encryptor

A small client-side utility for password-based text encryption and decryption in the browser. It uses the Web Crypto API (AES-CTR) with keys derived from your password via PBKDF2 (SHA-256, 200k iterations). To minimize output size, text is compressed (Deflate) before encryption. Nothing is sent to a server—everything happens locally.

## How Encryption Works Here

- **Compression:** The input text is first compressed using the Deflate algorithm (raw) to reduce the payload size.
- **Key derivation & IV:** A random 16-byte value is generated. This serves as both the salt for PBKDF2 (to derive the 256-bit AES key) and the initial counter block (IV) for AES-CTR.
- **AES-CTR encryption:** The compressed data is encrypted with AES-CTR using the derived key and the generated IV.
- **Output format:** The app concatenates `saltIv | ciphertext` and encodes the result as a Base64Url string (URL-safe, no padding) for compact storage.

## How Decryption Works Here

- **Input parsing:** The provided Base64Url string is decoded back into bytes. It must include at least the 16-byte salt/IV.
- **Key recreation:** Using the extracted salt/IV and your password, the AES-CTR key is regenerated via PBKDF2.
- **AES-CTR decryption:** The ciphertext is decrypted using the derived key and the salt/IV as the counter block.
- **Decompression:** The decrypted bytes are decompressed (Deflate) to recover the original UTF-8 text.

## Using the App

1. Open `index.html` in a modern browser (Web Crypto and Compression Streams API support required).
2. Enter a strong password—this is the basis for the encryption key. It cannot be recovered if lost.
3. Pick a mode:
   - **Encrypt:** Type or paste plaintext; click **Encrypt Text** to get the Base64Url payload.
   - **Decrypt:** Paste a previously produced Base64Url payload; click **Decrypt Text** to recover the original text.
4. Use **Copy** to place the result on your clipboard. **Clear** resets the input area.

## Validation and Errors

- **Invalid Base64Url input:** Triggered when the ciphertext field contains invalid characters.
- **Decryption failed:** Appears when the password is wrong or the data is corrupted (AES-CTR does not provide integrity checks like GCM, but decompression will likely fail if data is garbage).

## Notes and Caveats

- Security depends on password strength; choose long, unique passphrases.
- The output is URL-safe and compact, making it ideal for query parameters or limited-length fields.
- The app runs entirely in-browser; refreshes or tab closes clear all data.
