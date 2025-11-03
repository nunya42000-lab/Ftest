(function () {
        
    // --- Application State and Constants ---
    const MAX_SEQUENCES = 4;
    const DEMO_DELAY_BASE_MS = 798;
    const SPEED_DELETE_INITIAL_DELAY = 250;
    const SPEED_DELETE_INTERVAL_MS = 10;    
    const SETTINGS_KEY = 'followMeAppSettings'; 
    const STATE_KEY = 'followMeAppState';       
    
    let initialDelayTimer = null; 
    let speedDeleteInterval = null; 

    // --- Settings State (Defaults) ---
    const defaultSettings = {
        currentMode: 'bananas',
        isDarkMode: true,
        bananasSpeedMultiplier: 1.0, 
        pianoSpeedMultiplier: 1.0, 
        rounds15SpeedMultiplier: 1.0,
        uiScaleMultiplier: 1.0, 
        isSpeedDeletingEnabled: true, 
        isPianoAutoplayEnabled: true, 
        isBananasAutoplayEnabled: true, 
        isFollowsAutoplayEnabled: true, 
        isRounds15ClearAfterPlaybackEnabled: true, 
        isAudioPlaybackEnabled: true,
        isVoiceInputEnabled: true,
        areSlidersLocked: true,
        followsChunkSize: 3, 
    };

    // --- LocalStorage Load/Save ---

    function loadSettings() {
        try {
            const savedSettings = localStorage.getItem(SETTINGS_KEY);
            if (savedSettings) {
                return { ...defaultSettings, ...JSON.parse(savedSettings) };
            }
        } catch (e) {
            console.error("Failed to load settings, using defaults:", e);
        }
        return { ...defaultSettings }; 
    }
    
    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    }
    
    let settings = loadSettings(); 

    // Mode Definitions
    const MODES = ['bananas', 'follows', 'piano', 'rounds15']; 
    const MODE_LABELS = {
        'bananas': 'Bananas',
        'follows': 'follows',
        'piano': 'piano',
        'rounds15': '15 rounds',
    };
    
    // Piano mapping for speech
    const PIANO_SPEAK_MAP = {
        'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'A': 'A', 'B': 'B',
        '1': '1', '2': '2', '3': '3', '4': '4', '5': '5'
    };
    
    // --- Core Functions for State Management ---
    function getInitialState(mode) {
        switch (mode) {
            case 'follows':
                return { 
                    sequences: Array.from({ length: MAX_SEQUENCES }, () => []),
                    sequenceCount: 2,
                    nextSequenceIndex: 0
                };
            case 'rounds15': 
                return {
                    sequences: [[]], 
                    sequenceCount: 1, 
                    nextSequenceIndex: 0,
                    currentRound: 1,
                    maxRound: 15
                };
            case 'bananas':
            case 'piano':
            default:
                return { 
                    sequences: [[]], 
                    sequenceCount: 1, 
                    nextSequenceIndex: 0 
                };
        }
    }

    // --- Data Store (Defaults and Loading) ---
    
    const defaultAppState = {
        'bananas': getInitialState('bananas'),
        'follows': getInitialState('follows'),
        'piano': getInitialState('piano'), 
        'rounds15': getInitialState('rounds15'),
    };
    
    function loadState() {
        try {
            const savedState = localStorage.getItem(STATE_KEY);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                const mergedState = JSON.parse(JSON.stringify(defaultAppState)); 
                
                for (const mode of MODES) {
                    if (parsedState[mode]) {
                        Object.assign(mergedState[mode], parsedState[mode]);
                    }
                }
                return mergedState;
            }
        } catch (e) {
            console.error("Failed to load app state, using defaults:", e);
        }
        return JSON.parse(JSON.stringify(defaultAppState)); 
    }
    
    function saveState() {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(appState));
        } catch (e) {
            console.error("Failed to save app state:", e);
        }
    }

    let appState = loadState();
    
    const getCurrentState = () => appState[settings.currentMode];

    
    // --- DOM Elements ---
    const sequenceContainer = document.getElementById('sequence-container');
    const customModal = document.getElementById('custom-modal');
    const shareModal = document.getElementById('share-modal'); 

    // Settings Modal Elements
    const settingsModal = document.getElementById('settings-modal');
    const settingsModeToggleButton = document.getElementById('settings-mode-toggle-button');
    const settingsModeDropdown = document.getElementById('settings-mode-dropdown');
    const openHelpButton = document.getElementById('open-help-button'); 
    const followsCountSelect = document.getElementById('follows-count-select'); 
    const followsChunkSizeSelect = document.getElementById('follows-chunk-size-select'); 

    // Help Modal Elements
    const helpModal = document.getElementById('help-modal');
    const helpContent = document.getElementById('help-content');
    
    // Toggles
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const speedDeleteToggle = document.getElementById('speed-delete-toggle'); 
    const pianoAutoplayToggle = document.getElementById('piano-autoplay-toggle'); 
    const bananasAutoplayToggle = document.getElementById('bananas-autoplay-toggle'); 
    const followsAutoplayToggle = document.getElementById('follows-autoplay-toggle'); 
    const rounds15ClearAfterPlaybackToggle = document.getElementById('rounds15-clear-after-playback-toggle');
    const audioPlaybackToggle = document.getElementById('audio-playback-toggle'); 
    const voiceInputToggle = document.getElementById('voice-input-toggle');
    const sliderLockToggle = document.getElementById('slider-lock-toggle'); 

    // Sliders and Displays
    const bananasSpeedSlider = document.getElementById('bananas-speed-slider');
    const bananasSpeedDisplay = document.getElementById('bananas-speed-display');
    const pianoSpeedSlider = document.getElementById('piano-speed-slider');
    const pianoSpeedDisplay = document.getElementById('piano-speed-display');
    const rounds15SpeedSlider = document.getElementById('rounds15-speed-slider');
    const rounds15SpeedDisplay = document.getElementById('rounds15-speed-display');
    const uiScaleSlider = document.getElementById('ui-scale-slider');
    const uiScaleDisplay = document.getElementById('ui-scale-display');
    
    // Pad Elements
    const bananasPad = document.getElementById('bananas-pad');
    const followsPad = document.getElementById('follows-pad');
    const pianoPad = document.getElementById('piano-pad');
    const rounds15Pad = document.getElementById('rounds15-pad');
    const allMicButtons = document.querySelectorAll('button[data-action="voice-input"]');

    // --- Speech Recognition ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionApi = SpeechRecognition ? new SpeechRecognition() : null;
    let isListening = false;

    // --- Voice Command Mapping ---

    const VOICE_VALUE_MAP = {
        'one': '1', 'two': '2', 'to': '2', 'three': '3', 'four': '4', 'for': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
        'eleven': '11', 'twelve': '12',
        'see': 'C', 'dee': 'D', 'e': 'E', 'eff': 'F', 'gee': 'G', 'eh': 'A', 'be': 'B',
        'c': 'C', 'd': 'D', 'f': 'F', 'g': 'G', 'a': 'A', 'b': 'B'
    };
    
    const VOICE_ACTION_MAP = {
        'settings': openSettingsModal,
        'open settings': openSettingsModal,
        'close settings': closeSettingsModal,
        'help': openHelpModal,
        'open help': openHelpModal,
        'close help': closeHelpModal,
        'mode bananas': () => handleModeSelection('bananas'),
        'switch to bananas': () => handleModeSelection('bananas'),
        'mode follows': () => handleModeSelection('follows'),
        'switch to follows': () => handleModeSelection('follows'),
        'mode piano': () => handleModeSelection('piano'),
        'switch to piano': () => handleModeSelection('piano'),
        'mode rounds': () => handleModeSelection('rounds15'),
        'switch to rounds': () => handleModeSelection('rounds15'),
        'play': handleCurrentDemo,
        'demo': handleCurrentDemo,
        'play demo': handleCurrentDemo,
        'clear': handleBackspace,
        'delete': handleBackspace,
        'back': handleBackspace,
        'backspace': handleBackspace,
        'reset': () => { if (settings.currentMode === 'rounds15') resetRounds15(); },
        'reset rounds': () => { if (settings.currentMode === 'rounds15') resetRounds15(); },
        'speed up': () => adjustSpeed(0.25),
        'faster': () => adjustSpeed(0.25),
        'speed down': () => adjustSpeed(-0.25),
        'slower': () => adjustSpeed(-0.25),
        'speed reset': () => adjustSpeed(0, true),
        'base speed': () => adjustSpeed(0, true),
        'toggle dark mode': () => darkModeToggle.click(),
        'toggle light mode': () => darkModeToggle.click(),
        'toggle audio': () => audioPlaybackToggle.click(),
        'toggle sound': () => audioPlaybackToggle.click(),
        'toggle autoplay': () => {
             if (settings.currentMode === 'bananas') bananasAutoplayToggle.click();
             else if (settings.currentMode === 'follows') followsAutoplayToggle.click();
             else if (settings.currentMode === 'piano') pianoAutoplayToggle.click();
        },
        'toggle auto clear': () => { if (settings.currentMode === 'rounds15') rounds15ClearAfterPlaybackToggle.click(); },
        'toggle lock': () => sliderLockToggle.click(),
        'lock sliders': () => { if (!settings.areSlidersLocked) sliderLockToggle.click(); },
        'unlock sliders': () => { if (settings.areSlidersLocked) sliderLockToggle.click(); }
    };

    // --- (getInitialState moved up) ---

    function renderSequences() {
        const state = getCurrentState();
        const { sequences, sequenceCount } = state;
        const activeSequences = sequences.slice(0, sequenceCount);
        sequenceContainer.innerHTML = '';
        
        const currentTurnIndex = state.nextSequenceIndex % sequenceCount;

        let layoutClasses = 'gap-4 flex-grow mb-6 transition-all duration-300 pt-1 ';

        if (settings.currentMode === 'bananas') {
            layoutClasses += ' flex flex-col max-w-xl mx-auto';
        } else if (settings.currentMode === 'follows') {
            if (sequenceCount === 2) {
                layoutClasses += ' grid grid-cols-2 max-w-3xl mx-auto';
            } else if (sequenceCount === 3) {
                layoutClasses += ' grid grid-cols-3 max-w-4xl mx-auto';
            } else if (sequenceCount === 4) {
                layoutClasses += ' grid grid-cols-4 max-w-5xl mx-auto';
            }
        } else if (settings.currentMode === 'piano' || settings.currentMode === 'rounds15') {
            layoutClasses += ' flex flex-col max-w-2xl mx-auto';
        }
        sequenceContainer.className = layoutClasses;

        if (settings.currentMode === 'rounds15') {
            const roundDisplay = document.createElement('div');
            roundDisplay.className = 'text-center text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100';
            roundDisplay.id = 'rounds15-round-display';
            roundDisplay.textContent = `Round: ${state.currentRound} / ${state.maxRound}`;
            sequenceContainer.appendChild(roundDisplay);
        }

        let numColumns = 0;
        if (settings.currentMode === 'bananas') numColumns = 5;
        else if (settings.currentMode === 'follows') {
            if (sequenceCount === 2) numColumns = 4;
            else if (sequenceCount === 3) numColumns = 4;
            else if (sequenceCount === 4) numColumns = 3; 
        } else if (settings.currentMode === 'piano' || settings.currentMode === 'rounds15') numColumns = 5; 
        
        let gridClass = numColumns > 0 ? `grid grid-cols-${numColumns}` : 'flex flex-wrap';
        
        const baseSize = 40;
        const baseFont = 1.1;
        const newSize = baseSize * settings.uiScaleMultiplier;
        const newFont = baseFont * settings.uiScaleMultiplier;
        const sizeStyle = `height: ${newSize}px; line-height: ${newSize}px; font-size: ${newFont}rem;`;

        activeSequences.forEach((set, index) => {
            const isCurrent = currentTurnIndex === index;
            const sequenceDiv = document.createElement('div');
            
            const originalClasses = `p-4 rounded-xl shadow-md transition-all duration-200 ${isCurrent ? 'bg-accent-app scale-[1.02] shadow-lg text-gray-900' : 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'}`;
            sequenceDiv.className = originalClasses;
            sequenceDiv.dataset.originalClasses = originalClasses;
            
            sequenceDiv.innerHTML = `
                <div class="${gridClass} gap-2 min-h-[50px]"> 
                    ${set.map(val => `
                        <span class="number-box bg-secondary-app text-white rounded-xl text-center shadow-sm"
                              style="${sizeStyle}">
                            ${val}
                        </span>
                    `).join('')}
                </div>
            `;
            sequenceContainer.appendChild(sequenceDiv);
        });
    }

    function addValue(value) {
        const state = getCurrentState();
        const { sequences, sequenceCount } = state;
        
        if (sequenceCount === 0) return;

        if (settings.currentMode === 'rounds15' && sequences[0].length >= state.currentRound) return; 
        if (settings.currentMode === 'bananas' && sequences[0].length >= 25) return;
        if (settings.currentMode === 'follows' && sequences[state.nextSequenceIndex % sequenceCount].length >= 25) return;
        if (settings.currentMode === 'piano' && sequences[0].length >= 20) return; 

        const targetIndex = state.nextSequenceIndex % sequenceCount;
        sequences[targetIndex].push(value);
        state.nextSequenceIndex++;
        
        const justFilledIndex = (state.nextSequenceIndex - 1) % sequenceCount;

        renderSequences();
        
        if (settings.currentMode === 'piano' && settings.isPianoAutoplayEnabled) { 
            setTimeout(() => { handlePianoDemo(); }, 100); 
        }
        else if (settings.currentMode === 'bananas' && settings.isBananasAutoplayEnabled) {
            setTimeout(() => { handleBananasDemo(); }, 100); 
        }
        else if (settings.currentMode === 'follows' && settings.isFollowsAutoplayEnabled) {
            if (justFilledIndex === state.sequenceCount - 1) {
                 setTimeout(() => { handleFollowsDemo(); }, 100);
            }
        }
        else if (settings.currentMode === 'rounds15') {
            const sequence = state.sequences[0];
            if (sequence.length === state.currentRound) {
                const allKeys = document.querySelectorAll('#rounds15-pad button[data-value]');
                allKeys.forEach(key => key.disabled = true);
                
                setTimeout(() => { handleRounds15Demo(); }, 100); 
            }
        }
        
        saveState(); 
    }
    
    // --- Backspace Speed Deleting Logic (MODIFIED) ---

    // *** NEW: Internal function that performs backspace logic *without* saving ***
    // Returns true if an item was popped, false otherwise.
    function _internalBackspace() {
        const state = getCurrentState();
        const { sequences, sequenceCount } = state;

        // Check if a demo is running
        if (settings.currentMode === 'rounds15') {
            const demoButton = document.querySelector('#rounds15-pad button[data-action="demo"]');
            if (demoButton && demoButton.disabled) return false;
        }
        if (settings.currentMode === 'follows') {
            const demoButton = document.querySelector('#follows-pad button[data-action="play-demo"]');
            if (demoButton && demoButton.disabled) return false;
        }

        if (state.nextSequenceIndex === 0) return false;

        const lastClickTargetIndex = (state.nextSequenceIndex - 1) % sequenceCount;
        const targetSet = sequences[lastClickTargetIndex];

        if (targetSet.length > 0) {
            targetSet.pop();
            state.nextSequenceIndex--;

            if (settings.currentMode === 'rounds15') {
                const allKeys = document.querySelectorAll('#rounds15-pad button[data-value]');
                allKeys.forEach(key => key.disabled = false);
            }

            renderSequences();
            return true; // Return true to indicate a change was made
        }
        return false; // Return false if no change was made
    }
    
    // *** MODIFIED: This is for single-clicks. It calls the internal function AND saves. ***
    function handleBackspace() {
        if (_internalBackspace()) {
            saveState();
        }
    }
    
    function stopSpeedDeleting() {
        if (initialDelayTimer) clearTimeout(initialDelayTimer);
        if (speedDeleteInterval) clearInterval(speedDeleteInterval);
        initialDelayTimer = null;
        speedDeleteInterval = null;
    }

    // *** MODIFIED: Calls the internal function (no save) in the interval ***
    function handleBackspaceStart(event) {
        event.preventDefault(); 
        stopSpeedDeleting(); 

        if (!settings.isSpeedDeletingEnabled) return;

        // Run the first backspace immediately (but don't save yet)
        _internalBackspace(); 

        initialDelayTimer = setTimeout(() => {
            // Start the interval, calling the function *without* save
            speedDeleteInterval = setInterval(_internalBackspace, SPEED_DELETE_INTERVAL_MS);
            initialDelayTimer = null; 
        }, SPEED_DELETE_INITIAL_DELAY);
    }

    // *** MODIFIED: Saves state ONCE at the end of the operation ***
    function handleBackspaceEnd() {
        if (initialDelayTimer !== null) {
            // This was a single click (or a click before the interval started)
            // The initial _internalBackspace already ran in handleBackspaceStart.
            // We just need to stop the pending timer and save.
            stopSpeedDeleting();
            saveState(); 
        } 
        else if (!settings.isSpeedDeletingEnabled) {
            // This was a single click when speed deleting is off
            // handleBackspaceStart did nothing, so we call the full handleBackspace
            handleBackspace();
        } 
        else {
            // This was a long press (speed delete)
            // The interval was running. Stop it, and save state *once*.
            stopSpeedDeleting();
            saveState();
        }
    }

    // --- Settings Panel Logic ---

    function renderModeDropdown() {
        settingsModeDropdown.innerHTML = MODES.map(modeKey => `
            <button data-mode-select="${modeKey}" 
                    class="w-full text-left px-4 py-3 text-lg font-semibold 
                        ${settings.currentMode === modeKey ? 'bg-primary-app text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'} 
                        transition-colors duration-150">
                ${MODE_LABELS[modeKey]}
            </button>
        `).join('');
    }

    function toggleModeDropdown(event) {
        event.stopPropagation();
        if (settingsModeDropdown.classList.contains('hidden')) {
            renderModeDropdown();
            const rect = settingsModeToggleButton.getBoundingClientRect();
            const modalRect = settingsModal.querySelector('div').getBoundingClientRect();
            settingsModeDropdown.style.position = 'absolute';
            settingsModeDropdown.style.left = `${rect.left - modalRect.left}px`;
            settingsModeDropdown.style.width = `${rect.width}px`;
            settingsModeDropdown.style.top = `${rect.bottom - modalRect.top}px`;
            
            settingsModeDropdown.classList.remove('hidden');
            setTimeout(() => settingsModeDropdown.classList.remove('opacity-0'), 10);
            document.addEventListener('click', closeModeDropdownOnOutsideClick, true);
        } else {
            closeModeDropdown();
        }
    }

    function closeModeDropdown() {
        settingsModeDropdown.classList.add('opacity-0');
        setTimeout(() => settingsModeDropdown.classList.add('hidden'), 200);
        document.removeEventListener('click', closeModeDropdownOnOutsideClick, true);
    }

    function closeModeDropdownOnOutsideClick(event) {
        if (!event.target.closest('#settings-mode-toggle-button') && !event.target.closest('#settings-mode-dropdown')) {
            closeModeDropdown();
        }
    }

    function handleModeSelection(newMode) {
        closeModeDropdown();
        updateMode(newMode);
    }

    function openSettingsModal() {
        settingsModeToggleButton.innerHTML = `
            ${MODE_LABELS[settings.currentMode]}
            <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        `;
        
        followsCountSelect.value = appState['follows'].sequenceCount;
        followsChunkSizeSelect.value = settings.followsChunkSize;
        
        darkModeToggle.checked = settings.isDarkMode;
        speedDeleteToggle.checked = settings.isSpeedDeletingEnabled; 
        pianoAutoplayToggle.checked = settings.isPianoAutoplayEnabled; 
        bananasAutoplayToggle.checked = settings.isBananasAutoplayEnabled;
        followsAutoplayToggle.checked = settings.isFollowsAutoplayEnabled;
        rounds15ClearAfterPlaybackToggle.checked = settings.isRounds15ClearAfterPlaybackEnabled;
        audioPlaybackToggle.checked = settings.isAudioPlaybackEnabled; 
        voiceInputToggle.checked = settings.isVoiceInputEnabled;
        sliderLockToggle.checked = settings.areSlidersLocked; 

        bananasSpeedSlider.value = settings.bananasSpeedMultiplier * 100;
        updateSpeedDisplay(settings.bananasSpeedMultiplier, bananasSpeedDisplay);
        pianoSpeedSlider.value = settings.pianoSpeedMultiplier * 100;
        updateSpeedDisplay(settings.pianoSpeedMultiplier, pianoSpeedDisplay);
        rounds15SpeedSlider.value = settings.rounds15SpeedMultiplier * 100;
        updateSpeedDisplay(settings.rounds15SpeedMultiplier, rounds15SpeedDisplay);
        
        uiScaleSlider.value = settings.uiScaleMultiplier * 100;
        updateScaleDisplay(settings.uiScaleMultiplier, uiScaleDisplay);
        
        updateSliderLockState();
        
        settingsModal.classList.remove('opacity-0', 'pointer-events-none');
        settingsModal.querySelector('div').classList.remove('scale-90');
    }

    function closeSettingsModal() {
        settingsModal.querySelector('div').classList.add('scale-90');
        settingsModal.classList.add('opacity-0');
        setTimeout(() => settingsModal.classList.add('pointer-events-none'), 300);
    }
    
    // --- Help Modal Logic ---

    function generateHelpContent() {
        // This function ALREADY contains the voice command list.
        return `
            <h4 class="text-primary-app">App Overview</h4>
            <p>This is a multi-mode number/sequence tracker designed to help you practice memorization and pattern recognition. Use the Settings menu (⚙️) to switch between four distinct modes.</p>

            <h4 class="text-primary-app">1. Bananas</h4>
            <p>Enter a sequence of numbers (1-9), up to a maximum of 25. When you press the <span class="text-primary-app font-bold">▶ Play</span> button, the app flashes the numbers in order on the key-pad, allowing you to visually review the sequence.</p>
            <ul>
                <li><span class="font-bold">Input:</span> Numbers 1 through 9.</li>
                <li><span class="font-bold">Max Length:</span> 25 numbers.</li>
                <li><span class="font-bold">Demo:</span> Plays back the full sequence.</li>
                <li><span class="font-bold">Autoplay Option:</span> Plays the demo automatically every time you enter a new number (On by default).</li>
            </ul>

            <h4 class="text-primary-app">2. follows</h4>
            <p>This mode is for tracking multiple sequences (2, 3, or 4), up to 25 numbers each. Each sequence is highlighted in turn as you add numbers.</p>
            <ul>
                <li><span class="font-bold">Input:</span> Numbers 1 through 9.</li>
                <li><span class="font-bold">Demo (▶):</span> Plays back all sequences. It plays 'X' numbers from sequence 1, then 'X' from sequence 2, etc., before moving to the next chunk.</li>
                <li><span class="font-bold">Numbers per sequence:</span> Use the Settings (⚙️) to change 'X' (the chunk size) from 2 to 5. Default is 3.</li>
                <li><span class="font-bold">Follows Sequences:</span> Use the Settings (⚙️) to select 2, 3, or 4 active sequences.</li>
                <li><span class="font-bold">Autoplay Option:</span> Plays the demo automatically after you add a number to the *last* sequence (On by default).</li>
            </ul>
            
            <h4 class="text-primary-app">3. piano</h4>
            <p>Record musical notes (C-B) and sharps (1-5). Use this mode to track or create short musical patterns.</p>
            <ul>
                <li><span class="font-bold">Input:</span> White keys (C-B) and black keys (1-5).</li>
                <li><span class="font-bold">Max Length:</span> 20 notes.</li>
                <li><span class="font-bold">Demo:</span> Plays back the recorded sequence, flashing the keys as it goes.</li>
                <li><span class="font-bold">Autoplay Option:</span> Plays the demo automatically every time you enter a new note (On by default).</li>
            </ul>

            <h4 class="text-primary-app">4. 15 rounds</h4>
            <p>This mode guides you through ${appState['rounds15'].maxRound} rounds of increasing sequence length (Round 1 = 1 number, Round 2 = 2 numbers, etc., up to 15).</p>
            <ul>
                <li><span class="font-bold">Workflow:</span> Enter the sequence for the current round (e.g., 3 numbers for Round 3).</li>
                <li><span class="font-bold">Automatic Playback:</span> As soon as you enter the last number for the round, the app will automatically play back the sequence for you.</li>
                <li><span class="font-bold">Automatic Clear/Advance:</span> After playback, the sequence automatically clears, and the app advances to the next round (On by default).</li>
                <li><span class="font-bold">Reset:</span> Hit the <span class="font-bold" style="color: ${tailwind.config.theme.extend.colors['btn-control-red']};">RESET</span> button to go back to Round 1.</li>
            </ul>

            <h4 class="text-primary-app">Global Features & Settings</h4>
            <ul>
                <li><span class="font-bold">Backspace (←):</span> Removes the last entered value.</li>
                <li><span class="font-bold">Voice Input (🎤):</span> (If enabled) Click to speak commands.</li>
                <li><span class="font-bold">Speed Deleting:</span> Hold the backspace key to quickly delete many entries (On by default).</li>
                <li><span class="font-bold">Audio Playback:</span> Speaks the sequence during demo playback (On by default).</li>
                <li><span class="font-bold">Playback Speeds:</span> Adjust the speed sliders to control how quickly the demo features execute.</li>
                <li><span class="font-bold">Sequence Size:</span> Adjust the slider to change the visual size of the number boxes.</li>
                <li><span class="font-bold">Lock Sliders:</span> Prevents accidental changes to the speed and size sliders (On by default).</li>
                <li><span class="font-bold">Dark Mode:</span> Toggles the entire app between Dark and Light visual themes (On by default).</li>
            </ul>

            <h4 class="text-primary-app">Voice Commands (🎤)</h4>
            <p>When enabled, you can speak commands to the app. The app prioritizes adding sequence values first. If no values are heard, it checks for action commands.</p>
            
            <p class="font-bold text-gray-900 dark:text-white mt-4">Sequence Input (Top Priority)</p>
            <ul>
                <li>Say numbers ("one", "five", "twelve") or notes ("C", "E", "F") to add them to the current sequence.</li>
                <li><span class="font-bold">"Clear"</span> / <span class="font-bold">"Delete"</span> / <span class="font-bold">"Back"</span>: Deletes the last entry.</li>
                <li><span class="font-bold">"Reset"</span> / <span class="font-bold">"Reset Rounds"</span>: (15 rounds only) Resets the game to Round 1.</li>
            </ul>
            
            <p class="font-bold text-gray-900 dark:text-white mt-4">Playback & Speed</p>
            <ul>
                <li><span class="font-bold">"Play"</span> / <span class="font-bold">"Demo"</span>: Runs the demo for the current mode.</li>
                <li><span class="font-bold">"Speed Up"</span> / <span class="font-bold">"Faster"</span>: Increases playback speed by 25%.</li>
                <li><span class="font-bold">"Speed Down"</span> / <span class="font-bold">"Slower"</span>: Decreases playback speed by 25%.</li>
                <li><span class="font-bold">"Speed Reset"</span> / <span class="font-bold">"Base Speed"</span>: Resets playback speed to 100%.</li>
            </ul>
            
            <p class="font-bold text-gray-900 dark:text-white mt-4">App Control</p>
            <ul>
                <li><span class="font-bold">"Mode Bananas"</span> / <span class="font-bold">"Switch to Bananas"</span></li>
                <li><span class="font-bold">"Mode Follows"</span> / <span class="font-bold">"Switch to Follows"</span></li>
                <li><span class="font-bold">"Mode Piano"</span> / <span class="font-bold">"Switch to Piano"</span></li>
                <li><span class="font-bold">"Mode Rounds"</span> / <span class="font-bold">"Switch to Rounds"</span></li>
                <li><span class="font-bold">"Settings"</span> / <span class="font-bold">"Open Settings"</span></li>
                <li><span class="font-bold">"Close Settings"</span></li>
                <li><span class="font-bold">"Help"</span> / <span class="font-bold">"Open Help"</span></li>
                <li><span class="font-bold">"Close Help"</span></li>
            </ul>
            
            <p class="font-bold text-gray-900 dark:text-white mt-4">Toggles</p>
            <ul>
                <li><span class="font-bold">"Toggle Dark/Light Mode"</span></li>
                <li><span class="font-bold">"Toggle Audio"</span> / <span class="font-bold">"Toggle Sound"</span></li>
                <li><span class="font-bold">"Toggle Autoplay"</span>: (Bananas, Follows, Piano)</li>
                <li><span class="font-bold">"Toggle Auto Clear"</span>: (15 rounds only)</li>
                <li><span class="font-bold">"Lock/Unlock Sliders"</span></li>
            </ul>
        `;
    }

    function openHelpModal() {
        const helpContentContainer = document.getElementById('help-content');
        
        helpContentContainer.innerHTML = generateHelpContent();
        
        const promptSection = document.getElementById('virtual-assistant-prompts');
        if (promptSection) {
            promptSection.classList.remove('hidden');
            helpContentContainer.appendChild(promptSection);
        }

        helpModal.classList.remove('opacity-0', 'pointer-events-none');
        helpModal.querySelector('div').classList.remove('scale-90');
    }

    function closeHelpModal() {
        const promptSection = document.getElementById('virtual-assistant-prompts');
        
        if (promptSection) {
            promptSection.classList.add('hidden');
            document.body.appendChild(promptSection);
        }

        helpModal.querySelector('div').classList.add('scale-90');
        helpModal.classList.add('opacity-0');
        setTimeout(() => {
            helpModal.classList.add('pointer-events-none');
        }, 300);
    }
    
    // --- Share Modal Functions ---
    function openShareModal() {
        closeSettingsModal(); 
        if (shareModal) {
            shareModal.classList.remove('opacity-0', 'pointer-events-none');
            shareModal.querySelector('div').classList.remove('scale-90');
        }
    }

    function closeShareModal() {
        if (shareModal) {
            shareModal.querySelector('div').classList.add('scale-90');
            shareModal.classList.add('opacity-0');
            setTimeout(() => shareModal.classList.add('pointer-events-none'), 300);
        }
    }
    
    // --- Theme, Speed, and Scale Control ---

    function updateTheme(isDark) {
        settings.isDarkMode = isDark;
        saveSettings(); 
        document.body.classList.toggle('dark', isDark);
        document.body.classList.toggle('light', !isDark);
        renderSequences();
    }
    
    function getSpeedMultiplier(mode) {
        if (mode === 'bananas' || mode === 'follows') return settings.bananasSpeedMultiplier;
        else if (mode === 'piano') return settings.pianoSpeedMultiplier;
        else if (mode === 'rounds15') return settings.rounds15SpeedMultiplier;
        return 1.0; 
    }

    function updateModeSpeed(modeKey, multiplier) {
        settings[`${modeKey}SpeedMultiplier`] = multiplier;
    }

    function updateSpeedDisplay(multiplier, displayElement) {
        const percent = Math.round(multiplier * 100);
        let label = `${percent}%`;
        if (percent === 100) label += ' (Base)';
        else if (percent > 100) label += ' (Fast)';
        else label += ' (Slow)';
        if (displayElement) displayElement.textContent = label;
    }
    
    function updateScaleDisplay(multiplier, displayElement) {
        const percent = Math.round(multiplier * 100);
        let label = `${percent}%`;
        if (percent === 100) label += ' (Base)';
        else if (percent > 100) label += ' (Large)';
        else label += ' (Small)';
        if (displayElement) displayElement.textContent = label;
    }
    
    function updateSliderLockState() {
        const locked = settings.areSlidersLocked;
        if (bananasSpeedSlider) bananasSpeedSlider.disabled = locked;
        if (pianoSpeedSlider) pianoSpeedSlider.disabled = locked;
        if (rounds15SpeedSlider) rounds15SpeedSlider.disabled = locked;
        if (uiScaleSlider) uiScaleSlider.disabled = locked;
    }

    function updateMode(newMode) {
        settings.currentMode = newMode; 
        saveSettings(); 
        
        bananasPad.style.display = settings.currentMode === 'bananas' ? 'block' : 'none';
        followsPad.style.display = settings.currentMode === 'follows' ? 'block' : 'none';
        pianoPad.style.display = settings.currentMode === 'piano' ? 'block' : 'none';
        rounds15Pad.style.display = settings.currentMode === 'rounds15' ? 'block' : 'none';
        
        if (!settingsModal.classList.contains('pointer-events-none') && settingsModeToggleButton) {
            settingsModeToggleButton.innerHTML = `
                ${MODE_LABELS[newMode]}
                <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            `;
        }
        renderSequences();
    }

    function updateMicButtonVisibility() {
        const isEnabled = settings.isVoiceInputEnabled;
        allMicButtons.forEach(btn => {
            btn.classList.toggle('hidden', !isEnabled);
        });
    }
    
    // --- Audio Playback ---
    
    function speak(text) {
        if (!settings.isAudioPlaybackEnabled || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US'; 
            utterance.rate = 1.2; 
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error("Speech synthesis failed:", error);
        }
    }
    
    
    // --- Demo Logic ---
    
    function handleBananasDemo() {
        const state = appState['bananas'];
        const sequenceToPlay = state.sequences[0]; 
        const demoButton = document.querySelector('#bananas-pad button[data-action="play-demo"]');
        const inputKeys = document.querySelectorAll('#bananas-pad button[data-value]');
        const speedMultiplier = getSpeedMultiplier('bananas');
        const currentDelayMs = DEMO_DELAY_BASE_MS / speedMultiplier;
        
        if (sequenceToPlay.length === 0 || (demoButton && demoButton.disabled)) {
            if (demoButton && demoButton.disabled) return;
            if (!settings.isBananasAutoplayEnabled) {
                showModal('No Sequence', 'The sequence is empty. Enter some numbers first!', () => closeModal(), 'OK', '');
            }
            return;
        }

        demoButton.disabled = true;
        inputKeys.forEach(key => key.disabled = true);
        
        let i = 0;
        const flashDuration = 250 * (speedMultiplier > 1 ? (1/speedMultiplier) : 1); 
        const pauseDuration = currentDelayMs; 

        function playNextNumber() {
            if (i < sequenceToPlay.length) {
                const value = sequenceToPlay[i]; 
                const key = document.querySelector(`#bananas-pad button[data-value="${value}"]`);
                demoButton.innerHTML = String(i + 1);
                speak(value);
                if (key) {
                    key.classList.add('bananas-flash');
                    setTimeout(() => {
                        key.classList.remove('bananas-flash');
                        setTimeout(playNextNumber, pauseDuration - flashDuration);
                    }, flashDuration); 
                } else {
                    setTimeout(playNextNumber, pauseDuration);
                }
                i++;
            } else {
                demoButton.disabled = false;
                demoButton.innerHTML = '▶'; 
                inputKeys.forEach(key => key.disabled = false);
            }
        }
        playNextNumber();
    }
    
    function handleFollowsDemo() {
        const state = appState['follows'];
        const demoButton = document.querySelector('#follows-pad button[data-action="play-demo"]');
        const inputKeys = document.querySelectorAll('#follows-pad button[data-value]');
        const speedMultiplier = getSpeedMultiplier('follows');
        const currentDelayMs = DEMO_DELAY_BASE_MS / speedMultiplier;
        const chunkSize = settings.followsChunkSize;
        const numSequences = state.sequenceCount;
        const activeSequences = state.sequences.slice(0, numSequences);
        const maxLength = Math.max(...activeSequences.map(s => s.length));
        
        if (maxLength === 0 || (demoButton && demoButton.disabled)) {
             if (demoButton && demoButton.disabled) return;
            if (!settings.isFollowsAutoplayEnabled) {
                showModal('No Sequence', 'The sequences are empty. Enter some numbers first!', () => closeModal(), 'OK', '');
            }
            return;
        }
        
        const playlist = [];
        const numChunks = Math.ceil(maxLength / chunkSize);

        for (let chunkNum = 0; chunkNum < numChunks; chunkNum++) {
            for (let seqIndex = 0; seqIndex < numSequences; seqIndex++) {
                for (let k = 0; k < chunkSize; k++) {
                    const valueIndex = (chunkNum * chunkSize) + k;
                    if (valueIndex < activeSequences[seqIndex].length) {
                        const value = activeSequences[seqIndex][valueIndex];
                        playlist.push({ seqIndex: seqIndex, value: value });
                    }
                }
            }
        }
        
        if (playlist.length === 0) return;

        demoButton.disabled = true;
        inputKeys.forEach(key => key.disabled = true);
        
        let i = 0;
        const flashDuration = 250 * (speedMultiplier > 1 ? (1/speedMultiplier) : 1); 
        const pauseDuration = currentDelayMs;

        function playNextItem() {
            if (i < playlist.length) {
                const item = playlist[i];
                const { seqIndex, value } = item;
                const key = document.querySelector(`#follows-pad button[data-value="${value}"]`);
                const seqBox = sequenceContainer.children[seqIndex];
                const originalClasses = seqBox ? seqBox.dataset.originalClasses : '';
                
                demoButton.innerHTML = String(i + 1);
                speak(value);

                if (key) key.classList.add('bananas-flash');
                if (seqBox) seqBox.className = 'p-4 rounded-xl shadow-md transition-all duration-200 bg-accent-app scale-[1.02] shadow-lg text-gray-900';
                
                setTimeout(() => {
                    if (key) key.classList.remove('bananas-flash');
                    if (seqBox) seqBox.className = originalClasses;
                    setTimeout(playNextItem, pauseDuration - flashDuration);
                }, flashDuration);
                        
                i++;
            } else {
                demoButton.disabled = false;
                demoButton.innerHTML = '▶'; 
                inputKeys.forEach(key => key.disabled = false);
                renderSequences();
            }
        }
        playNextItem();
    }

    function flashKey(value, duration) {
        const key = document.querySelector(`#piano-pad button[data-value="${value}"]`);
        if (key) {
            key.classList.add('flash');
            setTimeout(() => key.classList.remove('flash'), duration);
        }
    }
    
    function handlePianoDemo() {
        const state = appState['piano'];
        const sequenceToPlay = state.sequences[0]; 
        const demoButton = document.querySelector('#piano-pad button[data-action="demo"]');
        const speedMultiplier = getSpeedMultiplier('piano');
        const currentDelayMs = DEMO_DELAY_BASE_MS / speedMultiplier;

        if (sequenceToPlay.length === 0 || (demoButton && demoButton.disabled)) {
            if (!settings.isPianoAutoplayEnabled || (demoButton && demoButton.disabled)) {
                 if (demoButton && demoButton.disabled) return; 
                showModal('No Sequence', 'The sequence is empty. Enter some notes first!', () => closeModal(), 'OK', '');
            }
            return;
        }

        demoButton.disabled = true;
        const keys = document.querySelectorAll('#piano-pad button[data-value]');
        keys.forEach(key => key.disabled = true);
        document.querySelector('#piano-pad button[data-action="backspace"]').disabled = false;
        document.querySelector('#piano-pad button[data-action="open-settings"]').disabled = false;

        let i = 0;
        const flashDuration = currentDelayMs * 0.8; 

        function playNextKey() {
            if (i < sequenceToPlay.length) {
                const value = sequenceToPlay[i];
                demoButton.innerHTML = String(i + 1); 
                speak(PIANO_SPEAK_MAP[value] || value); 
                flashKey(value, flashDuration);
                i++;
                setTimeout(playNextKey, currentDelayMs);
            } else {
                demoButton.disabled = false;
                demoButton.innerHTML = '▶'; 
                keys.forEach(key => key.disabled = false);
            }
        }
        playNextKey();
    }

    function advanceToNextRound() {
        const state = appState['rounds15'];
        state.currentRound++;
        if (state.currentRound > state.maxRound) {
            state.currentRound = 1;
            showModal('Complete!', `You finished all ${state.maxRound} rounds. Resetting to Round 1.`, () => closeModal(), 'OK', '');
        }
        renderSequences(); 
        saveState(); 
        const allKeys = document.querySelectorAll('#rounds15-pad button[data-value]');
        allKeys.forEach(key => key.disabled = false);
    }

    function resetRounds15() {
        const state = appState['rounds15'];
        state.currentRound = 1;
        state.sequences[0] = [];
        state.nextSequenceIndex = 0;
        const allKeys = document.querySelectorAll('#rounds15-pad button[data-value]');
        allKeys.forEach(key => key.disabled = false);
        renderSequences();
        saveState(); 
    }
    
    // *** MODIFIED: Saves state ONCE, after the loop is finished ***
    function clearRounds15Sequence() {
        const state = appState['rounds15'];
        const sequence = state.sequences[0];
        
        if (sequence.length === 0) {
            advanceToNextRound();
            return;
        }
        
        if (speedDeleteInterval) clearInterval(speedDeleteInterval);
        speedDeleteInterval = null;

        function rapidDelete() {
            if (sequence.length > 0) {
                sequence.pop();
                state.nextSequenceIndex--;
                renderSequences();
            } else {
                clearInterval(speedDeleteInterval);
                speedDeleteInterval = null;
                saveState(); // <-- SAVE IS MOVED HERE
                advanceToNextRound(); 
            }
        }
        setTimeout(() => {
            speedDeleteInterval = setInterval(rapidDelete, SPEED_DELETE_INTERVAL_MS);
        }, 10);
    }

    function handleRounds15Demo() {
        const state = appState['rounds15'];
        const sequenceToPlay = state.sequences[0]; 
        const demoButton = document.querySelector('#rounds15-pad button[data-action="demo"]');
        const allKeys = document.querySelectorAll('#rounds15-pad button[data-value]');
        const speedMultiplier = settings.rounds15SpeedMultiplier;
        const currentDelayMs = DEMO_DELAY_BASE_MS / speedMultiplier;

        if (sequenceToPlay.length === 0 || (demoButton.disabled && !settings.isRounds15ClearAfterPlaybackEnabled) ) {
            if (demoButton && demoButton.disabled && !settings.isRounds15ClearAfterPlaybackEnabled) return;
            showModal('No Sequence', 'The sequence is empty. Enter some numbers first!', () => closeModal(), 'OK', '');
            allKeys.forEach(key => key.disabled = false);
            return;
        }

        demoButton.disabled = true;
        allKeys.forEach(key => key.disabled = true);
        document.querySelector('#rounds15-pad button[data-action="backspace"]').disabled = false;
        document.querySelector('#rounds15-pad button[data-action="open-settings"]').disabled = false;
        document.querySelector('#rounds15-pad button[data-action="reset-rounds"]').disabled = false;

        let i = 0;
        const flashDuration = 250 * (speedMultiplier > 1 ? (1/speedMultiplier) : 1);
        const pauseDuration = currentDelayMs; 

        function playNextNumber() {
            if (i < sequenceToPlay.length) {
                const value = sequenceToPlay[i]; 
                const key = document.querySelector(`#rounds15-pad button[data-value="${value}"]`);
                demoButton.innerHTML = String(i + 1); 
                speak(value); 
                if (key) {
                    key.classList.add('demo-flash-rounds15');
                    setTimeout(() => {
                        key.classList.remove('demo-flash-rounds15');
                        setTimeout(playNextNumber, pauseDuration - flashDuration);
                    }, flashDuration); 
                } else {
                    setTimeout(playNextNumber, pauseDuration);
                }
                i++;
            } else {
                demoButton.disabled = false;
                demoButton.innerHTML = '▶'; 
                
                if (settings.isRounds15ClearAfterPlaybackEnabled) {
                    setTimeout(clearRounds15Sequence, 300); 
                } else {
                    allKeys.forEach(key => key.disabled = false);
                }
            }
        }
        playNextNumber();
    }

    function handleCurrentDemo() {
        switch(settings.currentMode) { 
            case 'bananas': handleBananasDemo(); break;
            case 'follows': handleFollowsDemo(); break;
            case 'piano': handlePianoDemo(); break;
            case 'rounds15': handleRounds15Demo(); break;
        }
    }

    function adjustSpeed(amount, reset = false) {
        let slider, display, modeKey;
        
        if (settings.currentMode === 'bananas' || settings.currentMode === 'follows') {
            slider = bananasSpeedSlider;
            display = bananasSpeedDisplay;
            modeKey = 'bananas';
        } else if (settings.currentMode === 'piano') {
            slider = pianoSpeedSlider;
            display = pianoSpeedDisplay;
            modeKey = 'piano';
        } else if (settings.currentMode === 'rounds15') {
            slider = rounds15SpeedSlider;
            display = rounds15SpeedDisplay;
            modeKey = 'rounds15';
        } else {
            return;
        }

        let currentMultiplier = settings[`${modeKey}SpeedMultiplier`];
        let newMultiplier;

        if (reset) {
            newMultiplier = 1.0;
        } else {
            newMultiplier = Math.max(0.5, Math.min(1.5, currentMultiplier + amount));
        }
        
        settings[`${modeKey}SpeedMultiplier`] = newMultiplier;
        saveSettings(); 
        slider.value = newMultiplier * 100;
        updateSpeedDisplay(newMultiplier, display);
        speak(`${Math.round(newMultiplier * 100)}% speed`);
    }

    // --- Modal/Message Box Implementation ---
    
    function showModal(title, message, onConfirm, confirmText = 'OK', cancelText = 'Cancel') {
        if (!customModal) return;
        
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        
        const oldConfirmBtn = document.getElementById('modal-confirm');
        const oldCancelBtn = document.getElementById('modal-cancel');
        
        const newConfirmBtn = oldConfirmBtn.cloneNode(true); 
        newConfirmBtn.textContent = confirmText;
        oldConfirmBtn.parentNode.replaceChild(newConfirmBtn, oldConfirmBtn); 
        
        const newCancelBtn = oldCancelBtn.cloneNode(true);
        newCancelBtn.textContent = cancelText;
        oldCancelBtn.parentNode.replaceChild(newCancelBtn, oldCancelBtn);

        newConfirmBtn.addEventListener('click', () => { onConfirm(); closeModal(); }); 
        newCancelBtn.addEventListener('click', closeModal); 
        
        newCancelBtn.style.display = cancelText ? 'inline-block' : 'none';
        
        newConfirmBtn.className = 'px-4 py-2 text-white rounded-lg transition-colors font-semibold bg-primary-app hover:bg-secondary-app';
        
        setTimeout(() => {
            customModal.classList.remove('opacity-0', 'pointer-events-none');
            customModal.querySelector('div').classList.remove('scale-90');
        }, 10);
    }

    function closeModal() {
        if (customModal) {
            customModal.querySelector('div').classList.add('scale-90');
            customModal.classList.add('opacity-0');
            setTimeout(() => customModal.classList.add('pointer-events-none'), 300);
        }
    }

    // --- Voice Input Functions ---

    function processVoiceTranscript(transcript) {
        if (!transcript) return;
        
        const cleanTranscript = transcript.toLowerCase().replace(/[\.,]/g, '').trim();
        const words = cleanTranscript.split(' ');
        let valuesAdded = 0;

        // --- Priority 1: Check for Sequence Values ---
        for (const word of words) {
            let value = VOICE_VALUE_MAP[word];
            
            if (!value) {
                 const upperWord = word.toUpperCase();
                 if (/^[1-9]$/.test(word) || /^(1[0-2])$/.test(word)) { // 1-12
                    value = word;
                 } else if (/^[A-G]$/.test(upperWord) || /^[1-5]$/.test(word)) { // A-G, 1-5
                    value = upperWord;
                 }
            }

            if (value) {
                if (settings.currentMode === 'bananas' || settings.currentMode === 'follows') {
                    if (/^[1-9]$/.test(value)) {
                        addValue(value);
                        valuesAdded++;
                    }
                } else if (settings.currentMode === 'piano') {
                    if ((/^[1-5]$/.test(value) || /^[A-G]$/.test(value))) {
                        addValue(value);
                        valuesAdded++;
                    }
                } else if (settings.currentMode === 'rounds15') {
                    if (/^(?:[1-9]|1[0-2])$/.test(value)) {
                        addValue(value);
                        valuesAdded++;
                    }
                }
            }
        }

        // If we added a value, that was the user's intent. Stop here.
        if (valuesAdded > 0) {
            return;
        }

        // --- Priority 2: Check for Action Commands (if no values were added) ---
        
        // Check for an exact action command
        if (VOICE_ACTION_MAP[cleanTranscript]) {
            VOICE_ACTION_MAP[cleanTranscript]();
            return;
        }

        // Check for action commands that might be *part* of the transcript
        for (const phrase in VOICE_ACTION_MAP) {
            if (cleanTranscript.includes(phrase)) {
                VOICE_ACTION_MAP[phrase]();
                return; // Only execute the first matching command
            }
        }
        
        // If no values AND no commands, log it.
        console.log(`Unknown voice command or value: ${transcript}`);
    }


    function handleVoiceResult(event) {
        const transcript = event.results[0][0].transcript.trim();
        processVoiceTranscript(transcript);
    }

    function handleVoiceError(event) {
        console.error('Voice Error:', event.error);
        if (event.error === 'not-allowed') {
            showModal('Permission Denied', 'You have blocked microphone access. To use voice input, please allow microphone access in your browser settings.', () => closeModal(), 'OK', '');
            settings.isVoiceInputEnabled = false;
            voiceInputToggle.checked = false;
            updateMicButtonVisibility();
            saveSettings(); 
        }
        stopListening();
    }
    
    function stopListening() {
        if (!isListening) return;
        isListening = false;
        if(recognitionApi) recognitionApi.stop();
        
        allMicButtons.forEach(btn => {
            btn.classList.remove('voice-active');
            btn.innerHTML = '🎤';
        });
    }
    
    function startListening() {
        if (!recognitionApi || isListening) return;
        
        isListening = true;
        
        const currentMicButton = document.querySelector(`#${settings.currentMode}-pad button[data-action="voice-input"]`);
        if (currentMicButton) {
            currentMicButton.classList.add('voice-active');
            currentMicButton.innerHTML = '...';
        }

        try {
            recognitionApi.lang = 'en-US';
            recognitionApi.continuous = false;
            recognitionApi.interimResults = false;
            recognitionApi.maxAlternatives = 1;
            
            recognitionApi.onresult = handleVoiceResult;
            recognitionApi.onend = stopListening;
            recognitionApi.onerror = handleVoiceError;
            
            recognitionApi.start();
        } catch (err) {
            console.error("Failed to start recognition:", err);
            stopListening();
        }
    }


    // --- Event Listeners Setup ---
    
    function initializeListeners() {
        
        document.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;

            const { value, action, mode, modeSelect, copyTarget } = button.dataset;

            if (copyTarget) {
                const targetElement = document.getElementById(copyTarget);
                if (targetElement) {
                    targetElement.select();
                    try {
                        document.execCommand('copy');
                        const originalText = button.innerHTML;
                        button.innerHTML = "Copied!";
                        button.classList.add('copied');
                        setTimeout(() => {
                            button.innerHTML = originalText;
                            button.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                        navigator.clipboard.writeText(targetElement.value).catch(err => {
                            console.error('Clipboard API failed: ', err);
                        });
                    }
                }
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
            if (modeSelect) {
                handleModeSelection(modeSelect);
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
            if (action === 'play-demo' && mode === 'follows') {
                handleFollowsDemo();
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

            if (action === 'voice-input' && mode === settings.currentMode) {
                if (isListening) {
                    stopListening();
                } else {
                    startListening();
                }
                return;
            }
            
            if (value && mode === settings.currentMode) {
                if ((settings.currentMode === 'bananas' || settings.currentMode === 'follows') && /^[1-9]$/.test(value)) {
                    addValue(value);
                }
                else if (settings.currentMode === 'piano' && (/^[1-5]$/.test(value) || /^[A-G]$/.test(value))) {
                    if (!settings.isPianoAutoplayEnabled) flashKey(value, 200);
                    addValue(value);
                }
                else if (settings.currentMode === 'rounds15' && /^(?:[1-9]|1[0-2])$/.test(value)) {
                    addValue(value);
                }
            }
        });
        
        // *** MODIFIED: All backspace listeners point to the new Start/End functions ***
        document.querySelectorAll('button[data-action="backspace"]').forEach(btn => {
            btn.addEventListener('mousedown', handleBackspaceStart);
            btn.addEventListener('mouseup', handleBackspaceEnd);
            btn.addEventListener('mouseleave', handleBackspaceEnd); // Use End to stop and save
            btn.addEventListener('touchstart', handleBackspaceStart, { passive: false });
            btn.addEventListener('touchend', handleBackspaceEnd);
        });
        
        settingsModeToggleButton.addEventListener('click', toggleModeDropdown);
        document.getElementById('close-settings').addEventListener('click', closeSettingsModal);
        
        document.getElementById('restore-defaults-button').addEventListener('click', () => {
            localStorage.removeItem(SETTINGS_KEY);
            localStorage.removeItem(STATE_KEY);
            window.location.reload();
        });
        
        followsCountSelect.addEventListener('change', (event) => {
            const newCount = parseInt(event.target.value);
            const state = appState['follows'];
            state.sequenceCount = newCount;
            state.nextSequenceIndex = 0;
            renderSequences(); 
            saveState(); 
        });
        followsChunkSizeSelect.addEventListener('change', (event) => {
            settings.followsChunkSize = parseInt(event.target.value);
            saveSettings(); 
        });
        
        darkModeToggle.addEventListener('change', (e) => updateTheme(e.target.checked));
        speedDeleteToggle.addEventListener('change', (e) => {
            settings.isSpeedDeletingEnabled = e.target.checked;
            saveSettings(); 
        });
        pianoAutoplayToggle.addEventListener('change', (e) => {
            settings.isPianoAutoplayEnabled = e.target.checked;
            saveSettings(); 
        });
        bananasAutoplayToggle.addEventListener('change', (e) => {
            settings.isBananasAutoplayEnabled = e.target.checked;
            saveSettings(); 
        });
        followsAutoplayToggle.addEventListener('change', (e) => {
            settings.isFollowsAutoplayEnabled = e.target.checked;
            saveSettings(); 
        });
        rounds15ClearAfterPlaybackToggle.addEventListener('change', (e) => {
            settings.isRounds15ClearAfterPlaybackEnabled = e.target.checked;
            saveSettings(); 
        });
        audioPlaybackToggle.addEventListener('change', (e) => {
            settings.isAudioPlaybackEnabled = e.target.checked;
            if (settings.isAudioPlaybackEnabled) speak("Audio");
            saveSettings(); 
        });
        voiceInputToggle.addEventListener('change', (e) => {
            settings.isVoiceInputEnabled = e.target.checked;
            updateMicButtonVisibility();
            saveSettings(); 
            if (settings.isVoiceInputEnabled && !recognitionApi) {
                showModal('Not Supported', 'Your browser does not support the Web Speech API. The mic button will be hidden.', () => {
                    settings.isVoiceInputEnabled = false;
                    voiceInputToggle.checked = false;
                    updateMicButtonVisibility();
                    saveSettings(); 
                    closeModal();
                }, 'OK', '');
            }
        });
        sliderLockToggle.addEventListener('change', (e) => {
            settings.areSlidersLocked = e.target.checked;
            updateSliderLockState();
            saveSettings(); 
        });

        function setupSpeedSlider(slider, displayElement, modeKey) {
            slider.addEventListener('input', (event) => {
                const multiplier = parseInt(event.target.value) / 100;
                updateModeSpeed(modeKey, multiplier);
                updateSpeedDisplay(multiplier, displayElement);
                saveSettings(); 
            });
        }
        setupSpeedSlider(bananasSpeedSlider, bananasSpeedDisplay, 'bananas');
        setupSpeedSlider(pianoSpeedSlider, pianoSpeedDisplay, 'piano');
        setupSpeedSlider(rounds15SpeedSlider, rounds15SpeedDisplay, 'rounds15');
        
        uiScaleSlider.addEventListener('input', (event) => {
            const multiplier = parseInt(event.target.value) / 100;
            settings.uiScaleMultiplier = multiplier;
            updateScaleDisplay(multiplier, uiScaleDisplay);
            renderSequences();
            saveSettings(); 
        });
        
        document.getElementById('close-help').addEventListener('click', closeHelpModal);
        document.getElementById('close-share').addEventListener('click', closeShareModal);
    }
    
    // --- Initialization ---
    window.onload = function() {
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        }

        updateTheme(settings.isDarkMode);
        updateSpeedDisplay(settings.bananasSpeedMultiplier, bananasSpeedDisplay);
        updateSpeedDisplay(settings.pianoSpeedMultiplier, pianoSpeedDisplay);
        updateSpeedDisplay(settings.rounds15SpeedMultiplier, rounds15SpeedDisplay);
        updateScaleDisplay(settings.uiScaleMultiplier, uiScaleDisplay);
        updateSliderLockState();
        updateMicButtonVisibility();
        
        if (settings.isVoiceInputEnabled && !recognitionApi) {
            showModal('Voice Not Supported', 'Your browser does not support the Web Speech API. The mic button will be hidden.', () => {
                settings.isVoiceInputEnabled = false;
                voiceInputToggle.checked = false;
                updateMicButtonVisibility();
                saveSettings(); 
                closeModal();
            }, 'OK', '');
        }
        
        initializeListeners();
        
        updateMode(settings.currentMode); 
        
        if (settings.isAudioPlaybackEnabled) speak(" "); 
    };

})(); // End IIFE
ctions now use the loaded 'settings' object ***
        updateTheme(settings.isDarkMode);
        updateSpeedDisplay(settings.bananasSpeedMultiplier, bananasSpeedDisplay);
        updateSpeedDisplay(settings.pianoSpeedMultiplier, pianoSpeedDisplay);
        updateSpeedDisplay(settings.rounds15SpeedMultiplier, rounds15SpeedDisplay);
        updateScaleDisplay(settings.uiScaleMultiplier, uiScaleDisplay);
        updateSliderLockState();
        updateMicButtonVisibility();
        
        if (settings.isVoiceInputEnabled && !recognitionApi) {
            showModal('Voice Not Supported', 'Your browser does not support the Web Speech API. The mic button will be hidden.', () => {
                settings.isVoiceInputEnabled = false;
                voiceInputToggle.checked = false;
                updateMicButtonVisibility();
                saveSettings(); // *** NEW: Save settings ***
                closeModal();
            }, 'OK', '');
        }
        
        initializeListeners();
        
        updateMode(settings.currentMode); // *** MODIFIED: Load the saved mode ***
        
        if (settings.isAudioPlaybackEnabled) speak(" "); 
    };

})(); // End IIFE
