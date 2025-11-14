/**
 * Triggers a short vibration, if enabled and supported.
 */
function vibrate(duration = 10) {
    // ... (function unchanged) ...
}

function addValue(value) {
    // ... (function unchanged from previous correct answer) ...
}

function handleBackspace() {
    // ... (function unchanged from previous correct answer) ...
}


// --- Backspace Speed Deleting Logic ---

function stopSpeedDeleting() {
    // ... (function unchanged) ...
}

function handleBackspaceStart(event) {
    // ... (function unchanged from previous correct answer) ...
}

function handleBackspaceEnd() {
    // ... (function unchanged from previous correct answer) ...
}

// --- Voice Input Functions (TEXT-BASED) ---

function processVoiceTranscript(transcript) {
    // ... (function unchanged from previous correct answer) ...
}

// --- Restore Defaults Function ---
function handleRestoreDefaults() {
    // 1. Reset settings and state
    settings = { ...DEFAULT_SETTINGS };
    appState = {
        'bananas': getInitialState('bananas'),
        'piano': getInitialState('piano'), 
        'rounds15': getInitialState('rounds15'),
    };
    currentMode = settings.currentMode; // 'bananas'
    
    // 2. Save the new defaults
    saveState();
    
    // 3. Update all UI elements in the settings panel
    updateTheme(settings.isDarkMode);
    updateVoiceInputVisibility();
    updateSliderLockState();

    // Toggles
    if (showWelcomeToggle) showWelcomeToggle.checked = settings.showWelcomeScreen;
    if (darkModeToggle) darkModeToggle.checked = settings.isDarkMode;
    if (speedDeleteToggle) speedDeleteToggle.checked = settings.isSpeedDeletingEnabled;
    if (pianoAutoplayToggle) pianoAutoplayToggle.checked = settings.isPianoAutoplayEnabled;
    if (bananasAutoplayToggle) bananasAutoplayToggle.checked = settings.isBananasAutoplayEnabled;
    // <-- followsAutoplayToggle reference REMOVED
    if (rounds15ClearAfterPlaybackToggle) rounds15ClearAfterPlaybackToggle.checked = settings.isRounds15ClearAfterPlaybackEnabled;
    if (audioPlaybackToggle) audioPlaybackToggle.checked = settings.isAudioPlaybackEnabled;
    if (voiceInputToggle) voiceInputToggle.checked = settings.isVoiceInputEnabled;
    if (sliderLockToggle) sliderLockToggle.checked = settings.areSlidersLocked;
    if (hapticsToggle) hapticsToggle.checked = settings.isHapticsEnabled;

    // Sliders
    if (bananasSpeedSlider) bananasSpeedSlider.value = settings.bananasSpeedMultiplier * 100;
    updateSpeedDisplay(settings.bananasSpeedMultiplier, bananasSpeedDisplay);
    if (pianoSpeedSlider) pianoSpeedSlider.value = settings.pianoSpeedMultiplier * 100;
    updateSpeedDisplay(settings.pianoSpeedMultiplier, pianoSpeedDisplay);
    if (rounds15SpeedSlider) rounds15SpeedSlider.value = settings.rounds15SpeedMultiplier * 100;
    updateSpeedDisplay(settings.rounds15SpeedMultiplier, rounds15SpeedDisplay);
    if (uiScaleSlider) uiScaleSlider.value = settings.uiScaleMultiplier * 100;
    updateScaleDisplay(settings.uiScaleMultiplier, uiScaleDisplay);

    // Multi-Sequence Selects
    if (followsCountSelect) followsCountSelect.value = appState['bananas'].sequenceCount;
    if (followsChunkSizeSelect) followsChunkSizeSelect.value = settings.followsChunkSize;
    if (followsDelaySelect) followsDelaySelect.value = settings.followsInterSequenceDelay;
    
    // 4. Update the main UI
    updateMode(settings.currentMode); // This also calls renderSequences
    
    // 5. Close the modal
    closeSettingsModal();
}
