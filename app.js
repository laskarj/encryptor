// --- CRYPTO LIBRARY (crypto.js) ---
const SALT_IV_LENGTH = 16; // Merged Salt + IV
const ITERATIONS = 100000; // Reduced slightly for speed, still secure enough for this use case

const MODES = {
    encrypt: 'encrypt',
    decrypt: 'decrypt'
};

const MODE_CONFIG = {
    encrypt: {
        inputLabel: 'Plaintext Input',
        inputPlaceholder: 'Type secret text to encrypt...',
        outputLabel: 'Encrypted Output (Base64Url)',
        outputPlaceholder: 'Encrypted string will appear here...',
        formatHint: 'Format: base64url(salt_iv16 | ciphertext)',
        buttonClasses: "w-full py-3.5 px-4 rounded-xl text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 transform active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group",
        buttonContent: `<i data-lucide="lock" class="w-5 h-5"></i> <span>Encrypt & Compress</span>`,
        tabActiveClasses: 'bg-slate-800 text-white shadow-sm',
        tabInactiveClasses: 'text-slate-400 hover:text-slate-200'
    },
    decrypt: {
        inputLabel: 'Ciphertext Input (Base64Url)',
        inputPlaceholder: 'Paste the string to decrypt...',
        outputLabel: 'Decrypted Plaintext',
        outputPlaceholder: 'Original text will appear here...',
        formatHint: 'Output is secure and only visible to you.',
        buttonClasses: "w-full py-3.5 px-4 rounded-xl text-white font-bold shadow-lg shadow-accent-500/30 hover:shadow-accent-500/50 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-500 hover:to-accent-600 transform active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group",
        buttonContent: `<i data-lucide="unlock" class="w-5 h-5"></i> <span>Decrypt & Decompress</span>`,
        tabActiveClasses: 'bg-slate-800 text-white shadow-sm',
        tabInactiveClasses: 'text-slate-400 hover:text-slate-200'
    }
};

class InvalidBase64Error extends Error { constructor(m = 'Invalid Base64 input.') { super(m); } }
class DecryptFailedError extends Error { constructor(m = 'Decryption failed.') { super(m); } }

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Base64Url Helpers
function toBase64Url(bytes) {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function fromBase64Url(str) {
    try {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        return Uint8Array.from(atob(str), c => c.charCodeAt(0));
    } catch (e) {
        throw new InvalidBase64Error();
    }
}

// Compression Helpers
async function compress(text) {
    const stream = new Blob([text]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(compressedStream).arrayBuffer());
}

async function decompress(bytes) {
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(decompressedStream).arrayBuffer());
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
        { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-CTR', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptText(password, plaintext) {
    if (!password) throw new Error('Password is required.');

    // 1. Compress
    const compressed = await compress(plaintext ?? '');

    // 2. Generate Salt/IV (merged)
    const saltIv = crypto.getRandomValues(new Uint8Array(SALT_IV_LENGTH));

    // 3. Derive Key
    const key = await deriveKey(password, saltIv);

    // 4. Encrypt (AES-CTR)
    // We use the saltIv as the counter block initial value. 
    // AES-CTR requires a 16-byte counter block.
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: saltIv, length: 64 },
        key,
        compressed
    );

    // 5. Pack: saltIv + ciphertext
    const payload = new Uint8Array(SALT_IV_LENGTH + ciphertext.byteLength);
    payload.set(saltIv, 0);
    payload.set(new Uint8Array(ciphertext), SALT_IV_LENGTH);

    return toBase64Url(payload);
}

async function decryptText(password, payloadStr) {
    if (!password) throw new Error('Password is required.');

    let payload;
    try { payload = fromBase64Url(payloadStr); } catch (e) { throw e; }

    if (payload.byteLength < SALT_IV_LENGTH) throw new DecryptFailedError();

    const saltIv = payload.slice(0, SALT_IV_LENGTH);
    const ciphertext = payload.slice(SALT_IV_LENGTH);

    const key = await deriveKey(password, saltIv);

    try {
        // 1. Decrypt
        const decryptedCompressed = await crypto.subtle.decrypt(
            { name: 'AES-CTR', counter: saltIv, length: 64 },
            key,
            ciphertext
        );

        // 2. Decompress
        const decryptedBytes = await decompress(decryptedCompressed);
        return decoder.decode(decryptedBytes);
    } catch (err) {
        throw new DecryptFailedError();
    }
}

// --- APP LOGIC & UI ---

const state = {
    mode: MODES.encrypt, // 'encrypt' or 'decrypt'
    busy: false
};

// UI References
const els = {
    tabEncrypt: document.getElementById('tab-encrypt'),
    tabDecrypt: document.getElementById('tab-decrypt'),
    labelInput: document.getElementById('label-input'),
    labelOutput: document.getElementById('label-output'),
    inputText: document.getElementById('input-text'),
    outputText: document.getElementById('output-text'),
    btnAction: document.getElementById('btn-action'),
    password: document.getElementById('password'),
    formatHint: document.getElementById('format-hint'),
    feedback: document.getElementById('feedback'),
    togglePassBtn: document.getElementById('toggle-password'),
    btnCopy: document.getElementById('btn-copy'),
    btnClear: document.getElementById('btn-clear'),
    outputCounter: document.getElementById('output-counter')
};

function setMode(mode) {
    state.mode = mode;

    hideFeedback();
    els.outputText.value = '';
    updateOutputCounter();

    applyModeConfig(mode);
    updateActionButton(mode);
    updateTabs(mode);
    renderIcons();
}

function applyModeConfig(mode) {
    const config = MODE_CONFIG[mode];
    els.labelInput.textContent = config.inputLabel;
    els.inputText.placeholder = config.inputPlaceholder;
    els.labelOutput.textContent = config.outputLabel;
    els.outputText.placeholder = config.outputPlaceholder;
    els.formatHint.textContent = config.formatHint;
}

function updateTabs(mode) {
    const isEncrypt = mode === MODES.encrypt;
    setActiveTab(
        isEncrypt ? els.tabEncrypt : els.tabDecrypt,
        isEncrypt ? els.tabDecrypt : els.tabEncrypt,
        MODE_CONFIG[mode].tabActiveClasses,
        MODE_CONFIG[mode].tabInactiveClasses
    );
}

function setActiveTab(active, inactive, activeClasses, inactiveClasses) {
    active.className = `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeClasses}`;
    inactive.className = `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-transparent ${inactiveClasses}`;
}

function togglePasswordVisibility() {
    const type = els.password.type === 'password' ? 'text' : 'password';
    els.password.type = type;

    const iconName = type === 'password' ? 'eye' : 'eye-off';
    els.togglePassBtn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
    renderIcons();
}

function clearInput() {
    els.inputText.value = '';
    els.inputText.focus();
}

async function handleAction() {
    const pwd = els.password.value;
    const inputVal = els.inputText.value;

    hideFeedback();

    if (!pwd) return handleValidationError('Password is required to process data.', els.password);
    if (!inputVal.trim()) return handleValidationError('Please enter some text to process.', els.inputText);

    setBusy(true);

    try {
        if (state.mode === MODES.encrypt) {
            const result = await encryptText(pwd, inputVal);
            els.outputText.value = result;
            updateOutputCounter();
            showFeedback('success', 'Text encrypted successfully! Ready to copy.');
        } else {
            const result = await decryptText(pwd, inputVal);
            els.outputText.value = result;
            updateOutputCounter();
            showFeedback('success', 'Text decrypted successfully!');
        }
    } catch (err) {
        let msg = err.message;
        if (err instanceof InvalidBase64Error) msg = "Input is not valid Base64Url.";
        if (err instanceof DecryptFailedError) msg = "Decryption failed. Wrong password or corrupted data.";

        showFeedback('error', msg);
        els.outputText.value = ''; // Clear output on error
        updateOutputCounter();
    } finally {
        setBusy(false);
    }
}

function handleValidationError(message, elementToFocus) {
    showFeedback('error', message);
    elementToFocus.focus();
}

async function handleCopy() {
    const text = els.outputText.value;
    if (!text) {
        showFeedback('error', 'Nothing to copy.');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        const originalText = els.btnCopy.innerHTML;
        const btn = els.btnCopy;
        btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i> Copied`;
        btn.classList.add('text-green-400', 'border-green-400/30', 'bg-green-400/10');
        renderIcons();

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('text-green-400', 'border-green-400/30', 'bg-green-400/10');
            renderIcons();
        }, 2000);
    } catch (err) {
        showFeedback('error', 'Failed to copy to clipboard.');
    }
}

function setBusy(isBusy) {
    state.busy = isBusy;
    els.btnAction.disabled = isBusy;
    els.btnAction.style.opacity = isBusy ? '0.7' : '1';
    if (isBusy) {
        els.btnAction.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Processing...`;
    } else {
        updateActionButton(state.mode);
    }
    renderIcons();
}

function updateActionButton(mode) {
    const config = MODE_CONFIG[mode];
    els.btnAction.className = config.buttonClasses;
    els.btnAction.innerHTML = config.buttonContent;
}

function showFeedback(type, message) {
    els.feedback.classList.remove('hidden');
    if (type === 'error') {
        els.feedback.className = "mx-6 mb-6 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in bg-red-500/10 border border-red-500/20 text-red-200";
        els.feedback.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-red-400"></i> ${message}`;
    } else {
        els.feedback.className = "mx-6 mb-6 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in bg-green-500/10 border border-green-500/20 text-green-200";
        els.feedback.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-green-400"></i> ${message}`;
    }
    renderIcons();
}

function hideFeedback() {
    els.feedback.classList.add('hidden');
}

function renderIcons() {
    lucide.createIcons();
}

function updateOutputCounter() {
    const len = els.outputText.value.length;
    els.outputCounter.textContent = len > 0 ? `${len} chars` : '';
}

function bindEvents() {
    els.tabEncrypt.addEventListener('click', () => setMode(MODES.encrypt));
    els.tabDecrypt.addEventListener('click', () => setMode(MODES.decrypt));
    els.btnAction.addEventListener('click', handleAction);
    els.btnCopy.addEventListener('click', handleCopy);
    els.btnClear.addEventListener('click', clearInput);
    els.togglePassBtn.addEventListener('click', togglePasswordVisibility);
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleAction();
        }
    });
}

function init() {
    renderIcons();
    bindEvents();
    setMode(MODES.encrypt);
}

init();
