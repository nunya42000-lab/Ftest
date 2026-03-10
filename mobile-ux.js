/**
 * mobile-ux.js - Tactile hardware integration and mobile-first input 
 * Specifically optimized for coding on touch-screen devices.
 */

// --- Global UX Configuration ---
const UX_CONFIG = {
    hapticsEnabled: true,
    softKeys: ['{', '}', '[', ']', '(', ')', ';', '=>', '=', '"', "'", '!', '/', '<', '>', '_'],
    voiceLanguage: 'en-US'
};

document.addEventListener('DOMContentLoaded', () => {
    initMobileUX();
});

function initMobileUX() {
    injectSoftKeys();
    initHapticEngine();
    setupMobileGestures();
}

/**
 * 1. Floating Coding-Symbol Quick Bar
 * Injects buttons that handle the most annoying symbols to type on mobile.
 */
function injectSoftKeys() {
    const container = document.getElementById('mobile-soft-keys');
    if (!container) return;

    container.innerHTML = '';
    
    UX_CONFIG.softKeys.forEach(key => {
        const btn = document.createElement('button');
        btn.innerText = key;
        
        // Mobile-specific styling for the soft-key row
        btn.style.cssText = `
            flex: 0 0 auto;
            min-width: 44px;
            height: 44px;
            background: var(--surface-light);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 8px;
            font-family: 'Fira Code', monospace;
            font-size: 16px;
            font-weight: bold;
            display: flex;
            justify-content: center;
            align-items: center;
            touch-action: manipulation;
        `;

        btn.onclick = (e) => {
            e.preventDefault();
            triggerHaptic('light');
            insertAtCursor(key);
        };

        container.appendChild(btn);
    });
}

function insertAtCursor(text) {
    if (!cmEditor) return;
    
    // Check if it's a paired symbol to move cursor inside automatically
    const paired = { '{': '}', '[': ']', '(': ')', '"': '"', "'": "'" };
    
    if (paired[text]) {
        cmEditor.replaceSelection(text + paired[text]);
        const pos = cmEditor.getCursor();
        cmEditor.setCursor({ line: pos.line, ch: pos.ch - 1 });
    } else {
        cmEditor.replaceSelection(text);
    }
    
    cmEditor.focus();
}

/**
 * 2. Haptic Feedback Engine
 * Provides physical orientation via the vibration motor.
 */
function initHapticEngine() {
    // Check if the user has disabled haptics in settings
    const saved = localStorage.getItem('devos_haptics_enabled');
    UX_CONFIG.hapticsEnabled = saved !== null ? JSON.parse(saved) : true;
    
    const toggle = document.getElementById('haptic-toggle');
    if (toggle) toggle.checked = UX_CONFIG.hapticsEnabled;
}

function triggerHaptic(type) {
    if (!UX_CONFIG.hapticsEnabled || !navigator.vibrate) return;

    switch(type) {
        case 'light': navigator.vibrate(10); break;
        case 'medium': navigator.vibrate(30); break;
        case 'success': navigator.vibrate([20, 30, 20]); break;
        case 'error': navigator.vibrate([50, 50, 50]); break;
        case 'nuke': navigator.vibrate([100, 50, 100, 50, 100]); break;
    }
}

function toggleHaptics(enabled) {
    UX_CONFIG.hapticsEnabled = enabled;
    localStorage.setItem('devos_haptics_enabled', JSON.stringify(enabled));
    if (enabled) triggerHaptic('medium');
}

/**
 * 3. Mobile Gestures
 * Two-finger block selection and advanced touch handling.
 */
function setupMobileGestures() {
    if (!cmEditor) return;

    const wrapper = cmEditor.getWrapperElement();
    let lastTouchEnd = 0;

    // Double-tap to select line
    wrapper.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            triggerHaptic('medium');
            const pos = cmEditor.coordsChar({left: e.changedTouches[0].clientX, top: e.changedTouches[0].clientY});
            cmEditor.setSelection({line: pos.line, ch: 0}, {line: pos.line, ch: 1000});
        }
        lastTouchEnd = now;
    }, false);
}

/**
 * 4. Voice-Triggered Vault Macros
 * Uses Web Speech API to insert snippets or run commands.
 */
let recognition = null;
let isListening = false;

function toggleVoiceMacro() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById('voice-macro-btn');

    if (!SpeechRecognition) {
        alert("Voice Macros are not supported in this browser version.");
        return;
    }

    if (!recognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = UX_CONFIG.voiceLanguage;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log("Voice Command Recognized:", transcript);
            processVoiceCommand(transcript);
        };

        recognition.onend = () => {
            isListening = false;
            if (btn) btn.classList.remove('btn-danger');
            if (btn) btn.classList.add('btn-primary');
        };
    }

    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
        isListening = true;
        triggerHaptic('medium');
        if (btn) btn.classList.remove('btn-primary');
        if (btn) btn.classList.add('btn-danger');
    }
}

function processVoiceCommand(input) {
    // 1. Check for specific commands
    if (input.includes('format')) { formatCode(); return; }
    if (input.includes('save')) { saveVFS(); triggerHaptic('success'); return; }
    if (input.includes('nuke')) { factoryReset(); return; }
    
    // 2. Check for snippets in the vault
    if (typeof snippets !== 'undefined') {
        const match = snippets.find(s => input.includes(s.name.toLowerCase()));
        if (match) {
            insertSnippet(match.id);
            triggerHaptic('success');
            return;
        }
    }

    console.warn("No command or snippet matched for:", input);
    triggerHaptic('error');
}
