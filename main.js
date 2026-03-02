/* DevOS Main Engine - All Tools Restored */

localforage.config({ name: 'DevOS' });

// --- Global State ---
let vfs = {}; 
let currentFile = null;
let cmEditor = null;
let snippets = [];
let snapshots = [];
let autoSaveTimer;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data (Sync with your specific keys)
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

    cmEditor.on('change', triggerAutoSave);

    // 3. NATIVE GESTURE: Double-Tap to Vault
    cmEditor.getWrapperElement().addEventListener('dblclick', async (e) => {
        const selectedText = cmEditor.getSelection();
        if (selectedText && selectedText.trim().length > 0) {
            e.preventDefault(); 
            const name = prompt("Save highlighted snippet to Vault as:", "Snippet " + (snippets.length + 1));
            if (name) {
                snippets.push({ name: name, code: selectedText });
                await localforage.setItem('vault_snippets', snippets);
                renderVault();
                flashSaveStatus("Saved to Vault!");
            }
        }
    });

    // 4. Setup Workspace
    if (Object.keys(vfs).length > 0) {
        switchFile(Object.keys(vfs).sort()[0]);
    }
    renderFileList();
    renderVault();
    
    // Load Settings & Toggle Toolbar
    const toolbarPref = localStorage.getItem('settings_show_toolbar') !== 'false';
    const toggle = document.getElementById('toggle-toolbar');
    if (toggle) toggle.checked = toolbarPref;
    applyToolbarState(toolbarPref);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW failed:", err));
    }
});

// --- Tab & UI Navigation ---
function switchTab(tabId, event) {
    document.querySelectorAll('.panel-box').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById('view-' + tabId);
    if(target) target.classList.add('active');
    
    if (event) event.currentTarget.classList.add('active');
    if (tabId === 'editor' && cmEditor) setTimeout(() => cmEditor.refresh(), 50);
}

function toggleSidebar() {
    document.getElementById('ui-sidebar').classList.toggle('open');
}

function flashSaveStatus(msg = "Saved") {
    const el = document.getElementById('status-msg');
    if(el) {
        el.innerText = msg;
        el.style.opacity = 1;
        setTimeout(() => el.style.opacity = 0, 1500);
    }
}

// --- Settings Fix: Mobile Toolbar ---
function toggleMobileToolbar() {
    const isChecked = document.getElementById('toggle-toolbar').checked;
    localStorage.setItem('settings_show_toolbar', isChecked);
    applyToolbarState(isChecked);
}

function applyToolbarState(show) {
    const tb = document.getElementById('mobile-toolbar');
    if (tb) tb.style.display = show ? 'flex' : 'none';
    if(cmEditor) setTimeout(() => cmEditor.refresh(), 50);
}

function insertSymbol(sym, isTemplate = false) {
    if(!cmEditor) return;
    const cursor = cmEditor.getCursor();
    if(isTemplate) {
        cmEditor.replaceRange('${}', cursor);
        cmEditor.setCursor({line: cursor.line, ch: cursor.ch + 2});
    } else {
        cmEditor.replaceRange(sym, cursor);
        cmEditor.setCursor({line: cursor.line, ch: cursor.ch + 1});
    }
    cmEditor.focus();
}

// --- VFS & File Operations (Fix: Loading) ---
async function saveVFS() {
    if (currentFile && cmEditor) {
        vfs[currentFile] = cmEditor.getValue();
    }
    await localforage.setItem('devos_vfs', vfs);
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        await saveVFS();
        flashSaveStatus();
    }, 1000);
}

function renderFileList() {
    const list = document.getElementById('file-list');
    if(!list) return;
    list.innerHTML = '';
    Object.keys(vfs).sort().forEach(fn => {
        const div = document.createElement('div');
        div.className = 'file-item' + (fn === currentFile ? ' active' : '');
        div.style.padding = '10px 15px';
        div.style.borderBottom = '1px solid var(--border)';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.color = (fn === currentFile) ? 'var(--accent)' : 'var(--text)';
        div.style.background = (fn === currentFile) ? 'rgba(47, 129, 247, 0.1)' : 'transparent';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = fn;
        nameSpan.style.flex = "1";
        nameSpan.onclick = () => { switchFile(fn); toggleSidebar(); };
        
        const delBtn = document.createElement('button');
        delBtn.innerText = '×';
        delBtn.style.color = "var(--danger)";
        delBtn.style.background = "transparent";
        delBtn.style.fontSize = "18px";
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Delete ${fn}?`)) {
                delete vfs[fn];
                if (currentFile === fn) currentFile = null;
                await saveVFS();
                renderFileList();
                if (Object.keys(vfs).length > 0) switchFile(Object.keys(vfs)[0]);
            }
        };
        
        div.appendChild(nameSpan);
        div.appendChild(delBtn);
        list.appendChild(div);
    });
}

function switchFile(filename) {
    if (currentFile && cmEditor) vfs[currentFile] = cmEditor.getValue();
    currentFile = filename;
    document.getElementById('current-file-label').innerText = filename;
    
    let mode = 'javascript';
    if (filename.endsWith('.html')) mode = 'htmlmixed';
    else if (filename.endsWith('.css')) mode = 'css';
    else if (filename.endsWith('.json')) mode = 'application/json';
    
    cmEditor.setOption('mode', mode);
    cmEditor.setValue(vfs[filename] || '');
    renderFileList();
}

function loadFiles(event) {
    const files = event.target.files;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            vfs[file.name] = e.target.result;
            await saveVFS();
            renderFileList();
            if (!currentFile) switchFile(file.name);
        };
        reader.readAsText(file);
    });
    flashSaveStatus("Files Loaded");
}

// --- Tools Fix: Linter & Diagnostics ---
function runLinter() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    let results = "";
    
    if (currentFile.endsWith('.js')) {
        JSHINT(code, { esversion: 11, browser: true, module: true });
        if (JSHINT.errors.length > 0) {
            JSHINT.errors.forEach(e => { if (e) results += `Line ${e.line}: ${e.reason}\n`; });
        } else {
            results = "Pass: No JavaScript syntax errors.";
        }
    } else {
        results = "Linter only supports .js files currently.";
    }
    
    // Output to a generic diagnostic area or alert for now
    alert(results);
}

// --- Sandbox Control ---
function runPreview() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    let html = vfs['index.html'] || '<h1>No index.html found</h1>';

    const scripts = Object.keys(vfs).filter(fn => fn.endsWith('.js') && fn !== 'sw.js');
    let scriptTags = scripts.map(fn => {
        const blob = new Blob([vfs[fn]], {type: 'application/javascript'});
        return `<script type="module" src="${URL.createObjectURL(blob)}"><\/script>`;
    }).join('\n');

    const hook = `
    <script>
        const ogLog = console.log;
        window.onerror = (m, u, l) => { 
            const d = window.parent.document.getElementById('console-output');
            d.innerHTML += '<div class="log-error">> Line ' + l + ': ' + m + '</div>';
        };
        console.log = (...args) => {
            const d = window.parent.document.getElementById('console-output');
            d.innerHTML += '<div class="log-msg">> ' + args.join(' ') + '</div>';
            ogLog(...args);
        };
    <\/script>`;

    html = html.replace('<head>', '<head>\n' + hook).replace('</body>', scriptTags + '\n</body>');
    
    const frame = document.getElementById('preview-frame');
    const out = document.getElementById('console-output');
    if(out) out.innerHTML = ''; 
    if(frame) frame.srcdoc = html;
    switchTab('run');
}

// --- Additional Request: Cleanup ---
function cleanupCode() {
    if(!currentFile) return;
    if(!confirm("Remove comments and collapse extra lines?")) return;
    const code = cmEditor.getValue();
    let clean = code.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')
                    .replace(/^\s*[\r\n]/gm, '\n')
                    .replace(/\n\s*\n\s*\n/g, '\n\n');
    cmEditor.setValue(clean.trim());
    flashSaveStatus("Code Cleaned");
}

// --- Rest of Export / Vault Logic as per previous version ---
async function createNewFile() {
    const name = prompt("Enter file name (e.g., app.js):");
    if (name && !vfs[name]) {
        vfs[name] = '';
        await saveVFS();
        renderFileList();
        switchFile(name);
        toggleSidebar();
    }
}

function exportForAI() {
    let output = "Project Context\n\n";
    for (const [name, code] of Object.entries(vfs)) {
        output += `\n--- File: ${name} ---\n${code}\n`;
    }
    navigator.clipboard.writeText(output).then(() => flashSaveStatus("Copied for AI!"));
}
