/* DevOS IDE Engine - Full Gold Edition */

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
        if (e.ctrlKey && e.key === 'e') { e.preventDefault(); runPreview(); }
    });

    // 4. Command Palette Listener
    document.getElementById('cmd-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleCommand(e.target.value.toLowerCase().trim());
    });

    // 5. Drag & Drop Support
    document.body.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    document.body.addEventListener('drop', handleDrop);

    // 6. Vault Gesture: Double-Tap selection to save to Vault
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

    // 7. Initial Render
    const savedToolbarState = localStorage.getItem('settings_show_toolbar') !== 'false';
    document.getElementById('toggle-toolbar').checked = savedToolbarState;
    applyToolbarState(savedToolbarState);

    renderFileList();
    renderVault();
    renderTrash();
});

// --- UI & Navigation ---

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

// --- Project Intelligence ---

function updateProjectStats() {
    let totalLines = 0;
    let fileCount = Object.keys(vfs).length;
    Object.values(vfs).forEach(code => totalLines += code.split('\n').length);

    const statsHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div class="help-card" style="text-align:center; padding:10px;">
                <div style="font-size:20px; font-weight:bold; color:var(--accent)">${fileCount}</div>
                <div style="font-size:10px; color:var(--muted)">FILES</div>
            </div>
            <div class="help-card" style="text-align:center; padding:10px;">
                <div style="font-size:20px; font-weight:bold; color:var(--success)">${totalLines}</div>
                <div style="font-size:10px; color:var(--muted)">LINES</div>
            </div>
        </div>`;
    const container = document.getElementById('project-stats-container');
    if (container) container.innerHTML = statsHTML;
}

function triggerReactiveLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => {
        if (currentFile && (currentFile.endsWith('.js') || currentFile.endsWith('.json'))) {
            runLinter();
        }
    }, 1500); 
}

/* --- Platinum Intelligence Suite --- */

function runLinter() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    const ext = currentFile.split('.').pop().toLowerCase();
    let results = [];

    if (ext === 'js') {
        // Advanced JSHint configuration for logic errors
        const options = { 
            esversion: 11, browser: true, module: true, 
            undef: true, unused: true, shadow: "warn", loopfunc: true 
        };
        JSHINT(code, options);
        
        // 1. Syntax & Scope Errors
        if (JSHINT.errors.length > 0) {
            JSHINT.errors.forEach(e => { 
                if (e) results.push(`✖ L${e.line}: ${e.reason} ${e.code ? `(${e.code})` : ''}`);
            });
        }

        // 2. Custom Logic: Infinite Loop Guard
        if (code.match(/while\s*\(\s*true\s*\)(?![^]*break)/g)) {
            results.push("⚠️ LOGIC: Possible infinite loop detected (while true without break).");
        }

        // 3. Custom Logic: Unreachable Code after Return
        if (code.match(/return\s*;?\n\s*[^\s}]/g)) {
            results.push("⚠️ SEMANTIC: Unreachable code detected after return statement.");
        }

        if (results.length > 0) {
            logDiag(results.join('\n'), "error");
        } else {
            logDiag("✔ Platinum Check: Logic and Syntax look perfect.", "success");
        }
    }
}

function autoFixCurrentFile() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    
    // Create safety snapshot
    snapshots.push({ label: "Auto-Fix Backup", data: JSON.parse(JSON.stringify(vfs)) });

    // 1. Structural Fix (Beautify)
    formatCurrentFile();
    
    // 2. Logic Scrub (Clean up common mobile-coding artifacts)
    let fixedCode = cmEditor.getValue()
        .replace(/console\.log\(.*\);?\n?/g, '') // Option: Scrub logs for production
        .replace(/\n\s*\n\s*\n/g, '\n\n')       // Collapse triple line breaks
        .replace(/debugger;?\n?/g, '');         // Remove debugger statements

    cmEditor.setValue(fixedCode);
    logDiag("✔ Logic scrubbed and formatting applied.", "success");
}
/* --- Platinum Intelligence Suite --- */

function runLinter() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    const ext = currentFile.split('.').pop().toLowerCase();
    let results = [];

    if (ext === 'js') {
        // Advanced JSHint configuration for logic errors
        const options = { 
            esversion: 11, browser: true, module: true, 
            undef: true, unused: true, shadow: "warn", loopfunc: true 
        };
        JSHINT(code, options);
        
        // 1. Syntax & Scope Errors
        if (JSHINT.errors.length > 0) {
            JSHINT.errors.forEach(e => { 
                if (e) results.push(`✖ L${e.line}: ${e.reason} ${e.code ? `(${e.code})` : ''}`);
            });
        }

        // 2. Custom Logic: Infinite Loop Guard
        if (code.match(/while\s*\(\s*true\s*\)(?![^]*break)/g)) {
            results.push("⚠️ LOGIC: Possible infinite loop detected (while true without break).");
        }

        // 3. Custom Logic: Unreachable Code after Return
        if (code.match(/return\s*;?\n\s*[^\s}]/g)) {
            results.push("⚠️ SEMANTIC: Unreachable code detected after return statement.");
        }

        if (results.length > 0) {
            logDiag(results.join('\n'), "error");
        } else {
            logDiag("✔ Platinum Check: Logic and Syntax look perfect.", "success");
        }
    }
}

function autoFixCurrentFile() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    
    // Create safety snapshot
    snapshots.push({ label: "Auto-Fix Backup", data: JSON.parse(JSON.stringify(vfs)) });

    // 1. Structural Fix (Beautify)
    formatCurrentFile();
    
    // 2. Logic Scrub (Clean up common mobile-coding artifacts)
    let fixedCode = cmEditor.getValue()
        .replace(/console\.log\(.*\);?\n?/g, '') // Option: Scrub logs for production
        .replace(/\n\s*\n\s*\n/g, '\n\n')       // Collapse triple line breaks
        .replace(/debugger;?\n?/g, '');         // Remove debugger statements

    cmEditor.setValue(fixedCode);
    logDiag("✔ Logic scrubbed and formatting applied.", "success");
}
/* --- Platinum Intelligence Suite --- */

function runLinter() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    const ext = currentFile.split('.').pop().toLowerCase();
    let results = [];

    if (ext === 'js') {
        // Advanced JSHint configuration for logic errors
        const options = { 
            esversion: 11, browser: true, module: true, 
            undef: true, unused: true, shadow: "warn", loopfunc: true 
        };
        JSHINT(code, options);
        
        // 1. Syntax & Scope Errors
        if (JSHINT.errors.length > 0) {
            JSHINT.errors.forEach(e => { 
                if (e) results.push(`✖ L${e.line}: ${e.reason} ${e.code ? `(${e.code})` : ''}`);
            });
        }

        // 2. Custom Logic: Infinite Loop Guard
        if (code.match(/while\s*\(\s*true\s*\)(?![^]*break)/g)) {
            results.push("⚠️ LOGIC: Possible infinite loop detected (while true without break).");
        }

        // 3. Custom Logic: Unreachable Code after Return
        if (code.match(/return\s*;?\n\s*[^\s}]/g)) {
            results.push("⚠️ SEMANTIC: Unreachable code detected after return statement.");
        }

        if (results.length > 0) {
            logDiag(results.join('\n'), "error");
        } else {
            logDiag("✔ Platinum Check: Logic and Syntax look perfect.", "success");
        }
    }
}

function autoFixCurrentFile() {
    if(!currentFile) return;
    const code = cmEditor.getValue();
    
    // Create safety snapshot
    snapshots.push({ label: "Auto-Fix Backup", data: JSON.parse(JSON.stringify(vfs)) });

    // 1. Structural Fix (Beautify)
    formatCurrentFile();
    
    // 2. Logic Scrub (Clean up common mobile-coding artifacts)
    let fixedCode = cmEditor.getValue()
        .replace(/console\.log\(.*\);?\n?/g, '') // Option: Scrub logs for production
        .replace(/\n\s*\n\s*\n/g, '\n\n')       // Collapse triple line breaks
        .replace(/debugger;?\n?/g, '');         // Remove debugger statements

    cmEditor.setValue(fixedCode);
    logDiag("✔ Logic scrubbed and formatting applied.", "success");
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
    logDiag(issues > 0 ? summary : "✔ Project Health: Excellent.", issues > 0 ? "error" : "success");
    renderFileList();
}

function generateAutoImports() {
    if (!currentFile || !currentFile.endsWith('.js')) return;
    const { requires } = analyzeSnippetDependencies(cmEditor.getValue());
    let newImports = "";
    requires.forEach(req => {
        for (const [filename, code] of Object.entries(vfs)) {
            if (filename === currentFile) continue;
            const { provides } = analyzeSnippetDependencies(code);
            if (provides.includes(req) && !cmEditor.getValue().includes(`from './${filename}'`)) {
                newImports += `import { ${req} } from './${filename}';\n`;
                break;
            }
        }
    });
    if (newImports) {
        cmEditor.replaceRange(newImports, {line: 0, ch: 0});
        logDiag("Missing imports injected.", "success");
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
            registry[name].push(filename);
        }
    });
    let report = "";
    Object.entries(registry).forEach(([name, files]) => {
        if (files.length > 1) report += `⚠️ "${name}" duplicated in: ${files.join(', ')}\n`;
    });
    logDiag(report || "✔ No collisions found.", report ? "warn" : "success");
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

function performSearch() {
    const query = document.getElementById('search-query').value.toLowerCase();
    if (!query) return;
    let results = `Matches for "${query}":\n\n`;
    Object.entries(vfs).forEach(([name, code]) => {
        code.split('\n').forEach((line, i) => {
            if (line.toLowerCase().includes(query)) results += `[${name}] L${i+1}: ${line.trim()}\n`;
        });
    });
    logDiag(results, "info");
}

function runTerminalCmd(input) {
    try {
        const result = eval(input);
        logDiag(`> ${input}\nResult: ${JSON.stringify(result, null, 2)}`, "info");
    } catch (e) { logDiag(`Error: ${e.message}`, "error"); }
}

// --- Preview Engine ---

function runPreview() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    let html = vfs['index.html'] || '<h1>No index.html</h1>';
    const hook = `<script>
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

// --- VFS & File Management ---

async function saveVFS() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    await localforage.setItem('devos_vfs', vfs);
    updateProjectStats();
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => { await saveVFS(); flashSaveStatus(); }, 1000);
}

function flashSaveStatus() {
    const msg = document.getElementById('status-msg');
    if (msg) { msg.style.opacity = '1'; setTimeout(() => msg.style.opacity = '0', 2000); }
}

function loadFiles(event) {
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            vfs[file.name] = e.target.result;
            await saveVFS();
            renderFileList();
            logDiag(`Imported: ${file.name}`, "success");
        };
        reader.readAsText(file);
    });
}

function handleDrop(e) {
    e.preventDefault(); e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) loadFiles({ target: { files } });
}

function renderFileList() {
    const list = document.getElementById('file-list');
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
        cmEditor.setValue("// Select a file to begin.");
        document.getElementById('current-file-label').innerText = "no file selected";
        renderFileList();
    }
}

// --- Trash & Soft Delete ---

async function deleteFile(name, e) {
    e.stopPropagation();
    if (confirm(`Move ${name} to Trash?`)) {
        const trash = (await localforage.getItem('devos_trash')) || {};
        trash[name] = { code: vfs[name], deletedAt: Date.now() };
        await localforage.setItem('devos_trash', trash);
        delete vfs[name];
        if (currentFile === name) closeAllFiles();
        await saveVFS();
        renderFileList();
        renderTrash();
    }
}

async function renderTrash() {
    const trash = (await localforage.getItem('devos_trash')) || {};
    const list = document.getElementById('trash-list');
    if (!list) return;
    list.innerHTML = '';
    const entries = Object.keys(trash);
    if (entries.length === 0) { list.innerHTML = '<div style="color:var(--muted); font-size:11px; text-align:center;">Trash is empty</div>'; return; }
    entries.forEach(name => {
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

// --- Utilities ---

async function exportProjectZip() {
    const zip = new JSZip();
    Object.entries(vfs).forEach(([n, c]) => zip.file(n, c));
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `devos_project_${Date.now()}.zip`;
    link.click();
}

function logDiag(msg, type) {
    const out = document.getElementById('diagnostic-results');
    const colors = { error: '#f85149', success: '#3fb950', warn: '#d29922', info: '#2f81f7' };
    out.style.color = colors[type] || '#fff';
    out.innerText = msg;
}

function formatCurrentFile() {
    const code = cmEditor.getValue();
    const ext = currentFile.split('.').pop().toLowerCase();
    let formatted = code;
    try {
        if (ext === 'js') formatted = js_beautify(code, { indent_size: 4 });
        else if (ext === 'html') formatted = html_beautify(code, { indent_size: 4 });
        else if (ext === 'css') formatted = css_beautify(code, { indent_size: 4 });
        cmEditor.setValue(formatted);
    } catch(e) { logDiag("Format error: " + e.message, "error"); }
}

function insertSymbol(sym, template = false) {
    const cursor = cmEditor.getCursor();
    if (template) { cmEditor.replaceRange("${}", cursor); cmEditor.setCursor(cursor.line, cursor.ch + 2); }
    else cmEditor.replaceRange(sym, cursor);
    cmEditor.focus();
}

function createNewFile() {
    const name = prompt("Filename:");
    if (name && !vfs[name]) { vfs[name] = ""; renderFileList(); loadFile(name); }
}

function renderVault() {
    const list = document.getElementById('vault-list');
    if (!list) return;
    list.innerHTML = '';
    snippets.forEach(s => {
        const div = document.createElement('div');
        div.className = 'help-card';
        div.innerHTML = `<strong>${s.name}</strong><br><button class="btn-primary" style="font-size:10px;" onclick="insertSnippet(${s.id})">INSERT</button>`;
        list.appendChild(div);
    });
}

function insertSnippet(id) {
    const s = snippets.find(snip => snip.id === id);
    if (s) { cmEditor.replaceSelection(s.code); cmEditor.focus(); }
}

function peekDefinition() {
    const word = cmEditor.getSelection().trim();
    if (!word) {
        return logDiag("Highlight a variable or function name to peek its definition.", "info");
    }

    let definitionsFound = [];
    
    // Regex to detect definitions: function Name, const Name, class Name, etc.
    const defRegex = new RegExp(`(?:function|const|let|var|class)\\s+${word}\\b`);

    Object.entries(vfs).forEach(([filename, content]) => {
        if (defRegex.test(content)) {
            definitionsFound.push(filename);
        }
    });

    if (definitionsFound.length > 0) {
        const report = `"${word}" is defined in:\n• ${definitionsFound.join('\n• ')}`;
        logDiag(report, "info");
    } else {
        logDiag(`Could not find a local definition for "${word}".`, "error");
    }
}
