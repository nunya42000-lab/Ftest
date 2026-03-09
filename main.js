/* DevOS IDE Engine - Gold Edition */

localforage.config({ name: 'DevOS' });

// --- Global State ---
let vfs = {}; 
let currentFile = null;
let cmEditor = null;
let snippets = [];
let autoSaveTimer;
let lintTimer;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Virtual File System & Snippets
    vfs = (await localforage.getItem('devos_vfs')) || { 'index.html': '<h1>Ready.</h1>' };
    snippets = (await localforage.getItem('vault_snippets')) || [];
    
    // 2. Initialize CodeMirror
    const textArea = document.getElementById('code-editor');
    if (textArea) {
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

        // Vault Gesture: Double-Tap selection to save to Vault
        cmEditor.getWrapperElement().addEventListener('dblclick', async (e) => {
            const selectedText = cmEditor.getSelection();
            if (selectedText && selectedText.trim().length > 0) {
                e.preventDefault(); 
                const name = prompt("Snippet Name:", "New Snippet");
                if (name) {
                    snippets.push({ name, code: selectedText, id: Date.now() });
                    await localforage.setItem('vault_snippets', snippets);
                    renderVault();
                    logDiag(`Saved "${name}" to Vault.`, "success");
                }
            }
        });
    }

    // 3. Global Shortcuts & Command Palette
    setupShortcuts();

    // 4. Drag & Drop Support
    const dropZone = document.body;
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    dropZone.addEventListener('drop', handleDrop);

    // 5. Apply Toolbar Settings
    const savedToolbarState = localStorage.getItem('settings_show_toolbar') !== 'false';
    const toolbarCheckbox = document.getElementById('toggle-toolbar');
    if (toolbarCheckbox) toolbarCheckbox.checked = savedToolbarState;
    applyToolbarState(savedToolbarState);

    // 6. Initial UI Render
    renderFileList();
    renderVault();
    renderTrash();
});

// --- Core UI & Navigation ---

function switchTab(tabId, event) {
    document.querySelectorAll('.panel-box').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById('view-' + tabId);
    if(target) target.classList.add('active');
    
    if (tabId === 'editor') {
        const show = localStorage.getItem('settings_show_toolbar') !== 'false';
        applyToolbarState(show);
        if (cmEditor) setTimeout(() => cmEditor.refresh(), 50);
    }
    
    if (event) event.currentTarget.classList.add('active');
}

function setupShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveVFS(); flashSaveStatus(); }
        if (e.shiftKey && e.key === 'F') { e.preventDefault(); formatCurrentFile(); }
        if (e.ctrlKey && e.key === 'e') { e.preventDefault(); runPreview(); }
    });

    const cmdInput = document.getElementById('cmd-input');
    if (cmdInput) {
        cmdInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleCommand(e.target.value.toLowerCase().trim());
        });
    }
}

function toggleCommandPalette() {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('cmd-input');
    if (!palette || !input) return;
    const isVisible = palette.style.display === 'block';
    palette.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) { input.value = ""; input.focus(); }
}

function handleCommand(cmd) {
    // DevBox Terminal: Execute JS if starts with '>'
    if (cmd.startsWith('>')) {
        runTerminalCmd(cmd.substring(1).trim());
        toggleCommandPalette();
        return;
    }

    const actions = {
        'export': exportProjectZip,
        'lint': runLinter,
        'fix': autoFixCurrentFile,
        'format': formatCurrentFile,
        'close all': closeAllFiles,
        'trash': () => switchTab('settings'),
        'scan': runGlobalHealthCheck,
        'imports': generateAutoImports,
        'stats': () => switchTab('tools')
    };
    if (actions[cmd]) actions[cmd]();
    else logDiag(`Unknown command: ${cmd}`, "error");
    toggleCommandPalette();
}

function toggleMobileToolbar() {
    const checkbox = document.getElementById('toggle-toolbar');
    const show = checkbox ? checkbox.checked : false;
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
    const sidebar = document.getElementById('ui-sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
}

// --- Project Intelligence & Diagnostics ---

function triggerReactiveLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => {
        if (currentFile && (currentFile.endsWith('.js') || currentFile.endsWith('.json'))) {
            runLinter();
        }
    }, 1500); 
}

function runLinter() {
    if(!currentFile || !cmEditor) return;
    const code = cmEditor.getValue();
    const ext = currentFile.split('.').pop().toLowerCase();
    let results = "";

    if (ext === 'js') {
        JSHINT(code, { esversion: 11, browser: true, module: true });
        if (JSHINT.errors.length > 0) {
            JSHINT.errors.forEach(e => { if (e) results += `✖ Line ${e.line}: ${e.reason}\n`; });
            logDiag(results, "error");
        } else { logDiag("✔ JS Syntax Clear.", "success"); }
    } else if (ext === 'json') {
        try { JSON.parse(code); logDiag("✔ JSON Valid.", "success"); } 
        catch (e) { logDiag("✖ JSON Error: " + e.message, "error"); }
    }
}

function runGlobalHealthCheck() {
    let summary = "Project Health Scan:\n\n";
    let issues = 0;
    Object.entries(vfs).forEach(([name, code]) => {
        if (name.endsWith('.js')) {
            JSHINT(code, { esversion: 11 });
            if (JSHINT.errors.length > 0) {
                summary += `✖ ${name}: ${JSHINT.errors.length} errors\n`;
                issues++;
            }
        }
    });
    logDiag(issues > 0 ? summary : "✔ Project Health: Excellent. No syntax errors.", issues > 0 ? "error" : "success");
    renderFileList(); // Update health dots
}

function checkGlobalDuplicates() {
    const registry = {}; 
    const regex = /(?:function|const|let|var|class)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
    Object.entries(vfs).forEach(([filename, code]) => {
        let match;
        while ((match = regex.exec(code)) !== null) {
            const name = match[1];
            if (!registry[name]) registry[name] = [];
            if (!registry[name].includes(filename)) registry[name].push(filename);
        }
    });
    let report = "";
    Object.entries(registry).forEach(([name, files]) => {
        if (files.length > 1) report += `⚠️ "${name}" duplicated in: ${files.join(', ')}\n`;
    });
    logDiag(report || "✔ No name collisions found.", report ? "warn" : "success");
}

function generateAutoImports() {
    if (!currentFile || !currentFile.endsWith('.js') || !cmEditor) return;
    // Uses analyzer from vault-compiler.js
    const { requires } = analyzeSnippetDependencies(cmEditor.getValue());
    let newImports = "";
    requires.forEach(req => {
        for (const [filename, code] of Object.entries(vfs)) {
            if (filename === currentFile) continue;
            const { provides } = analyzeSnippetDependencies(code);
            if (provides.includes(req)) {
                if (!cmEditor.getValue().includes(`from './${filename}'`)) {
                    newImports += `import { ${req} } from './${filename}';\n`;
                }
                break;
            }
        }
    });
    if (newImports) {
        cmEditor.replaceRange(newImports, {line: 0, ch: 0});
        logDiag("Injected local imports.", "success");
    }
}

function globalSearchReplace() {
    const findText = prompt("Find in ALL files:");
    if (!findText) return;
    const replaceText = prompt(`Replace "${findText}" with:`);
    if (replaceText === null) return;
    Object.keys(vfs).forEach(name => { vfs[name] = vfs[name].split(findText).join(replaceText); });
    if (currentFile && cmEditor) cmEditor.setValue(vfs[currentFile]);
    saveVFS();
    logDiag("Refactor complete across VFS.", "success");
}

function runTerminalCmd(input) {
    try {
        const result = eval(input);
        logDiag(`> ${input}\nResult: ${JSON.stringify(result, null, 2)}`, "info");
    } catch (e) {
        logDiag(`Error: ${e.message}`, "error");
    }
}

function updateProjectStats() {
    let totalLines = 0;
    let fileCount = Object.keys(vfs).length;
    let errorCount = 0;

    Object.entries(vfs).forEach(([name, code]) => {
        totalLines += code.split('\n').length;
        if (name.endsWith('.js')) {
            JSHINT(code, { esversion: 11 });
            if (JSHINT.errors.length > 0) errorCount++;
        }
    });

    const statsHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
            <div class="help-card" style="text-align:center; padding:10px;">
                <div style="font-size:20px; font-weight:bold; color:var(--accent)">${fileCount}</div>
                <div style="font-size:10px; color:var(--muted)">FILES</div>
            </div>
            <div class="help-card" style="text-align:center; padding:10px;">
                <div style="font-size:20px; font-weight:bold; color:var(--success)">${totalLines}</div>
                <div style="font-size:10px; color:var(--muted)">LINES</div>
            </div>
        </div>
    `;
    const container = document.getElementById('project-stats-container');
    if (container) container.innerHTML = statsHTML;
}

// --- VFS & Imports ---

async function saveVFS() {
    if (currentFile && cmEditor) vfs[currentFile] = cmEditor.getValue();
    await localforage.setItem('devos_vfs', vfs);
    updateProjectStats();
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => { await saveVFS(); flashSaveStatus(); }, 1000);
}

function flashSaveStatus() {
    const msg = document.getElementById('status-msg');
    if (msg) {
        msg.style.opacity = '1';
        setTimeout(() => msg.style.opacity = '0', 2000);
    }
}

async function loadFiles(event) {
    const files = event.target.files;
    if (!files) return;
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            vfs[file.name] = e.target.result;
            await saveVFS();
            renderFileList();
            logDiag(`Imported: ${file.name}`, "success");
        };
        reader.readAsText(file);
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        loadFiles({ target: { files } });
    }
}

function renderFileList() {
    const list = document.getElementById('file-list');
    if (!list) return;
    list.innerHTML = '';
    
    Object.keys(vfs).sort().forEach(name => {
        let health = "";
        if (name.endsWith('.js')) {
            JSHINT(vfs[name], { esversion: 11 });
            health = JSHINT.errors.length > 0 ? "🔴 " : "🟢 ";
        }
        
        const div = document.createElement('div');
        div.className = `file-item ${name === currentFile ? 'active' : ''}`;
        div.innerHTML = `<span>${health}${name}</span><button onclick="deleteFile('${name}', event)">×</button>`;
        div.onclick = () => loadFile(name);
        list.appendChild(div);
    });
}

function loadFile(name) {
    if (!cmEditor) return;
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    currentFile = name;
    
    const ext = name.split('.').pop();
    const modes = { js: 'javascript', html: 'htmlmixed', css: 'css', json: 'application/json' };
    cmEditor.setOption('mode', modes[ext] || 'text/plain');
    cmEditor.setValue(vfs[name]);
    
    const label = document.getElementById('current-file-label');
    if (label) label.innerText = name;
    renderFileList();
}

function closeAllFiles() {
    if (confirm("Clear editor?")) {
        currentFile = null;
        if (cmEditor) cmEditor.setValue("// Select a file to begin.");
        const label = document.getElementById('current-file-label');
        if (label) label.innerText = "no file selected";
        renderFileList();
    }
}

// --- Trash & Restore Logic ---

async function deleteFile(name, e) {
    e.stopPropagation();
    if (confirm(`Move ${name} to Trash?`)) {
        const trash = (await localforage.getItem('devos_trash')) || {};
        trash[name] = { code: vfs[name], deletedAt: Date.now() };
        await localforage.setItem('devos_trash', trash);
        
        delete vfs[name];
        if (currentFile === name) {
            currentFile = null;
            if (cmEditor) cmEditor.setValue("// Select a file.");
            const label = document.getElementById('current-file-label');
            if (label) label.innerText = "no file selected";
        }
        await saveVFS();
        renderFileList();
        renderTrash();
        logDiag(`${name} moved to trash.`, "info");
    }
}

async function renderTrash() {
    const trash = (await localforage.getItem('devos_trash')) || {};
    const list = document.getElementById('trash-list');
    if (!list) return;
    list.innerHTML = '';
    
    const entries = Object.keys(trash);
    if (entries.length === 0) {
        list.innerHTML = '<div style="color:var(--muted); font-size:11px; text-align:center;">Trash is empty</div>';
        return;
    }

    entries.forEach(name => {
        const div = document.createElement('div');
        div.style = "display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #222;";
        div.innerHTML = `<span style="font-size:12px;">${name}</span><button class="btn-action" style="padding:2px 8px; font-size:10px;" onclick="restoreFile('${name}')">RESTORE</button>`;
        list.appendChild(div);
    });
}

async function restoreFile(name) {
    const trash = (await localforage.getItem('devos_trash')) || {};
    if (trash[name]) {
        vfs[name] = trash[name].code;
        delete trash[name];
        await localforage.setItem('devos_trash', trash);
        await saveVFS();
        renderFileList();
        renderTrash();
        logDiag(`${name} restored.`, "success");
    }
}

async function emptyTrash() {
    if (confirm("Permanently delete all files in Trash?")) {
        await localforage.setItem('devos_trash', {});
        renderTrash();
        logDiag("Trash cleared.", "info");
    }
}

// --- Utilities ---

function logDiag(msg, type) {
    const out = document.getElementById('diagnostic-results');
    if (!out) return;
    const colors = { error: '#f85149', success: '#3fb950', warn: '#d29922', info: '#2f81f7' };
    out.style.color = colors[type] || '#fff';
    out.innerText = msg;
}

function insertSymbol(sym, template = false) {
    if (!cmEditor) return;
    const cursor = cmEditor.getCursor();
    if (template) { 
        cmEditor.replaceRange("${}", cursor); 
        cmEditor.setCursor(cursor.line, cursor.ch + 2); 
    } else { 
        cmEditor.replaceRange(sym, cursor); 
    }
    cmEditor.focus();
}

async function exportProjectZip() {
    logDiag("Generating Zip...", "info");
    const zip = new JSZip();
    Object.entries(vfs).forEach(([n, c]) => zip.file(n, c));
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `devos_project_${Date.now()}.zip`;
    link.click();
    logDiag("Export complete.", "success");
}

function renderVault() {
    const list = document.getElementById('vault-list');
    if (!list) return;
    list.innerHTML = '';
    snippets.forEach(s => {
        const div = document.createElement('div');
        div.className = 'help-card';
        div.innerHTML = `<strong>${s.name}</strong><br><button class="btn-primary" style="margin-top:5px; font-size:10px;" onclick="insertSnippet(${s.id})">INSERT</button>`;
        list.appendChild(div);
    });
}

function insertSnippet(id) {
    const snippet = snippets.find(s => s.id === id);
    if (snippet && cmEditor) {
        cmEditor.replaceSelection(snippet.code);
        cmEditor.focus();
    }
}

// Stubs for remaining Intelligence functions
function performSearch() { /* Logic for search bar */ }
function formatCurrentFile() { /* Logic for beautify */ }
function autoFixCurrentFile() { /* Logic for aggressive fix */ }
function peekDefinition() { /* Logic to find variable origin */ }
            
