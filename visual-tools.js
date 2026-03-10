/**
 * visual-tools.js - Advanced Visual Editors
 * Includes State Machine, Audio Synth, and Sprite Slicer.
 */

// --- 1. State Machine Builder ---
let stateNodes = [];

function openStateMachineBuilder() {
    const container = document.getElementById('visual-view');
    if (!container) return;

    // We clear the visual view and inject the specialized builder UI
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">⚙️ State Machine Builder</h2>
            <button class="btn-danger" onclick="switchTab('visual')">Back</button>
        </div>
        <p style="font-size:12px; color:var(--muted);">Define your game states (e.g. IDLE, SPINNING, WIN) and generate the logic.</p>
        
        <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="state-name-input" placeholder="State Name..." style="flex:1; padding:8px; background:var(--bg); border:1px solid var(--border); color:white; border-radius:4px;">
            <button class="btn-primary" onclick="addStateNode()">+ Add State</button>
        </div>

        <div id="state-canvas" style="width:100%; min-height:300px; background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:15px; display:flex; flex-wrap:wrap; gap:10px;">
            </div>

        <button class="btn-warn" style="width:100%; margin-top:15px; font-weight:bold;" onclick="generateStateCode()">GENERATE JS LOGIC</button>
    `;
    renderStateNodes();
}

function addStateNode() {
    const input = document.getElementById('state-name-input');
    const name = input.value.toUpperCase().replace(/\s+/g, '_');
    if (name && !stateNodes.includes(name)) {
        stateNodes.push(name);
        input.value = '';
        renderStateNodes();
        triggerHaptic('light');
    }
}

function renderStateNodes() {
    const canvas = document.getElementById('state-canvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    stateNodes.forEach((node, index) => {
        const div = document.createElement('div');
        div.style.cssText = `background:var(--accent); color:white; padding:10px 15px; border-radius:20px; font-weight:bold; font-size:12px; display:flex; align-items:center; gap:10px;`;
        div.innerHTML = `${node} <span onclick="removeState(${index})" style="cursor:pointer; color:var(--danger);">✖</span>`;
        canvas.appendChild(div);
    });
}

function removeState(index) {
    stateNodes.splice(index, 1);
    renderStateNodes();
}

function generateStateCode() {
    if (stateNodes.length === 0) return;
    let code = `/**\n * Generated State Machine\n */\nconst States = {\n`;
    stateNodes.forEach(s => code += `    ${s}: '${s}',\n`);
    code += `};\n\nlet currentState = States.${stateNodes[0]};\n\nfunction handleStateChange(newState) {\n    console.log('State Transition:', currentState, '->', newState);\n    currentState = newState;\n\n    switch(currentState) {\n`;
    stateNodes.forEach(s => {
        code += `        case States.${s}:\n            // Logic for ${s}\n            break;\n`;
    });
    code += `    }\n}`;
    
    vfs['state_machine.js'] = code;
    saveVFS();
    renderFileList();
    openTab('state_machine.js');
    triggerHaptic('success');
    alert("State Machine Logic generated and saved as state_machine.js");
}

// --- 2. Audio Synthesizer ---
let audioCtx = null;

function openAudioSynth() {
    const container = document.getElementById('visual-view');
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">🎵 Audio Synth</h2>
            <button class="btn-danger" onclick="switchTab('visual')">Back</button>
        </div>
        <div class="tool-card" style="display:flex; flex-direction:column; gap:15px;">
            <label>Waveform: 
                <select id="synth-type" class="select-box" style="width:100%;">
                    <option value="sine">Sine (Soft)</option>
                    <option value="square">Square (Retro)</option>
                    <option value="sawtooth">Sawtooth (Harsh)</option>
                    <option value="triangle">Triangle (Flute-like)</option>
                </select>
            </label>
            <label>Frequency (Hz): <input type="range" id="synth-freq" min="100" max="2000" value="440" style="width:100%;"></label>
            <label>Duration (sec): <input type="range" id="synth-dur" min="0.1" max="2" step="0.1" value="0.5" style="width:100%;"></label>
            
            <button class="btn-primary" onclick="testSound()">🔊 Test Sound</button>
            <button class="btn-warn" onclick="generateAudioCode()">💾 Generate JS Function</button>
        </div>
    `;
}

function testSound() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    const type = document.getElementById('synth-type').value;
    const freq = document.getElementById('synth-freq').value;
    const dur = document.getElementById('synth-dur').value;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + parseFloat(dur));
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + parseFloat(dur));
    triggerHaptic('light');
}

function generateAudioCode() {
    const type = document.getElementById('synth-type').value;
    const freq = document.getElementById('synth-freq').value;
    const dur = document.getElementById('synth-dur').value;

    const code = `function playCustomSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = '${type}';
    osc.frequency.setValueAtTime(${freq}, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ${dur});
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ${dur});
}`;

    vfs['audio_engine.js'] = code;
    saveVFS();
    renderFileList();
    openTab('audio_engine.js');
    alert("Audio logic saved to audio_engine.js");
}

// --- 3. Sprite Slicer ---
function openSpriteSlicer() {
    const container = document.getElementById('visual-view');
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">🖼️ Sprite Slicer</h2>
            <button class="btn-danger" onclick="switchTab('visual')">Back</button>
        </div>
        <p style="font-size:12px; color:var(--muted);">Import an image to generate CSS mapping classes.</p>
        <input type="file" id="sprite-upload" accept="image/*" onchange="handleSpriteUpload(event)" style="margin-bottom:15px;">
        <div id="sprite-preview-container" style="width:100%; overflow:auto; background:var(--panel); border:1px solid var(--border); border-radius:8px; position:relative;">
            <canvas id="sprite-canvas-tool"></canvas>
        </div>
        <div style="margin-top:15px; display:flex; gap:10px;">
            <input type="number" id="sprite-w" placeholder="Grid W" style="width:50%; padding:8px; background:var(--bg); border:1px solid var(--border); color:white;">
            <input type="number" id="sprite-h" placeholder="Grid H" style="width:50%; padding:8px; background:var(--bg); border:1px solid var(--border); color:white;">
        </div>
        <button class="btn-warn" style="width:100%; margin-top:10px;" onclick="generateSpriteCSS()">Generate Sprite CSS</button>
    `;
}

let loadedSprite = null;
function handleSpriteUpload(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            loadedSprite = img;
            const canvas = document.getElementById('sprite-canvas-tool');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function generateSpriteCSS() {
    if (!loadedSprite) return;
    const w = document.getElementById('sprite-w').value || 32;
    const h = document.getElementById('sprite-h').value || 32;
    
    let css = `.sprite {\n    background-image: url('YOUR_IMAGE_HERE');\n    display: inline-block;\n    width: ${w}px;\n    height: ${h}px;\n}\n`;
    
    const cols = Math.floor(loadedSprite.width / w);
    const rows = Math.floor(loadedSprite.height / h);
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            css += `.icon-${r}-${c} { background-position: -${c * w}px -${r * h}px; }\n`;
        }
    }
    
    vfs['sprites.css'] = css;
    saveVFS();
    renderFileList();
    openTab('sprites.css');
    alert("Sprite CSS generated and saved to sprites.css");
}
