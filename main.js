/* DevOS IDE Engine - ULTIMATE Core */

localforage.config({ name: 'DevOS' });

// --- Global State ---
let vfs = {}; 
let snippets = [];
let autoSaveTimer;
let lintTimer;

// Multi-Tab & Workspace State
let openTabs = [];
let activeTab = null;
let cmEditor = null;
let customShortcuts = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data
    vfs = (await localforage.getItem('devos_vfs')) || {};
    ensurePWAFiles();
    snippets = (await localforage.getItem('vault_snippets')) || [];
    
    // 2. Load Tab State
    openTabs = (await localforage.getItem('devos_tabs')) || [];
    activeTab = await localforage.getItem('devos_active_tab');

    // 3. Initialize Theme
    const savedTheme = localStorage.getItem('settings_theme') || 'dracula';
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
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
            extraKeys: {"Ctrl-Space": "autocomplete"}
        });

        cmEditor.on('change', () => {
            triggerAutoSave();
            triggerReactiveLint();
        });
    }

    // 6. Event Listeners
    window.addEventListener('keydown', handleKeybinds);

    // 7. Initial Render
    if (activeTab && vfs[activeTab] !== undefined) {
        openTab(activeTab);
    } else if (openTabs.length > 0) {
        openTab(openTabs[0]);
    } else {
        renderTabs();
    }

    // Refresh all module UIs
    if (typeof renderFileList === 'function') renderFileList();
    if (typeof renderVault === 'function') renderVault();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderBranchList === 'function') renderBranchList();
    if (typeof updateProjectStats === 'function') updateProjectStats();
});

// --- PWA Initialization ---
function ensurePWAFiles() {
    if (!vfs['manifest.json']) {
        vfs['manifest.json'] = JSON.stringify({
            "name": "DevOS IDE Gold",
            "short_name": "DevOS",
            "start_url": "./index.html",
            "display": "standalone",
            "background_color": "#0d1117",
            "theme_color": "#2f81f7"
        }, null, 4);
    }
    if (!vfs['index.html']) {
        vfs['index.html'] = `<h1>Welcome to DevOS Ultimate</h1>\n<p>Start coding on the go.</p>`;
    }
    saveVFS();
}

// --- VFS & Tab Management ---
async function saveVFS() {
    if (activeTab && cmEditor) {
        const newCode = cmEditor.getValue();
        vfs[activeTab] = newCode;
    }
    await localforage.setItem('devos_vfs', vfs);
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveVFS, 1500);
}

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
        tab.innerHTML = `
            <span onclick="openTab('${file}')">📄 ${file}</span>
            <span onclick="closeTab('${file}', event)" class="close-btn">✖</span>
        `;
        container.appendChild(tab);
    });
    
    // Smooth scroll to active tab
    const activeEl = container.querySelector('.file-tab.active');
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center' });
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
        if (ext === 'md') mode = 'markdown';
        
        cmEditor.setOption("mode", mode);
        cmEditor.setValue(vfs[filename]);
    }
    
    switchTab('editor');
    renderTabs();
    saveTabState();

    // Mobile Auto-Close Sidebar
    if (window.innerWidth <= 768 && document.getElementById('ui-sidebar').classList.contains('active')) {
        toggleSidebar(); 
    }
}

function closeTab(filename, event) {
    if (event) event.stopPropagation();
    const index = openTabs.indexOf(filename);
    if (index > -1) {
        openTabs.splice(index, 1);
        if (activeTab === filename) {
            if (openTabs.length > 0) openTab(openTabs[Math.max(0, index - 1)]);
            else { activeTab = null; cmEditor.setValue(''); renderTabs(); }
        } else { renderTabs(); }
    }
    saveTabState();
}

// --- Workspace Switching ---
function switchTab(tabId) {
    document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
    const target = document.getElementById(tabId + '-view');
    if (target) target.style.display = 'flex';
    
    // Specific logic for view entry
    if (tabId === 'editor') setTimeout(() => cmEditor && cmEditor.refresh(), 50);
    if (tabId === 'preview') refreshLivePreview();
    if (tabId === 'intelligence') updateProjectStats();
    if (tabId === 'help') renderHelpSystem();
    if (tabId === 'history') renderHistory();
    if (tabId === 'diff') initDiffViewer();
}

// --- Tool Connectors ---
function openSettings() {
    switchTab('settings');
    if (window.innerWidth <= 768) toggleSidebar(); 
}

function formatCode() {
    if (!activeTab || !cmEditor) return;
    const code = cmEditor.getValue();
    const ext = activeTab.split('.').pop().toLowerCase();
    let formatted = code;
    try {
        if (ext === 'js') formatted = js_beautify(code, { indent_size: 4 });
        if (ext === 'html') formatted = html_beautify(code, { indent_size: 4 });
        if (ext === 'css') formatted = css_beautify(code, { indent_size: 4 });
        cmEditor.setValue(formatted);
        saveVFS();
        if (typeof triggerHaptic === 'function') triggerHaptic('success');
    } catch (e) { console.error("Format Error", e); }
}

function triggerReactiveLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => { if (activeTab) runLinter(); }, 1500);
}

// --- Keybinds & Command Palette ---
function handleKeybinds(e) {
    let keyStr = (e.ctrlKey ? 'ctrl+' : '') + (e.altKey ? 'alt+' : '') + e.key.toLowerCase();
    const match = customShortcuts.find(sc => sc.key === keyStr);
    if (match) { e.preventDefault(); executeAction(match.action); }
}

function loadShortcuts() {
    const saved = localStorage.getItem('devos_shortcuts');
    customShortcuts = saved ? JSON.parse(saved) : defaultShortcuts;
}

function changeTheme(themeName) {
    document.body.className = `theme-${themeName}`;
    localStorage.setItem('settings_theme', themeName);
    if (cmEditor) cmEditor.setOption("theme", themeName === 'light' ? 'default' : themeName);
}

function toggleSidebar() {
    document.getElementById('ui-sidebar').classList.toggle('active');
}

/**
 * FINAL NUKE SEQUENCE
 */
async function factoryReset() {
    if (prompt("Type 'NUKE' to wipe everything:") === 'NUKE') {
        await localforage.clear();
        localStorage.clear();
        alert("Project Purged.");
        window.location.reload();
    }
        }
    
