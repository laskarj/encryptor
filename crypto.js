const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const MIN_PAYLOAD_BYTES = SALT_LENGTH + NONCE_LENGTH;
const ITERATIONS = 200000;

class InvalidBase64Error extends Error {
  constructor(message = 'Invalid Base64 input.') {
    super(message);
    this.name = 'InvalidBase64Error';
  }
}

class PayloadFormatError extends Error {
  constructor(message = 'Payload is incomplete or malformed.') {
    super(message);
    this.name = 'PayloadFormatError';
  }
}

class DecryptFailedError extends Error {
  constructor(message = 'Unable to decrypt. Check your password or payload.') {
    super(message);
    this.name = 'DecryptFailedError';
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str) {
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    throw new InvalidBase64Error();
  }
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(password, plaintext) {
  if (!password) {
    throw new Error('Password is required.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    encoder.encode(plaintext ?? '')
  );

  const payload = new Uint8Array(SALT_LENGTH + NONCE_LENGTH + ciphertext.byteLength);
  payload.set(salt, 0);
  payload.set(nonce, SALT_LENGTH);
  payload.set(new Uint8Array(ciphertext), SALT_LENGTH + NONCE_LENGTH);

  return toBase64(payload);
}

export async function decryptText(password, payloadBase64) {
  if (!password) {
    throw new Error('Password is required.');
  }

  const payload = fromBase64(payloadBase64.trim());
  if (payload.byteLength < MIN_PAYLOAD_BYTES) {
    throw new PayloadFormatError('Payload is too short to include salt and nonce.');
  }

  const salt = payload.slice(0, SALT_LENGTH);
  const nonce = payload.slice(SALT_LENGTH, SALT_LENGTH + NONCE_LENGTH);
  const ciphertext = payload.slice(SALT_LENGTH + NONCE_LENGTH);

  if (!ciphertext.byteLength) {
    throw new PayloadFormatError('Missing ciphertext bytes.');
  }

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      ciphertext
    );
    return decoder.decode(decrypted);
  } catch (err) {
    throw new DecryptFailedError();
  }
}

export const cryptoErrors = {
  InvalidBase64Error,
  PayloadFormatError,
  DecryptFailedError,
};
