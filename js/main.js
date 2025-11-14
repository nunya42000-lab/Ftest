/**
 * Main application entry point.
 * Initializes all event listeners and loads the application state.
 */

/**
 * Assigns all global DOM element variables.
 * Must be called after DOM is loaded.
 */
function assignDomElements() {
    // Main UI
    sequenceContainer = document.getElementById('sequence-container');
    
    // Custom Modal
    customModal = document.getElementById('custom-modal');
    modalTitle = document.getElementById('modal-title');
    modalMessage = document.getElementById('modal-message');
    modalConfirm = document.getElementById('modal-confirm');
    modalCancel = document.getElementById('modal-cancel');
    
    // Share Modal
    shareModal = document.getElementById('share-modal');
    closeShare = document.getElementById('close-share');
    copyLinkButton = document.getElementById('copy-link-button'); 
    nativeShareButton = document.getElementById('native-share-button'); 
    
    // Welcome Modal
    welcomeModal = document.getElementById('welcome-modal');
    closeWelcomeModalBtn = document.getElementById('close-welcome-modal');
    dontShowWelcomeToggle = document.getElementById('dont-show-welcome-toggle');

    // Settings Modal
    settingsModal = document.getElementById('settings-modal');
    settingsModeToggleButton = document.getElementById('settings-mode-toggle-button');
    settingsModeDropdown = document.getElementById('settings-mode-dropdown');
    openShareButton = document.getElementById('open-share-button');
    openHelpButton = document.getElementById('open-help-button');
    closeSettings = document.getElementById('close-settings');
    
    // Settings Controls
    followsCountSelect = document.getElementById('follows-count-select');
    followsChunkSizeSelect = document.getElementById('follows-chunk-size-select');
    followsDelaySelect = document.getElementById('follows-delay-select'); 
    
    // Help Modal
    helpModal = document.getElementById('help-modal');
    helpContentContainer = document.getElementById('help-content-container');
    helpTabNav = document.getElementById('help-tab-nav');
    closeHelp = document.getElementById('close-help');

    // Toggles
    darkModeToggle = document.getElementById('dark-mode-toggle');
    speedDeleteToggle = document.getElementById('speed-delete-toggle');
    pianoAutoplayToggle = document.getElementById('piano-autoplay-toggle');
    bananasAutoplayToggle = document.getElementById('bananas-autoplay-toggle');
    rounds15ClearAfterPlaybackToggle = document.getElementById('rounds15-clear-after-playback-toggle'); // <-- CORRECTED
    audioPlaybackToggle = document.getElementById('audio-playback-toggle');
    voiceInputToggle = document.getElementById('voice-input-toggle');
    sliderLockToggle = document.getElementById('slider-lock-toggle');
    hapticsToggle = document.getElementById('haptics-toggle');
    showWelcomeToggle = document.getElementById('show-welcome-toggle');

    // Sliders
    bananasSpeedSlider = document.getElementById('bananas-speed-slider');
    bananasSpeedDisplay = document.getElementById('bananas-speed-display');
    pianoSpeedSlider = document.getElementById('piano-speed-slider');
    pianoSpeedDisplay = document.getElementById('piano-speed-display');
    rounds15SpeedSlider = document.getElementById('rounds15-speed-slider');
    rounds15SpeedDisplay = document.getElementById('rounds15-speed-display');
    uiScaleSlider = document.getElementById('ui-scale-slider');
    uiScaleDisplay = document.getElementById('ui-scale-display');

    // Pads
    bananasPad = document.getElementById('bananas-pad');
    pianoPad = document.getElementById('piano-pad');
    rounds15Pad = document.getElementById('rounds15-pad');
    
    // Other
    allVoiceInputs = document.querySelectorAll('.voice-text-input');
}

// --- Event Listeners Setup ---

function initializeListeners() {
    
    document.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const { value, action, mode, modeSelect, copyTarget } = button.dataset;

        if (copyTarget) {
            // ... (Clipboard logic) ...
            return;
        }
        
        if (action === 'open-settings') {
            openSettingsModal();
            return;
        }
        if (action === 'open-help') {
            closeSettingsModal();
            openHelpModal();
            return;
        }
        if (action === 'open-share') {
            openShareModal();
            return;
        }

        // --- Share Modal Actions ---
        if (action === 'copy-link') {
            // ... (Clipboard logic) ...
            return;
        }
        
        if (action === 'native-share') {
            // ... (Share logic) ...
            return;
        }
        // --- End Share Modal Actions ---

        if (modeSelect) {
            handleModeSelection(modeSelect);
            return;
        }
        
        if (action === 'restore-defaults') {
            handleRestoreDefaults();
            return;
        }

        if (action === 'reset-rounds' && mode === 'rounds15') {
            resetRounds15();
            return;
        }
        if (action === 'play-demo' && mode === 'bananas') {
            handleBananasDemo();
            return;
        }
        if (action === 'demo' && mode === 'piano') {
            handlePianoDemo();
            return;
        }
        if (action === 'demo' && mode === 'rounds15') {
            handleRounds15Demo();
            return;
        }
        
        if (value && mode === currentMode) {
            if (currentMode === 'bananas' && /^[1-9]$/.test(value)) {
                addValue(value);
            }
            else if (currentMode === 'piano' && (/^[1-5]$/.test(value) || /^[A-G]$/.test(value))) {
                if (!settings.isPianoAutoplayEnabled) flashKey(value, 200);
                addValue(value);
            }
            else if (currentMode === 'rounds15' && /^(?:[1-9]|1[0-2])$/.test(value)) {
                addValue(value);
            }
        }
    });
    
    // Voice (Text) Input Listeners
    if (allVoiceInputs) {
        // ... (Listener logic) ...
    }
    
    // Backspace Listeners
    document.querySelectorAll('button[data-action="backspace"]').forEach(btn => {
        // ... (Listeners: mousedown, mouseup, etc.) ...
    });
    
    // --- Modal & Settings Listeners ---
    
    // Welcome Modal
    if (closeWelcomeModalBtn) closeWelcomeModalBtn.addEventListener('click', closeWelcomeModal);
    if (dontShowWelcomeToggle) dontShowWelcomeToggle.addEventListener('change', (e) => {
        settings.showWelcomeScreen = !e.target.checked;
        if (showWelcomeToggle) showWelcomeToggle.checked = settings.showWelcomeScreen;
        saveState();
    });
    
    // Settings Modal
    if (settingsModeToggleButton) settingsModeToggleButton.addEventListener('click', toggleModeDropdown);
    if (closeSettings) closeSettings.addEventListener('click', closeSettingsModal);
    
    if (followsCountSelect) followsCountSelect.addEventListener('change', (event) => {
        const newCount = parseInt(event.target.value);
        const state = appState['bananas']; // <-- UPDATED
        state.sequenceCount = newCount;
        state.nextSequenceIndex = 0;
        renderSequences();
        saveState();
    });
    if (followsChunkSizeSelect) followsChunkSizeSelect.addEventListener('change', (event) => {
        settings.followsChunkSize = parseInt(event.target.value);
        saveState();
    });
    if (followsDelaySelect) followsDelaySelect.addEventListener('change', (event) => { 
        settings.followsInterSequenceDelay = parseInt(event.target.value);
        saveState();
    });
    
    // Toggles
    if (showWelcomeToggle) showWelcomeToggle.addEventListener('change', (e) => {
        settings.showWelcomeScreen = e.target.checked;
        if (dontShowWelcomeToggle) dontShowWelcomeToggle.checked = !settings.showWelcomeScreen;
        saveState();
    });
    if (darkModeToggle) darkModeToggle.addEventListener('change', (e) => updateTheme(e.target.checked));
    if (speedDeleteToggle) speedDeleteToggle.addEventListener('change', (e) => {
        settings.isSpeedDeletingEnabled = e.target.checked;
        saveState();
    });
    if (pianoAutoplayToggle) pianoAutoplayToggle.addEventListener('change', (e) => {
        settings.isPianoAutoplayEnabled = e.target.checked;
        saveState();
    });
    if (bananasAutoplayToggle) bananasAutoplayToggle.addEventListener('change', (e) => {
        settings.isBananasAutoplayEnabled = e.target.checked;
        saveState();
    });
    // <-- followsAutoplayToggle listener REMOVED
    if (rounds15ClearAfterPlaybackToggle) rounds15ClearAfterPlaybackToggle.addEventListener('change', (e) => {
        settings.isRounds15ClearAfterPlaybackEnabled = e.target.checked;
        saveState();
    });
    if (audioPlaybackToggle) audioPlaybackToggle.addEventListener('change', (e) => {
        settings.isAudioPlaybackEnabled = e.target.checked;
        if (settings.isAudioPlaybackEnabled) speak("Audio");
        saveState();
    });
    if (voiceInputToggle) voiceInputToggle.addEventListener('change', (e) => {
        settings.isVoiceInputEnabled = e.target.checked;
        updateVoiceInputVisibility();
        saveState();
    });
    if (hapticsToggle) hapticsToggle.addEventListener('change', (e) => {
        settings.isHapticsEnabled = e.target.checked;
        if (settings.isHapticsEnabled) vibrate(50);
        saveState();
    });
    if (sliderLockToggle) sliderLockToggle.addEventListener('change', (e) => {
        settings.areSlidersLocked = e.target.checked;
        updateSliderLockState();
        saveState();
    });

    // Sliders
    function setupSpeedSlider(slider, displayElement, modeKey) {
        // ... (function unchanged) ...
    }
    setupSpeedSlider(bananasSpeedSlider, bananasSpeedDisplay, 'bananas');
    setupSpeedSlider(pianoSpeedSlider, pianoSpeedDisplay, 'piano');
    setupSpeedSlider(rounds15SpeedSlider, rounds15SpeedDisplay, 'rounds15');
    
    if (uiScaleSlider) {
        // ... (listener unchanged) ...
    }
    
    // Other Modals
    if (closeHelp) closeHelp.addEventListener('click', closeHelpModal);
    if (closeShare) closeShare.addEventListener('click', closeShareModal); 
}

// --- Initialization ---
window.onload = function() {
    
    loadState(); // <<< LOAD STATE FIRST
    
    assignDomElements(); // <<< ASSIGN ALL DOM VARIABLES
 
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/Follow/sw.js', { scope: '/Follow/' })
            // ... (registration logic) ...
    }

    // --- Update UI based on loaded state ---
    updateTheme(settings.isDarkMode);
    updateSpeedDisplay(settings.bananasSpeedMultiplier, bananasSpeedDisplay);
    updateSpeedDisplay(settings.pianoSpeedMultiplier, pianoSpeedDisplay);
    updateSpeedDisplay(settings.rounds15SpeedMultiplier, rounds15SpeedDisplay);
    updateScaleDisplay(settings.uiScaleMultiplier, uiScaleDisplay);
    updateSliderLockState();
    updateVoiceInputVisibility();
    
    initializeListeners();
    
    // Load the last used mode (loadState already fixes it if it was 'follows')
    updateMode(settings.currentMode || 'bananas');
    
    // --- Show Welcome Modal ---
    if (settings.showWelcomeScreen) {
        setTimeout(openWelcomeModal, 500);
    }
    
    // Pre-load audio
    if (settings.isAudioPlaybackEnabled) speak(" "); 
};
        
