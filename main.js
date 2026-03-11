/* DevOS IDE Engine - ULTIMATE Core */

localforage.config({ name: 'DevOS' });

// --- Global State ---
let vfs = {}; 
let snippets = [];
let autoSaveTimer;
let lintTimer;
window.dependencyMap = {}; // Globalized for Intelligence & Build modules

// Multi-Tab & Workspace State
let openTabs = [];
let activeTab = null;
let cmEditor = null;
let customShortcuts = [];

// --- Initialization & Emergency Diagnostic ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DevOS Booting...");

    // 1. Verify Module Loading
    const requiredModules = [
        { name: 'Explorer', func: typeof renderFileList },
        { name: 'Mobile-UX', func: typeof initMobileUX },
        { name: 'Vault-compiler', func: typeof renderVault },
        { name: 'Git-Lite', func: typeof renderBranchList },
        { name: 'Intelligence', func: typeof generateDependencyTree }
    ];

    const missing = requiredModules.filter(m => m.func === 'undefined');
    if (missing.length > 0) {
        alert("⚠️ CRITICAL ERROR: The following modules failed to load: " + missing.map(m => m.name).join(', ') + "\n\nCheck if these files exist and are free of syntax errors.");
        return; 
    }

    // 2. Load Data from Storage
    vfs = (await localforage.getItem('devos_vfs')) || {};
    ensurePWAFiles();
    snippets = (await localforage.getItem('vault_snippets')) || [];
    
    // 3. Load Tab State
    openTabs = (await localforage.getItem('devos_tabs')) || [];
    activeTab = await localforage.getItem('devos_active_tab');

    // 4. Initialize Theme
    const savedTheme = localStorage.getItem('settings_theme') || 'dracula';
    changeTheme(savedTheme);

    // 5. Load Custom Shortcuts
    loadShortcuts();

    // 6. Initialize CodeMirror Editor
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

        // Force refresh for mobile display visibility
        setTimeout(() => cmEditor.refresh(), 200);
    }

    // 7. Global Event Listeners
    window.addEventListener('keydown', handleKeybinds);

    // 8. Initial UI Render
    if (activeTab && vfs[activeTab] !== undefined) {
        openTab(activeTab);
    } else if (openTabs.length > 0) {
        openTab(openTabs[0]);
    } else {
        renderTabs();
    }

    // Initialize all modular UIs
    renderFileList();
    renderVault();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderBranchList === 'function') renderBranchList();
    if (typeof updateProjectStats === 'function') updateProjectStats();
});

// --- PWA Core Files ---
function ensurePWAFiles() {
    let changed = false;
    if (!vfs['manifest.json']) {
        vfs['manifest.json'] = JSON.stringify({
            "name": "DevOS IDE Gold",
            "short_name": "DevOS",
            "start_url": "./index.html",
            "display": "standalone",
            "background_color": "#0d1117",
            "theme_color": "#2f81f7"
        }, null, 4);
        changed = true;
    }
    if (!vfs['index.html']) {
        vfs['index.html'] = `<!DOCTYPE html>\n<html>\n<head><title>My App</title></head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>`;
        changed = true;
    }
    if (changed) saveVFS();
}

// --- VFS Management ---
async function saveVFS() {
    if (activeTab && cmEditor) {
        vfs[activeTab] = cmEditor.getValue();
    }
    await localforage.setItem('devos_vfs', vfs);
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveVFS, 1500);
}

// --- Tab & Workspace Management ---
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
            <span onclick="closeTab('${file}', event)" class="close-btn" style="margin-left:8px; color:var(--danger);">✖</span>
        `;
        container.appendChild(tab);
    });
    
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
        if (ext === 'json') mode = 'application/json';
        
        cmEditor.setOption("mode", mode);
        cmEditor.setValue(vfs[filename]);
        setTimeout(() => cmEditor.refresh(), 50);
    }
    
    switchTab('editor');
    renderTabs();
    saveTabState();

    // Mobile UX: Auto-close sidebar when a file is selected
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('ui-sidebar');
        if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
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

function switchTab(tabId) {
    // Hide all panels
    document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
    
    // Show target panel
    const target = document.getElementById(tabId + '-view');
    if (target) target.style.display = 'flex';
    
    // Run view-specific entry logic
    if (tabId === 'editor') setTimeout(() => cmEditor && cmEditor.refresh(), 50);
    if (tabId === 'preview') if (typeof refreshLivePreview === 'function') refreshLivePreview();
    if (tabId === 'intelligence') if (typeof updateProjectStats === 'function') updateProjectStats();
    if (tabId === 'help') if (typeof renderHelpSystem === 'function') renderHelpSystem();
    if (tabId === 'history') if (typeof renderHistory === 'function') renderHistory();
    if (tabId === 'diff') if (typeof initDiffViewer === 'function') initDiffViewer();
}

// --- Editor Tools ---
function openSettings() {
    switchTab('settings');
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('ui-sidebar');
        if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
    }
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
    } catch (e) { console.error("Formatting error:", e); }
}

function triggerReactiveLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => { if (activeTab) runLinter(); }, 1500);
}

// --- Shortcuts & UI Helpers ---
const defaultShortcuts = [
    { key: 'ctrl+s', action: 'format' },
    { key: 'alt+t', action: 'new_file' }
];

function handleKeybinds(e) {
    let keyStr = (e.ctrlKey ? 'ctrl+' : '') + (e.altKey ? 'alt+' : '') + e.key.toLowerCase();
    const match = customShortcuts.find(sc => sc.key === keyStr);
    if (match) { e.preventDefault(); executeAction(match.action); }
}

function loadShortcuts() {
    const saved = localStorage.getItem('devos_shortcuts');
    customShortcuts = saved ? JSON.parse(saved) : defaultShortcuts;
}

function executeAction(action) {
    if (action === 'format') formatCode();
    if (action === 'new_file') createNewFile();
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

async function factoryReset() {
    if (prompt("☢️ DANGER: Type 'NUKE' to wipe all files, history, and settings:") === 'NUKE') {
        await localforage.clear();
        localStorage.clear();
        alert("System Reset. Reloading...");
        window.location.reload();
    }
          }
          
