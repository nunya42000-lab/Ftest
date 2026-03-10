/* DevOS IDE Engine - Upgraded Core */

localforage.config({ name: 'DevOS' });

// --- Global State ---
let vfs = {}; 
let snippets = [];
let autoSaveTimer;
let lintTimer;

// NEW: Multi-Tab State
let openTabs = [];
let activeTab = null;

let cmEditor = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data
    vfs = (await localforage.getItem('devos_vfs')) || { 'index.html': '<h1>Ready.</h1>' };
    snippets = (await localforage.getItem('vault_snippets')) || [];
    
    // NEW: Load Tab State
    openTabs = (await localforage.getItem('devos_tabs')) || [];
    activeTab = await localforage.getItem('devos_active_tab');

    // NEW: Initialize Theme
    const savedTheme = localStorage.getItem('settings_theme') || 'dracula';
    document.getElementById('theme-selector').value = savedTheme;
    changeTheme(savedTheme);

    // 2. Initialize CodeMirror
    const textArea = document.getElementById('code-editor');
    if (textArea) {
        cmEditor = CodeMirror.fromTextArea(textArea, {
            lineNumbers: true,
            theme: savedTheme === 'light' ? 'default' : savedTheme,
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

    // 3. Global Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveVFS(); flashSaveStatus(); }
        if (e.shiftKey && e.key === 'F') { e.preventDefault(); formatCurrentFile(); }
        if (e.ctrlKey && e.key === 'e') { e.preventDefault(); runPreview(); }
    });

    // 4. Command Palette Listener
    const cmdInput = document.getElementById('cmd-input');
    if (cmdInput) {
        cmdInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleCommand(e.target.value.toLowerCase().trim());
        });
    }

    // 5. Initial Render
    const savedToolbarState = localStorage.getItem('settings_show_toolbar') !== 'false';
    const toggleCheckbox = document.getElementById('toggle-toolbar');
    if (toggleCheckbox) toggleCheckbox.checked = savedToolbarState;
    applyToolbarState(savedToolbarState);

    // Restore last open tab if it exists
    if (activeTab && vfs[activeTab]) {
        openTab(activeTab);
    } else if (openTabs.length > 0 && vfs[openTabs[0]]) {
        openTab(openTabs[0]);
    } else {
        renderTabs();
    }

    if (typeof renderFileList === 'function') renderFileList();
    if (typeof renderVault === 'function') renderVault();
    if (typeof renderTrash === 'function') renderTrash();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof updateProjectStats === 'function') updateProjectStats();
});


// --- NEW: Multi-Tab System ---

async function saveTabState() {
    await localforage.setItem('devos_tabs', openTabs);
    await localforage.setItem('devos_active_tab', activeTab);
}

function renderTabs() {
    const container = document.getElementById('file-tabs-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    openTabs.forEach(file => {
        const tab = document.createElement('div');
        tab.className = `file-tab ${file === activeTab ? 'active' : ''}`;
        
        tab.innerHTML = `
            <span onclick="openTab('${file}')">${file}</span>
            <span class="close-tab" onclick="closeTab('${file}', event)">✖</span>
        `;
        container.appendChild(tab);
    });
    
    document.getElementById('current-file-label').innerText = activeTab || 'no file selected';
}

function openTab(filename) {
    if (!vfs[filename] && vfs[filename] !== "") return;
    
    if (!openTabs.includes(filename)) {
        openTabs.push(filename);
    }
    
    activeTab = filename;
    
    if (cmEditor) {
        // Set mode based on file extension
        const ext = filename.split('.').pop().toLowerCase();
        let mode = 'javascript';
        if (ext === 'html') mode = 'htmlmixed';
        if (ext === 'css') mode = 'css';
        if (ext === 'json') mode = 'application/json';
        
        cmEditor.setOption("mode", mode);
        cmEditor.setValue(vfs[filename]);
    }
    
    renderTabs();
    saveTabState();
    
    if (typeof renderFileList === 'function') renderFileList();
}

function closeTab(filename, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    
    const index = openTabs.indexOf(filename);
    if (index > -1) {
        openTabs.splice(index, 1);
        
        if (activeTab === filename) {
            if (openTabs.length > 0) {
                openTab(openTabs[Math.max(0, index - 1)]);
            } else {
                activeTab = null;
                if (cmEditor) cmEditor.setValue('');
                renderTabs();
                saveTabState();
            }
        } else {
            renderTabs();
            saveTabState();
        }
    }
    if (typeof renderFileList === 'function') renderFileList();
}

function closeAllTabs() {
    openTabs = [];
    activeTab = null;
    if (cmEditor) cmEditor.setValue('');
    renderTabs();
    saveTabState();
    if (typeof renderFileList === 'function') renderFileList();
}


// --- NEW: Theme Management ---

function changeTheme(themeName) {
    document.body.className = `theme-${themeName}`;
    localStorage.setItem('settings_theme', themeName);
    
    if (cmEditor) {
        // Map light theme to CodeMirror's default light theme
        const cmTheme = themeName === 'light' ? 'default' : themeName;
        cmEditor.setOption("theme", cmTheme);
    }
}


// --- Core UI & Navigation ---

function switchTab(tabId, event) {
    document.querySelectorAll('.panel-box').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const target = document.getElementById('view-' + tabId);
    if(target) target.classList.add('active');
    
    if (tabId === 'editor') {
        const show = localStorage.getItem('settings_show_toolbar') !== 'false';
        applyToolbarState(show);
        setTimeout(() => cmEditor && cmEditor.refresh(), 50);
    } else if (tabId === 'tools' && typeof updateProjectStats === 'function') {
        updateProjectStats(); 
    }
    
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
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
    if (cmd.startsWith('>')) {
        runTerminalCmd(cmd.substring(1).trim());
        toggleCommandPalette();
        return;
    }
    const actions = {
        'export': () => typeof exportProjectZip === 'function' && exportProjectZip(),
        'lint': runLinter,
        'fix': autoFixCurrentFile,
        'format': formatCurrentFile,
        'close all': closeAllTabs,
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


// --- Editor Tools & Intelligence ---

function triggerReactiveLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => {
        if (activeTab && (activeTab.endsWith('.js') || activeTab.endsWith('.json'))) {
            runLinter();
        }
    }, 1500); 
}

function runLinter() {
    if(!activeTab || !cmEditor) return;
    const code = cmEditor.getValue();
    const ext = activeTab.split('.').pop().toLowerCase();
    let results = [];

    if (ext === 'js' && typeof JSHINT !== 'undefined') {
        const options = { 
            esversion: 11, browser: true, module: true, 
            undef: true, unused: true, shadow: "warn", loopfunc: true 
        };
        JSHINT(code, options);
        
        if (JSHINT.errors.length > 0) {
            JSHINT.errors.forEach(e => { 
                if (e) results.push(`✖ L${e.line}: ${e.reason}`);
            });
        }
        if (results.length > 0) logDiag(results.join('\n'), "error");
        else logDiag("✔ Platinum Check: Logic and Syntax look perfect.", "success");
    }
}

function autoFixCurrentFile() {
    if(!activeTab || !cmEditor) return;
    formatCurrentFile();
    let fixedCode = cmEditor.getValue()
        .replace(/console\.log\(.*\);?\n?/g, '') 
        .replace(/\n\s*\n\s*\n/g, '\n\n')       
        .replace(/debugger;?\n?/g, '');         

    cmEditor.setValue(fixedCode);
    logDiag("✔ Logic scrubbed and formatting applied.", "success");
}

function runGlobalHealthCheck() {
    let summary = "Project Health Scan:\n\n";
    let issues = 0;
    Object.entries(vfs).forEach(([name, code]) => {
        if (name.endsWith('.js') && typeof JSHINT !== 'undefined') {
            JSHINT(code, { esversion: 11 });
            if (JSHINT.errors.length > 0) {
                summary += `✖ ${name}: ${JSHINT.errors.length} errors\n`;
                issues++;
            }
        }
    });
    logDiag(issues > 0 ? summary : "✔ Project Health: Excellent.", issues > 0 ? "error" : "success");
}

function generateAutoImports() {
    if (!activeTab || !activeTab.endsWith('.js') || typeof analyzeSnippetDependencies !== 'function') return;
    const { requires } = analyzeSnippetDependencies(cmEditor.getValue());
    let newImports = "";
    requires.forEach(req => {
        for (const [filename, code] of Object.entries(vfs)) {
            if (filename === activeTab) continue;
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
    Object.keys(vfs).forEach(name => { 
        if(typeof vfs[name] === 'string') vfs[name] = vfs[name].split(findText).join(replaceText); 
    });
    if (activeTab && cmEditor) cmEditor.setValue(vfs[activeTab]);
    saveVFS();
    logDiag("Refactor complete across VFS.", "success");
}

function peekDefinition() {
    if (!cmEditor) return;
    const word = cmEditor.getSelection().trim();
    if (!word) return logDiag("Highlight a variable or function name to peek its definition.", "info");

    let definitionsFound = [];
    const defRegex = new RegExp(`(?:function|const|let|var|class)\\s+${word}\\b`);

    Object.entries(vfs).forEach(([filename, content]) => {
        if (typeof content === 'string' && defRegex.test(content)) definitionsFound.push(filename);
    });

    if (definitionsFound.length > 0) {
        logDiag(`"${word}" is defined in:\n• ${definitionsFound.join('\n• ')}`, "info");
    } else {
        logDiag(`Could not find a local definition for "${word}".`, "error");
    }
}

function runTerminalCmd(input) {
    try {
        const result = eval(input);
        logDiag(`> ${input}\nResult: ${JSON.stringify(result, null, 2)}`, "info");
    } catch (e) { logDiag(`Error: ${e.message}`, "error"); }
}


// --- Upgraded Preview Engine & Console ---

function runPreview() {
    if (activeTab && cmEditor) vfs[activeTab] = cmEditor.getValue();
    let html = vfs['index.html'] || '<h1>No index.html</h1>';
    
    // NEW: Inject listener for interactive console commands
    const hook = `<script>
        const format = (arg) => (typeof arg === 'object') ? JSON.stringify(arg, null, 2) : String(arg);
        console.log = (...args) => {
            const d = window.parent.document.getElementById('console-output');
            if(d) {
                d.innerHTML += '<div style="color:var(--text); padding:2px 0;">> ' + args.map(format).join(' ') + '</div>';
                d.scrollTop = d.scrollHeight;
            }
        };
        window.onerror = (m, u, l) => {
            const d = window.parent.document.getElementById('console-output');
            if(d) {
                d.innerHTML += '<div style="color:var(--danger); padding:2px 0;">✖ Line ' + l + ': ' + m + '</div>';
                d.scrollTop = d.scrollHeight;
            }
        };
        // Listen for console commands from parent
        window.addEventListener('message', (event) => {
            if(event.data && event.data.type === 'CONSOLE_EVAL') {
                try {
                    const result = eval(event.data.code);
                    console.log(result);
                } catch(err) {
                    const d = window.parent.document.getElementById('console-output');
                    if(d) {
                        d.innerHTML += '<div style="color:var(--danger); padding:2px 0;">✖ Eval Error: ' + err.message + '</div>';
                        d.scrollTop = d.scrollHeight;
                    }
                }
            }
        });
    <\/script>`;
    
    document.getElementById('console-output').innerHTML = '';
    document.getElementById('preview-frame').srcdoc = html.replace('<head>', '<head>' + hook);
    switchTab('run');
}

// NEW: Execute code in the live preview context
function executeConsoleCommand(code) {
    if (!code.trim()) return;
    const inputField = document.getElementById('interactive-console-input');
    const iframe = document.getElementById('preview-frame');
    
    // Echo command to console ui
    const out = document.getElementById('console-output');
    if(out) {
        out.innerHTML += `<div style="color:var(--muted); padding:2px 0;"><i>$ ${code}</i></div>`;
    }
    
    // Send to iframe
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'CONSOLE_EVAL', code: code }, '*');
    }
    
    inputField.value = ''; // clear input
}


// --- Core VFS Saving ---

async function saveVFS() {
    if (activeTab && cmEditor) {
        // If content changed, take a snapshot for the Time Machine before saving
        if (vfs[activeTab] !== cmEditor.getValue() && typeof takeSnapshot === 'function') {
            await takeSnapshot(activeTab, vfs[activeTab]);
        }
        vfs[activeTab] = cmEditor.getValue();
    }
    await localforage.setItem('devos_vfs', vfs);
    if (typeof updateProjectStats === 'function') updateProjectStats();
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => { await saveVFS(); flashSaveStatus(); }, 1500);
}

function flashSaveStatus() {
    const msg = document.getElementById('status-msg');
    if (msg) { msg.style.opacity = '1'; setTimeout(() => msg.style.opacity = '0', 2000); }
}


// --- Trash Utilities ---

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
    vfs[name] = trash[name]; // Was trash[name].code previously, mapped direct
    delete trash[name];
    await localforage.setItem('devos_trash', trash);
    await saveVFS();
    if (typeof renderFileList === 'function') renderFileList();
    renderTrash();
}

async function emptyTrash() {
    if (confirm("Clear trash?")) { await localforage.setItem('devos_trash', {}); renderTrash(); }
}


// --- General Utilities & Vault ---

function logDiag(msg, type) {
    const out = document.getElementById('diagnostic-results');
    if (!out) return;
    const colors = { error: 'var(--danger)', success: 'var(--success)', warn: 'var(--warn)', info: 'var(--accent)' };
    out.style.color = colors[type] || '#fff';
    out.innerText = msg;
}

function formatCurrentFile() {
    if (!cmEditor || !activeTab) return;
    const code = cmEditor.getValue();
    const ext = activeTab.split('.').pop().toLowerCase();
    let formatted = code;
    try {
        if (ext === 'js' && typeof js_beautify !== 'undefined') formatted = js_beautify(code, { indent_size: 4 });
        else if (ext === 'html' && typeof html_beautify !== 'undefined') formatted = html_beautify(code, { indent_size: 4 });
        else if (ext === 'css' && typeof css_beautify !== 'undefined') formatted = css_beautify(code, { indent_size: 4 });
        cmEditor.setValue(formatted);
    } catch(e) { logDiag("Format error: " + e.message, "error"); }
}

function insertSymbol(sym, template = false) {
    if (!cmEditor) return;
    const cursor = cmEditor.getCursor();
    if (template) { cmEditor.replaceRange("${}", cursor); cmEditor.setCursor(cursor.line, cursor.ch + 2); }
    else { cmEditor.replaceRange(sym, cursor); cmEditor.focus(); }
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
    if (!cmEditor) return;
    const s = snippets.find(snip => snip.id === id);
    if (s) { cmEditor.replaceSelection(s.code); cmEditor.focus(); }
}

