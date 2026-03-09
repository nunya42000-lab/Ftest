/* DevOS Main Engine - Enhanced Debugging & Diagnostics Edition */

localforage.config({ name: 'DevOS' });

// --- Global State ---
let vfs = {}; 
let currentFile = null;
let cmEditor = null;
let snippets = [];
let snapshots = [];
let autoSaveTimer;
let lintTimer;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data
    vfs = (await localforage.getItem('devos_vfs')) || { 'index.html': '<h1>Ready.</h1>' };
    snippets = (await localforage.getItem('vault_snippets')) || [];
    snapshots = (await localforage.getItem('devos_snapshots')) || [];
    
    // 2. Initialize CodeMirror
    const textArea = document.getElementById('code-editor');
    cmEditor = CodeMirror.fromTextArea(textArea, {
        lineNumbers: true,
        theme: 'dracula',
        mode: 'javascript',
        autoCloseBrackets: true,
        autoCloseTags: true,
        lineWrapping: true,
        indentUnit: 4,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
    });

    cmEditor.on('change', () => {
        triggerAutoSave();
        triggerReactiveLint();
    });

    // 3. Vault Gesture: Double-Tap to Save Snippet
    cmEditor.getWrapperElement().addEventListener('dblclick', async (e) => {
        const selectedText = cmEditor.getSelection();
        if (selectedText && selectedText.trim().length > 0) {
            e.preventDefault(); 
            const name = prompt("Enter snippet name:", "New Snippet");
            if (name) {
                snippets.push({ name, code: selectedText, id: Date.now() });
                await localforage.setItem('vault_snippets', snippets);
                renderVault();
                logDiag(`Saved "${name}" to Vault.`, "success");
            }
        }
    });

    // 4. Apply Settings (Toolbar visibility)
    const savedToolbarState = localStorage.getItem('settings_show_toolbar') !== 'false';
    document.getElementById('toggle-toolbar').checked = savedToolbarState;
    applyToolbarState(savedToolbarState);

    renderFileList();
    renderVault();
});

// --- Workspace UI Logic ---

function switchTab(tabId, event) {
    document.querySelectorAll('.panel-box').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById('view-' + tabId);
    if(target) target.classList.add('active');
    
    // Ensure toolbar state is respected and editor refreshes layout
    if (tabId === 'editor') {
        const show = localStorage.getItem('settings_show_toolbar') !== 'false';
        applyToolbarState(show);
        setTimeout(() => cmEditor.refresh(), 50);
    }
    
    if (event) event.currentTarget.classList.add('active');
}

function toggleMobileToolbar() {
    const show = document.getElementById('toggle-toolbar').checked;
    localStorage.setItem('settings_show_toolbar', show);
    applyToolbarState(show);
}

function applyToolbarState(show) {
    const toolbar = document.getElementById('mobile-toolbar');
    if (toolbar) {
        toolbar.style.display = show ? 'flex' : 'none';
        if (cmEditor) cmEditor.refresh();
    }
}

function toggleSidebar() {
    document.getElementById('ui-sidebar').classList.toggle('collapsed');
}

// --- Debugging & Diagnostic Tools ---

function triggerReactiveLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => {
        if (currentFile && (currentFile.endsWith('.js') || currentFile.endsWith('.json'))) {
            runLinter();
        }
    }, 2000); 
}

function runLinter() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    const ext = currentFile.split('.').pop().toLowerCase();
    let results = "";

    if (ext === 'js') {
        JSHINT(code, { esversion: 11, browser: true, module: true });
        if (JSHINT.errors.length > 0) {
            JSHINT.errors.forEach(e => { if (e) results += `✖ Line ${e.line}: ${e.reason}\n`; });
            logDiag(results, "error");
        } else { logDiag("✔ JavaScript Check: No syntax errors.", "success"); }
    } else if (ext === 'json') {
        try { JSON.parse(code); logDiag("✔ JSON Check: Valid.", "success"); } 
        catch (e) { logDiag("✖ JSON Error: " + e.message, "error"); }
    }
}

function performSearch() {
    const query = document.getElementById('search-query').value.toLowerCase();
    if (!query) return logDiag("Search: Please enter a keyword.", "error");

    let results = `Search Results for "${query}":\n\n`;
    let found = 0;

    Object.entries(vfs).forEach(([name, code]) => {
        const lines = code.split('\n');
        lines.forEach((line, i) => {
            if (line.toLowerCase().includes(query)) {
                results += `[${name}] L${i + 1}: ${line.trim()}\n`;
                found++;
            }
        });
    });
    
    logDiag(found > 0 ? results : "Search: No matches found in VFS.", found > 0 ? "info" : "error");
}

function visualizeDependencies() {
    let map = "Dependency Mapping:\n\n";
    // Regex matches local imports and script sources
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"])|(?:src=['"]([^'"]+)['"])/g;

    Object.entries(vfs).forEach(([fn, code]) => {
        let deps = [];
        let match;
        while ((match = importRegex.exec(code)) !== null) {
            const path = match[1] || match[2];
            if (path && !path.startsWith('http')) deps.push(path);
        }
        if (deps.length > 0) {
            map += `📦 ${fn}\n${deps.map(d => `  └── 🔗 ${d}`).join('\n')}\n\n`;
        }
    });
    logDiag(map || "Diagnostics: No local dependencies detected.", "info");
}

function runPreview() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    let html = vfs['index.html'] || '<h1>No index.html found.</h1>';

    // Injected console hook for better object inspection
    const hook = `
    <script>
        const formatArg = (arg) => (typeof arg === 'object') ? JSON.stringify(arg, null, 2) : String(arg);
        console.log = (...args) => {
            const d = window.parent.document.getElementById('console-output');
            d.innerHTML += '<div class="log-msg">> ' + args.map(formatArg).join(' ') + '</div>';
            d.scrollTop = d.scrollHeight;
        };
        window.onerror = (m, u, l) => {
            const d = window.parent.document.getElementById('console-output');
            d.innerHTML += '<div class="log-error">✖ Line ' + l + ': ' + m + '</div>';
        };
    <\/script>`;

    const frame = document.getElementById('preview-frame');
    document.getElementById('console-output').innerHTML = '';
    frame.srcdoc = html.replace('<head>', '<head>' + hook);
    switchTab('run');
}

// --- File System Operations ---

async function saveVFS() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    await localforage.setItem('devos_vfs', vfs);
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        await saveVFS();
        flashSaveStatus();
    }, 1000);
}

function flashSaveStatus() {
    const msg = document.getElementById('status-msg');
    msg.style.opacity = '1';
    setTimeout(() => msg.style.opacity = '0', 2000);
}

function renderFileList() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    Object.keys(vfs).forEach(name => {
        const div = document.createElement('div');
        div.className = `file-item ${name === currentFile ? 'active' : ''}`;
        div.innerHTML = `<span>${name}</span><button onclick="deleteFile('${name}', event)">×</button>`;
        div.onclick = () => loadFile(name);
        list.appendChild(div);
    });
}

function loadFile(name) {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    currentFile = name;
    
    const ext = name.split('.').pop();
    const modeMap = { js: 'javascript', html: 'htmlmixed', css: 'css', json: 'application/json' };
    cmEditor.setOption('mode', modeMap[ext] || 'text/plain');
    cmEditor.setValue(vfs[name]);
    
    document.getElementById('current-file-label').innerText = name;
    renderFileList();
}

function createNewFile() {
    const name = prompt("Filename (e.g., script.js):");
    if (name && !vfs[name]) {
        vfs[name] = "";
        renderFileList();
        loadFile(name);
    }
}

async function deleteFile(name, e) {
    e.stopPropagation();
    if (confirm(`Delete ${name}?`)) {
        delete vfs[name];
        if (currentFile === name) currentFile = null;
        await saveVFS();
        renderFileList();
    }
}

function logDiag(msg, type) {
    const out = document.getElementById('diagnostic-results');
    const colors = { error: '#f85149', success: '#3fb950', info: '#2f81f7' };
    out.style.color = colors[type] || '#fff';
    out.innerText = msg;
}

function copyDiagnostics() {
    const text = document.getElementById('diagnostic-results').innerText;
    navigator.clipboard.writeText(text);
    alert("Diagnostics copied!");
}

function insertSymbol(sym, isTemplate = false) {
    const doc = cmEditor.getDoc();
    const cursor = doc.getCursor();
    if (isTemplate) {
        doc.replaceRange("${}", cursor);
        doc.setCursor(cursor.line, cursor.ch + 2);
    } else {
        doc.replaceRange(sym, cursor);
    }
    cmEditor.focus();
}

// Stubs for vault integration from index.html buttons
function renderVault() { /* Vault list rendering logic here */ }
function formatCurrentFile() { /* Beautify logic */ }
function autoFixCurrentFile() { /* aggressive fix logic */ }
function runDependencyCheck() { visualizeDependencies(); }
