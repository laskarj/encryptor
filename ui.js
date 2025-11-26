import { encryptText, decryptText, cryptoErrors } from './crypto.js';
import { subscribe, setState, setStatus, getState, setMode } from './app-state.js';

const MODE_ENCRYPT = 'encrypt';
const MODE_DECRYPT = 'decrypt';

function select(id) {
  return document.getElementById(id);
}

function setBusy(isBusy) {
  const { busy } = getState();
  if (busy === isBusy) return;
  setState({ busy: isBusy });
  const actions = document.querySelectorAll('[data-action]');
  actions.forEach((btn) => {
    btn.disabled = isBusy;
    btn.setAttribute('aria-busy', String(isBusy));
  });
}

function computeStrength(password) {
  if (!password) {
    return { level: 0, label: 'Weak', hint: 'Use 12+ characters with numbers & symbols.' };
  }
  const lengthScore = Math.min(password.length / 14, 1);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const variety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length / 4;
  const score = Math.min(1, (lengthScore * 0.6) + (variety * 0.4));

  let level = 1;
  let label = 'Weak';
  let hint = 'Add more length, numbers, and symbols.';
  if (score > 0.8) {
    level = 3;
    label = 'Strong';
    hint = 'Looks good. Keep it private—there is no recovery.';
  } else if (score > 0.5) {
    level = 2;
    label = 'Okay';
    hint = 'Longer phrases (12-16 chars) make it stronger.';
  }
  return { level, label, hint };
}

function renderStrength(password) {
  const { level, label, hint } = computeStrength(password);
  const segments = document.querySelectorAll('[data-strength-seg]');
  segments.forEach((seg, idx) => {
    const active = idx < level;
    seg.classList.toggle('bg-red-500', active && level === 1);
    seg.classList.toggle('bg-yellow-500', active && level === 2);
    seg.classList.toggle('bg-green-500', active && level === 3);
    seg.classList.toggle('bg-slate-200', !active);
    if (!active) {
      seg.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-green-500');
    }
  });
  const labelEl = document.querySelector('[data-strength-label]');
  const hintEl = document.querySelector('[data-strength-hint]');
  if (labelEl) labelEl.textContent = `Strength: ${label}`;
  if (hintEl) hintEl.textContent = hint;
}

function renderStatus(state) {
  const statusEl = document.querySelector('[data-status]');
  const textEl = document.querySelector('[data-status-text]');
  if (!statusEl || !textEl) return;

  statusEl.classList.remove('status--success', 'status--error');
  if (state.status.tone === 'success') statusEl.classList.add('status--success');
  if (state.status.tone === 'error') statusEl.classList.add('status--error');
  textEl.textContent = state.status.message;
}

function showError(message) {
  setStatus({ tone: 'error', message });
}

function showSuccess(message) {
  setStatus({ tone: 'success', message });
}

function renderMode(state) {
  const indicator = document.querySelector('[data-mode-indicator]');
  const buttons = document.querySelectorAll('[data-mode-option]');
  buttons.forEach((btn) => {
    const active = btn.dataset.modeOption === state.mode;
    btn.classList.toggle('text-slate-900', active);
    btn.classList.toggle('text-slate-500', !active);
    btn.setAttribute('aria-pressed', String(active));
  });
  if (indicator) {
    indicator.style.transform = state.mode === MODE_DECRYPT ? 'translateX(100%)' : 'translateX(0%)';
  }

  const panels = document.querySelectorAll('[data-panel]');
  panels.forEach((panel) => {
    const isActive = panel.dataset.panel === state.mode;
    panel.classList.toggle('card-hidden', !isActive);
    panel.classList.toggle('card-visible', isActive);
  });
}

function mapDecryptError(err) {
  if (err instanceof cryptoErrors.InvalidBase64Error) {
    return 'The ciphertext is not valid Base64.';
  }
  if (err instanceof cryptoErrors.PayloadFormatError) {
    return 'Payload is incomplete. Expect salt(16)+nonce(12)+ciphertext.';
  }
  if (err instanceof cryptoErrors.DecryptFailedError) {
    return 'Could not decrypt. Check your password or payload.';
  }
  return err.message || 'Failed to decrypt.';
}

async function handleEncrypt() {
  const passwordInput = select('password');
  const plaintextInput = select('plaintext');
  const encryptedOutput = select('encrypted');

  if (!passwordInput.value.trim()) {
    showError('Enter a password to derive an encryption key.');
    passwordInput.focus();
    return;
  }

  setBusy(true);
  try {
    const payload = await encryptText(passwordInput.value, plaintextInput.value ?? '');
    encryptedOutput.value = payload;
    showSuccess('Encrypted successfully. Copy the Base64 payload.');
  } catch (err) {
    showError(err.message || 'Failed to encrypt.');
  } finally {
    setBusy(false);
  }
}

async function handleDecrypt() {
  const passwordInput = select('password');
  const encodedInput = select('encoded');
  const decryptedOutput = select('decrypted');

  if (!passwordInput.value.trim()) {
    showError('Enter a password to derive a decryption key.');
    passwordInput.focus();
    return;
  }
  if (!encodedInput.value.trim()) {
    showError('Paste the Base64 ciphertext to decrypt.');
    encodedInput.focus();
    return;
  }

  setBusy(true);
  try {
    const plaintext = await decryptText(passwordInput.value, encodedInput.value);
    decryptedOutput.value = plaintext;
    showSuccess('Decrypted successfully.');
  } catch (err) {
    decryptedOutput.value = '';
    showError(mapDecryptError(err));
  } finally {
    setBusy(false);
  }
}

async function handleCopy(targetId) {
  const field = select(targetId);
  if (!field || !field.value) {
    showError('Nothing to copy yet.');
    return;
  }

  try {
    await navigator.clipboard.writeText(field.value);
    showSuccess('Copied to clipboard.');
  } catch (err) {
    showError('Clipboard access was blocked.');
  }
}

function togglePasswordVisibility(button, input) {
  const isShowing = input.type === 'text';
  input.type = isShowing ? 'password' : 'text';
  button.textContent = isShowing ? 'Show' : 'Hide';
  button.setAttribute('aria-pressed', String(!isShowing));
}

function bindEvents() {
  const passwordInput = select('password');
  const copyButtons = document.querySelectorAll('[data-copy]');
  const togglePasswordBtn = document.querySelector('[data-toggle-password]');
  const modeButtons = document.querySelectorAll('[data-mode-option]');

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.modeOption;
      setMode(mode);
      renderMode(getState());
    });
  });

  document.querySelector('[data-action="encrypt"]')?.addEventListener('click', handleEncrypt);
  document.querySelector('[data-action="decrypt"]')?.addEventListener('click', handleDecrypt);

  passwordInput?.addEventListener('input', (e) => renderStrength(e.target.value));

  copyButtons.forEach((btn) => {
    btn.addEventListener('click', () => handleCopy(btn.dataset.copy));
  });

  togglePasswordBtn?.addEventListener('click', () => {
    togglePasswordVisibility(togglePasswordBtn, passwordInput);
  });

  select('plaintext')?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleEncrypt();
    }
  });
  select('encoded')?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleDecrypt();
    }
  });
}

export default function initUI() {
  subscribe((state) => {
    renderStatus(state);
    renderMode(state);
  });
  renderStrength(select('password')?.value ?? '');
  bindEvents();
}
