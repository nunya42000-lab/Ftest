/* DevOS IDE Engine - Full Project Intelligence Edition */

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

    // 3. Global Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveVFS(); flashSaveStatus(); }
        if (e.shiftKey && e.key === 'F') { e.preventDefault(); formatCurrentFile(); }
    });

    // 4. Command Palette Listener
    document.getElementById('cmd-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleCommand(e.target.value.toLowerCase().trim());
    });

    // 5. Vault Gesture: Double-Tap to Save Snippet
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

    // 6. Apply Settings & Initial Render
    const savedToolbarState = localStorage.getItem('settings_show_toolbar') !== 'false';
    document.getElementById('toggle-toolbar').checked = savedToolbarState;
    applyToolbarState(savedToolbarState);

    renderFileList();
    renderVault();
    renderTrash();
});

// --- UI & Tab Logic ---

function switchTab(tabId, event) {
    document.querySelectorAll('.panel-box').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const target = document.getElementById('view-' + tabId);
    if(target) target.classList.add('active');
    
    if (tabId === 'editor') {
        const show = localStorage.getItem('settings_show_toolbar') !== 'false';
        applyToolbarState(show);
        setTimeout(() => cmEditor.refresh(), 50);
    }
    
    if (event) event.currentTarget.classList.add('active');
}

function toggleCommandPalette() {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('cmd-input');
    const isVisible = palette.style.display === 'block';
    palette.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) { input.value = ""; input.focus(); }
}

function handleCommand(cmd) {
    const actions = {
        'export': exportProjectZip,
        'lint': runLinter,
        'fix': autoFixCurrentFile,
        'format': formatCurrentFile,
        'close all': closeAllFiles,
        'trash': () => switchTab('settings'),
        'scan': runGlobalHealthCheck,
        'imports': generateAutoImports
    };
    if (actions[cmd]) actions[cmd]();
    else logDiag(`Unknown command: ${cmd}`, "error");
    toggleCommandPalette();
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
    if(!currentFile) return;
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
}

function generateAutoImports() {
    if (!currentFile || !currentFile.endsWith('.js')) return;
    const { requires } = analyzeSnippetDependencies(cmEditor.getValue());
    let newImports = "";
    requires.forEach(req => {
        for (const [filename, code] of Object.entries(vfs)) {
            if (filename === currentFile) continue;
            const { provides } = analyzeSnippetDependencies(code);
            if (provides.includes(req)) {
                newImports += `import { ${req} } from './${filename}';\n`;
                break;
            }
        }
    });
    if (newImports) {
        cmEditor.setValue(newImports + "\n" + cmEditor.getValue());
        logDiag("Injected local imports.", "success");
    }
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

function globalSearchReplace() {
    const findText = prompt("Find in ALL files:");
    if (!findText) return;
    const replaceText = prompt(`Replace "${findText}" with:`);
    if (replaceText === null) return;
    Object.keys(vfs).forEach(name => { vfs[name] = vfs[name].split(findText).join(replaceText); });
    if (currentFile) cmEditor.setValue(vfs[currentFile]);
    saveVFS();
    logDiag("Refactor complete across VFS.", "success");
}

function peekDefinition() {
    const word = cmEditor.getSelection().trim();
    if (!word) return logDiag("Select a word to peek.", "info");
    let found = [];
    Object.entries(vfs).forEach(([name, code]) => {
        if (new RegExp(`(?:function|const|let|var|class)\\s+${word}\\b`).test(code)) found.push(name);
    });
    logDiag(found.length ? `"${word}" defined in: ${found.join(', ')}` : "Definition not found.", found.length ? "info" : "error");
}

// --- Preview Engine ---

function runPreview() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    let html = vfs['index.html'] || '<h1>No index.html</h1>';
    const hook = `
    <script>
        const format = (arg) => (typeof arg === 'object') ? JSON.stringify(arg, null, 2) : String(arg);
        console.log = (...args) => {
            const d = window.parent.document.getElementById('console-output');
            d.innerHTML += '<div class="log-msg">> ' + args.map(format).join(' ') + '</div>';
            d.scrollTop = d.scrollHeight;
        };
        window.onerror = (m, u, l) => {
            const d = window.parent.document.getElementById('console-output');
            d.innerHTML += '<div class="log-error">✖ Line ' + l + ': ' + m + '</div>';
        };
    <\/script>`;
    document.getElementById('console-output').innerHTML = '';
    document.getElementById('preview-frame').srcdoc = html.replace('<head>', '<head>' + hook);
    switchTab('run');
}

// --- VFS Management & Trash ---

async function saveVFS() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    await localforage.setItem('devos_vfs', vfs);
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => { await saveVFS(); flashSaveStatus(); }, 1000);
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
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    currentFile = name;
    const ext = name.split('.').pop();
    const modes = { js: 'javascript', html: 'htmlmixed', css: 'css', json: 'application/json' };
    cmEditor.setOption('mode', modes[ext] || 'text/plain');
    cmEditor.setValue(vfs[name]);
    document.getElementById('current-file-label').innerText = name;
    renderFileList();
}

function closeAllFiles() {
    if (confirm("Clear editor?")) {
        currentFile = null;
        cmEditor.setValue("// Select a file.");
        document.getElementById('current-file-label').innerText = "no file selected";
        renderFileList();
    }
}

async function deleteFile(name, e) {
    e.stopPropagation();
    if (confirm(`Trash ${name}?`)) {
        const trash = (await localforage.getItem('devos_trash')) || {};
        trash[name] = { code: vfs[name], deletedAt: Date.now() };
        await localforage.setItem('devos_trash', trash);
        delete vfs[name];
        if (currentFile === name) {
            currentFile = null;
            cmEditor.setValue("// Select a file.");
            document.getElementById('current-file-label').innerText = "no file selected";
        }
        await saveVFS();
        renderFileList();
        renderTrash();
    }
}

async function renderTrash() {
    const trash = (await localforage.getItem('devos_trash')) || {};
    const list = document.getElementById('trash-list');
    list.innerHTML = '';
    Object.keys(trash).forEach(name => {
        const div = document.createElement('div');
        div.style = "display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #222;";
        div.innerHTML = `<span style="font-size:12px;">${name}</span><button class="btn-action" style="padding:2px 8px; font-size:10px;" onclick="restoreFile('${name}')">RESTORE</button>`;
        list.appendChild(div);
    });
}

async function restoreFile(name) {
    const trash = (await localforage.getItem('devos_trash')) || {};
    vfs[name] = trash[name].code;
    delete trash[name];
    await localforage.setItem('devos_trash', trash);
    await saveVFS();
    renderFileList();
    renderTrash();
}

async function emptyTrash() {
    if (confirm("Clear trash?")) { await localforage.setItem('devos_trash', {}); renderTrash(); }
}

async function exportProjectZip() {
    const zip = new JSZip();
    Object.entries(vfs).forEach(([n, c]) => zip.file(n, c));
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `project_${Date.now()}.zip`;
    link.click();
}

function logDiag(msg, type) {
    const out = document.getElementById('diagnostic-results');
    const colors = { error: '#f85149', success: '#3fb950', warn: '#d29922', info: '#2f81f7' };
    out.style.color = colors[type] || '#fff';
    out.innerText = msg;
}

function insertSymbol(sym, template = false) {
    const cursor = cmEditor.getCursor();
    if (template) { cmEditor.replaceRange("${}", cursor); cmEditor.setCursor(cursor.line, cursor.ch + 2); }
    else cmEditor.replaceRange(sym, cursor);
    cmEditor.focus();
}

/* Vault Logic */
function renderVault() {
    const list = document.getElementById('vault-list');
    list.innerHTML = '';
    snippets.forEach(s => {
        const div = document.createElement('div');
        div.className = 'help-card';
        div.innerHTML = `<strong>${s.name}</strong><br><button class="btn-primary" onclick="insertSnippet(${s.id})">INSERT</button>`;
        list.appendChild(div);
    });
        }
