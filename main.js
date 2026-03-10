/* DevOS IDE Engine - Upgraded Core */

localforage.config({ name: 'DevOS' });

// --- Global State ---
let vfs = {}; 
let snippets = [];
let autoSaveTimer;
let lintTimer;

// Multi-Tab State
let openTabs = [];
let activeTab = null;
let cmEditor = null;

// Customizable Shortcuts State
let customShortcuts = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data & Initialize PWA Files
    vfs = (await localforage.getItem('devos_vfs')) || {};
    ensurePWAFiles();
    
    snippets = (await localforage.getItem('vault_snippets')) || [];
    
    // 2. Load Tab State
    openTabs = (await localforage.getItem('devos_tabs')) || [];
    activeTab = await localforage.getItem('devos_active_tab');

    // 3. Initialize Theme
    const savedTheme = localStorage.getItem('settings_theme') || 'dracula';
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) themeSelector.value = savedTheme;
    changeTheme(savedTheme);

    // 4. Load Custom Shortcuts
    loadShortcuts();

    // 5. Initialize CodeMirror
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
    }

    // 6. Global Shortcut Listener
    window.addEventListener('keydown', handleKeybinds);

    // 7. Initial Render
    if (activeTab && vfs[activeTab] !== undefined) {
        openTab(activeTab);
    } else if (openTabs.length > 0 && vfs[openTabs[0]] !== undefined) {
        openTab(openTabs[0]);
    } else {
        renderTabs();
    }

    if (typeof renderFileList === 'function') renderFileList();
    if (typeof renderVault === 'function') renderVault();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof updateProjectStats === 'function') updateProjectStats();
});

// --- Dynamic PWA Bootstrapping ---
function ensurePWAFiles() {
    let changed = false;
    
    if (!vfs['manifest.json']) {
        vfs['manifest.json'] = JSON.stringify({
            "name": "DevOS IDE Gold",
            "short_name": "DevOS",
            "start_url": "./index.html",
            "display": "standalone",
            "background_color": "#0d1117",
            "theme_color": "#2f81f7",
            "icons": [{
                "src": "https://cdn-icons-png.flaticon.com/512/606/606203.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any maskable"
            }]
        }, null, 4);
        changed = true;
    }

    if (!vfs['sw.js']) {
        vfs['sw.js'] = `self.addEventListener('install', (e) => self.skipWaiting());\nself.addEventListener('activate', (e) => self.clients.claim());`;
        changed = true;
    }

    if (Object.keys(vfs).length === 2) {
        vfs['index.html'] = `<h1>Welcome to DevOS Gold</h1>\n<p>Start coding!</p>`;
        changed = true;
    }

    if (changed) saveVFS();
}

// --- VFS Management ---
async function saveVFS() {
    if (activeTab && cmEditor) {
        const newCode = cmEditor.getValue();
        if (vfs[activeTab] !== newCode) {
            if (typeof takeSnapshot === 'function') {
                await takeSnapshot(activeTab, vfs[activeTab]); 
            }
            vfs[activeTab] = newCode;
        }
    }
    await localforage.setItem('devos_vfs', vfs);
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveVFS, 1500);
}

// --- Multi-Tab Swiping & Navigation System ---
async function saveTabState() {
    await localforage.setItem('devos_tabs', openTabs);
    await localforage.setItem('devos_active_tab', activeTab);
}

function renderTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    openTabs.forEach(file => {
        const tab = document.createElement('div');
        tab.className = `file-tab ${file === activeTab ? 'active' : ''}`;
        tab.style.display = "inline-flex";
        tab.style.alignItems = "center";
        tab.style.padding = "8px 15px";
        tab.style.marginRight = "5px";
        tab.style.background = file === activeTab ? "var(--surface-light)" : "var(--bg)";
        tab.style.border = `1px solid ${file === activeTab ? "var(--accent)" : "var(--border)"}`;
        tab.style.borderRadius = "6px";
        tab.style.cursor = "pointer";
        tab.style.userSelect = "none";
        tab.style.scrollSnapAlign = "start";
        
        tab.innerHTML = `
            <span onclick="openTab('${file}')" style="margin-right:8px;">📄 ${file}</span>
            <span onclick="closeTab('${file}', event)" style="color:var(--danger); font-weight:bold; font-size:12px;">✖</span>
        `;
        container.appendChild(tab);
    });
    
    setTimeout(() => {
        const activeEl = container.querySelector('.file-tab.active');
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 50);
}

function openTab(filename) {
    if (vfs[filename] === undefined) return;
    
    if (!openTabs.includes(filename)) openTabs.push(filename);
    
    if (activeTab && cmEditor) vfs[activeTab] = cmEditor.getValue();
    
    activeTab = filename;
    
    if (cmEditor) {
        const ext = filename.split('.').pop().toLowerCase();
        let mode = 'javascript';
        if (ext === 'html') mode = 'htmlmixed';
        if (ext === 'css') mode = 'css';
        if (ext === 'json') mode = 'application/json';
        
        cmEditor.setOption("mode", mode);
        cmEditor.setValue(vfs[filename]);
        
        const lintPanel = document.getElementById('lint-errors');
        if (lintPanel) lintPanel.style.display = 'none';
    }
    
    switchTab('editor');
    renderTabs();
    saveTabState();
    if (typeof renderFileList === 'function') renderFileList();
if (window.innerWidth <= 768 && document.getElementById('ui-sidebar').classList.contains('active')) {
    toggleSidebar(); 
}
    
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

// --- Snippet Tools & Vault UI ---
async function cutSnippet() {
    if (!cmEditor) return;
    const selectedText = cmEditor.getSelection();
    if (selectedText) {
        const name = prompt("Name this Snippet before cutting:", "Cut Snippet");
        if (name) {
            snippets.push({ name, code: selectedText, id: Date.now() });
            await localforage.setItem('vault_snippets', snippets);
            cmEditor.replaceSelection('');
            saveVFS();
            renderVault();
        }
    } else {
        alert("Please select code to cut.");
    }
}

async function copySnippet() {
    if (!cmEditor) return;
    const selectedText = cmEditor.getSelection();
    if (selectedText) {
        const name = prompt("Name this Snippet before copying:", "Copied Snippet");
        if (name) {
            snippets.push({ name, code: selectedText, id: Date.now() });
            await localforage.setItem('vault_snippets', snippets);
            renderVault();
        }
    } else {
        alert("Please select code to copy.");
    }
}

function renderVault() {
    const list = document.getElementById('vault-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (snippets.length === 0) {
        list.innerHTML = '<div style="color:var(--muted); font-style:italic; font-size: 12px; padding: 5px;">Vault is empty. Cut/Copy snippets to add them.</div>';
        return;
    }

    snippets.forEach((s) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '6px';
        div.style.borderBottom = '1px solid var(--border)';
        div.style.fontSize = '12px';
        
        div.innerHTML = `
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text); cursor:pointer;" onclick="insertSnippet(${s.id})" title="Insert Snippet">
                🧩 ${s.name}
            </span>
            <div>
                <button class="btn-primary" style="padding:2px 6px; font-size:10px; margin-right:4px;" onclick="insertSnippet(${s.id})">ADD</button>
                <button class="btn-danger" style="padding:2px 6px; font-size:10px;" onclick="deleteSnippet(${s.id})">✖</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function insertSnippet(id) {
    if (!cmEditor) return;
    const s = snippets.find(snip => snip.id === id);
    if (s) { 
        cmEditor.replaceSelection(s.code); 
        cmEditor.focus(); 
        saveVFS();
    }
}

async function deleteSnippet(id) {
    if(confirm("Delete this snippet from the Vault?")) {
        snippets = snippets.filter(snip => snip.id !== id);
        await localforage.setItem('vault_snippets', snippets);
        renderVault();
    }
}

// --- Declarations & ID Scanner ---
function scanDeclarations() {
    const list = document.getElementById('declarations-list');
    if (!list) return;
    
    list.innerHTML = '';
    let foundCount = 0;
    
    Object.entries(vfs).forEach(([filename, content]) => {
        if (typeof content !== 'string') return;
        const matches = [];
        
        if (filename.endsWith('.html')) {
            const idRegex = /id=["'](.*?)["']/g;
            let m;
            while ((m = idRegex.exec(content)) !== null) matches.push({ type: 'ID', name: m[1] });
        } else if (filename.endsWith('.js')) {
            const fnRegex = /function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
            const varRegex = /(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
            const classRegex = /class\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
            
            let m;
            while ((m = fnRegex.exec(content)) !== null) matches.push({ type: 'Function', name: m[1] });
            while ((m = varRegex.exec(content)) !== null) matches.push({ type: 'Variable', name: m[1] });
            while ((m = classRegex.exec(content)) !== null) matches.push({ type: 'Class', name: m[1] });
        }
        
        if (matches.length > 0) {
            const fileHeader = document.createElement('div');
            fileHeader.style.color = "var(--accent)";
            fileHeader.style.fontWeight = "bold";
            fileHeader.style.marginTop = "8px";
            fileHeader.innerText = filename;
            list.appendChild(fileHeader);
            
            matches.forEach(match => {
                foundCount++;
                const item = document.createElement('div');
                item.style.padding = "2px 0";
                item.style.color = "var(--text)";
                item.innerHTML = `<span style="color:var(--muted); width: 60px; display:inline-block;">[${match.type}]</span> ${match.name}`;
                list.appendChild(item);
            });
        }
    });
    
    if (foundCount === 0) list.innerHTML = `<div style="color:var(--muted); font-style:italic;">No declarations found.</div>`;
}

// --- Sync Renaming across VFS ---
async function syncRename(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    
    const confirmSync = confirm(`Replace all instances of "${oldName}" with "${newName}" across ALL files?`);
    if (!confirmSync) return;
    
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapeRegExp(oldName)}\\b`, 'g'); 
    let changedFiles = 0;
    
    for (const file of Object.keys(vfs)) {
        const content = vfs[file];
        if (typeof content === 'string' && regex.test(content)) {
            if (typeof takeSnapshot === 'function') await takeSnapshot(file, content);
            vfs[file] = content.replace(regex, newName);
            changedFiles++;
        }
    }
    
    if (changedFiles > 0) {
        await localforage.setItem('devos_vfs', vfs);
        if (activeTab && cmEditor) cmEditor.setValue(vfs[activeTab]);
        alert(`Successfully synchronized rename across ${changedFiles} file(s).`);
    } else {
        alert(`No exact matches found for "${oldName}".`);
    }
}

// --- Keyboard Shortcuts Manager ---
const defaultShortcuts = [
    { key: 'ctrl+s', action: 'format', description: 'Auto Format Code' },
    { key: 'alt+t', action: 'new_file', description: 'Create New File' },
    { key: 'ctrl+e', action: 'sync_rename', description: 'Global Sync Rename' },
    { key: 'alt+arrowright', action: 'next_tab', description: 'Next Tab' },
    { key: 'alt+arrowleft', action: 'prev_tab', description: 'Previous Tab' }
];

function loadShortcuts() {
    const saved = localStorage.getItem('devos_shortcuts');
    customShortcuts = saved ? JSON.parse(saved) : defaultShortcuts;
    renderShortcutsManager();
}

function saveShortcuts() {
    localStorage.setItem('devos_shortcuts', JSON.stringify(customShortcuts));
    alert('Keybinds saved successfully!');
}

function renderShortcutsManager() {
    const container = document.getElementById('shortcuts-manager');
    if (!container) return;
    
    container.innerHTML = '';
    
    customShortcuts.forEach((sc, index) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '10px';
        row.style.marginBottom = '5px';
        
        row.innerHTML = `
            <input type="text" value="${sc.key}" onchange="updateShortcut(${index}, 'key', this.value)" style="flex: 1; padding: 4px; background: var(--bg); color: white; border: 1px solid var(--border);">
            <select onchange="updateShortcut(${index}, 'action', this.value)" style="flex: 2; padding: 4px; background: var(--bg); color: white; border: 1px solid var(--border);">
                <option value="format" ${sc.action === 'format' ? 'selected' : ''}>Auto Format</option>
                <option value="new_file" ${sc.action === 'new_file' ? 'selected' : ''}>New File</option>
                <option value="sync_rename" ${sc.action === 'sync_rename' ? 'selected' : ''}>Sync Rename</option>
                <option value="next_tab" ${sc.action === 'next_tab' ? 'selected' : ''}>Next Tab</option>
                <option value="prev_tab" ${sc.action === 'prev_tab' ? 'selected' : ''}>Previous Tab</option>
                <option value="lint" ${sc.action === 'lint' ? 'selected' : ''}>Force Lint</option>
                <option value="export_txt" ${sc.action === 'export_txt' ? 'selected' : ''}>Export TXT</option>
            </select>
            <button class="btn-danger" style="padding: 4px 8px;" onclick="removeShortcut(${index})">X</button>
        `;
        container.appendChild(row);
    });
}

function addNewShortcut() {
    customShortcuts.push({ key: 'ctrl+?', action: 'format', description: 'Custom' });
    renderShortcutsManager();
}

function updateShortcut(index, field, value) {
    customShortcuts[index][field] = value.toLowerCase();
}

function removeShortcut(index) {
    customShortcuts.splice(index, 1);
    renderShortcutsManager();
}

function handleKeybinds(e) {
    let keyStr = '';
    if (e.ctrlKey) keyStr += 'ctrl+';
    if (e.shiftKey) keyStr += 'shift+';
    if (e.altKey) keyStr += 'alt+';
    keyStr += e.key.toLowerCase();

    const matchedShortcut = customShortcuts.find(sc => sc.key === keyStr);
    
    if (matchedShortcut) {
        e.preventDefault();
        executeAction(matchedShortcut.action);
    }
}

function executeAction(action) {
    switch(action) {
        case 'format': formatCode(); break;
        case 'new_file': createNewFile(); break;
        case 'sync_rename': 
            const oldN = prompt("Global Rename - Replace what?");
            if (oldN) {
                const newN = prompt(`Replace "${oldN}" with:`);
                if (newN) syncRename(oldN, newN);
            }
            break;
        case 'next_tab': switchTabDirection(1); break;
        case 'prev_tab': switchTabDirection(-1); break;
        case 'lint': runLinter(); break;
        case 'export_txt': exportProjectToTXT(); break;
    }
}

function switchTabDirection(dir) {
    if (openTabs.length < 2) return;
    const currentIndex = openTabs.indexOf(activeTab);
    let newIndex = currentIndex + dir;
    if (newIndex >= openTabs.length) newIndex = 0;
    if (newIndex < 0) newIndex = openTabs.length - 1;
    openTab(openTabs[newIndex]);
}


// --- Editor Tools, Formatters & Advanced Linting ---
function triggerReactiveLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => {
        if (activeTab) runLinter();
    }, 1500);
}

function formatCode() {
    if (!activeTab || !cmEditor) return;
    const code = cmEditor.getValue();
    const ext = activeTab.split('.').pop().toLowerCase();
    
    let formatted = code;
    try {
        if (ext === 'js' && typeof html_beautify !== 'undefined') formatted = js_beautify(code, { indent_size: 4 });
        if (ext === 'html' && typeof html_beautify !== 'undefined') formatted = html_beautify(code, { indent_size: 4 });
        if (ext === 'css' && typeof css_beautify !== 'undefined') formatted = css_beautify(code, { indent_size: 4 });
        if (ext === 'json') formatted = JSON.stringify(JSON.parse(code), null, 4);
        
        cmEditor.setValue(formatted);
        saveVFS();
    } catch (err) {
        console.error("Formatting failed:", err);
    }
}

function runLinter() {
    if(!activeTab || !cmEditor) return;
    
    const code = cmEditor.getValue();
    const ext = activeTab.split('.').pop().toLowerCase();
    const lintPanel = document.getElementById('lint-errors');
    
    if (!lintPanel) return;
    
    lintPanel.innerHTML = '';
    let hasErrors = false;

    if (ext === 'js' && typeof JSHINT !== 'undefined') {
        JSHINT(code, { esversion: 11, browser: true, module: true });
        if (JSHINT.errors.length > 0) {
            hasErrors = true;
            JSHINT.errors.forEach(e => {
                if (e) createLintErrorRow(lintPanel, `Line ${e.line}: ${e.reason}`, e.line);
            });
        }
    }
    
    if (ext === 'html' && typeof HTMLHint !== 'undefined') {
        const messages = HTMLHint.verify(code, {"tag-pair": true, "attr-no-duplication": true});
        if (messages.length > 0) {
            hasErrors = true;
            messages.forEach(m => createLintErrorRow(lintPanel, `Line ${m.line}: ${m.message}`, m.line));
        }
    }

    if (ext === 'css' && typeof CSSLint !== 'undefined') {
        const result = CSSLint.verify(code);
        if (result.messages.length > 0) {
            hasErrors = true;
            result.messages.forEach(m => createLintErrorRow(lintPanel, `Line ${m.line}: ${m.message}`, m.line));
        }
    }

    lintPanel.style.display = hasErrors ? 'block' : 'none';
}

function createLintErrorRow(container, message, lineNum) {
    const div = document.createElement('div');
    div.style.color = "var(--danger)";
    div.style.fontSize = "12px";
    div.style.marginBottom = "4px";
    div.style.cursor = "pointer";
    div.style.padding = "4px";
    div.style.borderBottom = "1px solid var(--border)";
    div.innerText = `✖ ${message}`;
    
    div.onclick = () => {
        if (cmEditor) {
            cmEditor.setCursor({ line: lineNum - 1, ch: 0 });
            cmEditor.focus();
            const t = cmEditor.charCoords({line: lineNum - 1, ch: 0}, "local").top; 
            cmEditor.scrollTo(null, t - 50);
        }
    };
    container.appendChild(div);
}

// --- View Switching & UI Integration ---
function switchTab(tabId) {
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
    
    const target = document.getElementById(tabId + '-view');
    if (target) {
        target.classList.add('active');
        target.style.display = 'flex';
    }
    
    if (tabId === 'editor') {
        setTimeout(() => cmEditor && cmEditor.refresh(), 50);
    } else if (tabId === 'diff' && typeof initDiffViewer === 'function') {
        initDiffViewer(); 
    } else if (tabId === 'intelligence' && typeof updateProjectStats === 'function') {
        updateProjectStats();
    } else if (tabId === 'history' && typeof renderHistory === 'function') {
        renderHistory();
    }
}

// Settings & Nuke Bridge
function openSettings() {
    switchTab('settings');
    if (window.innerWidth <= 768) toggleSidebar(); 
}

async function factoryReset() {
    const confirmation = prompt(
        "☢️ NUKE SEQUENCE INITIATED ☢️\n\n" +
        "This will permanently delete ALL files, history, open tabs, trash, and vault snippets. There is no recovery.\n\n" +
        "Type 'NUKE' to confirm:"
    );

    if (confirmation === 'NUKE') {
        try {
            await localforage.removeItem('devos_vfs');
            await localforage.removeItem('devos_tabs');
            await localforage.removeItem('devos_active_tab');
            await localforage.removeItem('devos_history');
            await localforage.removeItem('vault_snippets');
            localStorage.removeItem('settings_theme');
            localStorage.removeItem('devos_shortcuts');
            
            alert("Project obliterated. Rebooting DevOS...");
            window.location.reload();
            
        } catch (err) {
            console.error("Nuke sequence failed:", err);
            alert("Error during factory reset. Check console.");
        }
    } else if (confirmation !== null) {
        alert("Nuke sequence aborted. Your files are safe.");
    }
}

// --- Export Tools ---
function exportProjectToTXT() {
    let combinedText = "=== DEVOS IDE GOLD EXPORT ===\n\n";
    
    Object.keys(vfs).forEach(filename => {
        combinedText += `\n/* =========================================================\n`;
        combinedText += `   FILE: ${filename}\n`;
        combinedText += `========================================================= */\n\n`;
        combinedText += vfs[filename] + "\n\n";
    });
    
    const blob = new Blob([combinedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "DevOS_Project_Export.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function createNewFile() {
    const filename = prompt("Enter new filename (e.g., script.js, style.css):");
    if (filename && !vfs[filename]) {
        let defaultContent = "";
        if (filename.endsWith('.html')) defaultContent = "<!DOCTYPE html>\n<html>\n<head></head>\n<body>\n\n</body>\n</html>";
        if (filename.endsWith('.js')) defaultContent = "// New Script\n";
        
        vfs[filename] = defaultContent;
        saveVFS();
        if(typeof renderFileList === 'function') renderFileList();
        openTab(filename);
    }
}

function changeTheme(themeName) {
    document.body.className = `theme-${themeName}`;
    localStorage.setItem('settings_theme', themeName);
    if (cmEditor) cmEditor.setOption("theme", themeName === 'light' ? 'default' : themeName);
}

function toggleSidebar() {
    const sidebar = document.getElementById('ui-sidebar');
    if (sidebar) sidebar.classList.toggle('active');
                                                }
  function toggleCommandPalette() {
    const pal = document.getElementById('command-palette');
    if (pal.style.display === 'none' || pal.style.display === '') {
        pal.style.display = 'block';
        document.getElementById('cmd-input').focus();
    } else {
        pal.style.display = 'none';
    }
}

// Allow closing the palette by tapping anywhere outside it or pressing Escape
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('command-palette').style.display = 'none';
});
    
