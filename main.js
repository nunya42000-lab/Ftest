/* DevOS Workspace - Merged Engine */

// --- Global State ---
let vfs = {}; 
let currentFile = null;
let cmEditor = null;
let snippets = [];
let snapshots = [];
let autoSaveTimer;
let activeBlobUrls = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data (Syncing with your devos_* keys)
    vfs = (await localforage.getItem('devos_vfs')) || { 'index.html': '<h1>Hello DevOS</h1>' };
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

    // 3. NATIVE GESTURE: Double-Tap/Double-Click to Vault
    // Optimized for your on-device mobile development
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
    
    // Settings persistence
    loadSettings();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW failed:", err));
    }
});

// --- Settings & UI Logic ---
function loadSettings() {
    const savedToolbarPref = localStorage.getItem('settings_show_toolbar') === 'true';
    const toggle = document.getElementById('toolbar-toggle');
    if (toggle) toggle.checked = savedToolbarPref;
    applyToolbarState(savedToolbarPref);
}

function toggleToolbarVisibility() {
    const isChecked = document.getElementById('toolbar-toggle').checked;
    localStorage.setItem('settings_show_toolbar', isChecked);
    applyToolbarState(isChecked);
}

function applyToolbarState(show) {
    const tb = document.getElementById('mobile-toolbar');
    if (tb) tb.style.display = show ? 'flex' : 'none';
    if(cmEditor) setTimeout(() => cmEditor.refresh(), 50);
}

function switchTab(tabId, event) {
    document.querySelectorAll('.panel-box').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('view-' + tabId).classList.add('active');
    if (event) event.currentTarget.classList.add('active');
    if (tabId === 'editor' && cmEditor) setTimeout(() => cmEditor.refresh(), 50);
}

function toggleSidebar() {
    document.getElementById('ui-sidebar').classList.toggle('open');
}

function flashSaveStatus(msg = "Saved") {
    const el = document.getElementById('status-msg');
    el.innerText = msg;
    el.style.opacity = 1;
    setTimeout(() => el.style.opacity = 0, 1500);
}

// --- VFS Operations ---
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
    list.innerHTML = '';
    Object.keys(vfs).sort().forEach(fn => {
        const div = document.createElement('div');
        div.className = 'file-item' + (fn === currentFile ? ' active' : '');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '10px 15px';
        div.style.borderBottom = '1px solid var(--border)';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = fn;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.flex = '1';
        nameSpan.style.color = (fn === currentFile) ? 'var(--accent)' : 'var(--text)';
        nameSpan.onclick = () => { switchFile(fn); toggleSidebar(); };
        
        const delBtn = document.createElement('button');
        delBtn.innerText = '×';
        delBtn.style.background = 'transparent';
        delBtn.style.color = 'var(--danger)';
        delBtn.style.fontSize = '18px';
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
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
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

// --- Snippet Compilation Engine ---
async function compileSelected() {
    const checkboxes = document.querySelectorAll('.vault-checkbox:checked');
    if (checkboxes.length === 0) return alert("Check snippets to compile.");

    const selectedSnippets = Array.from(checkboxes).map(cb => snippets[parseInt(cb.value)]);
    
    // Concatenation logic (Assuming standard JS export/import order)
    const compiledCode = selectedSnippets.map(s => `// --- From Snippet: ${s.name} ---\n${s.code}`).join('\n\n');

    const timestamp = new Date().toISOString().slice(11,19).replace(/:/g, '-');
    const newFileName = `compiled_${timestamp}.js`;
    
    vfs[newFileName] = compiledCode;
    await saveVFS();
    renderFileList();
    switchFile(newFileName);
    switchTab('editor');
    
    alert(`Compiled ${selectedSnippets.length} snippets into ${newFileName}`);
}

// --- Sandbox Hard Kill ---
function stopPreview() {
    const frame = document.getElementById('preview-frame');
    const container = frame.parentNode;
    const newFrame = document.createElement('iframe');
    newFrame.id = 'preview-frame';
    newFrame.setAttribute('sandbox', 'allow-scripts allow-modals');
    newFrame.style.cssText = "flex: 1; background: #fff; border: none; width: 100%;";
    container.replaceChild(newFrame, frame);
    document.getElementById('console-output').innerHTML = '<div class="log-msg">⏹ Sandbox Process Terminated.</div>';
}

function runPreview() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    let html = vfs['index.html'] || '<h1>No index.html</h1>';

    const scripts = Object.keys(vfs).filter(fn => fn.endsWith('.js') && fn !== 'sw.js');
    let scriptTags = scripts.map(fn => {
        const blob = new Blob([vfs[fn]], {type: 'application/javascript'});
        return `<script type="module" src="${URL.createObjectURL(blob)}"></script>`;
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
    </script>`;

    html = html.replace('<head>', '<head>\n' + hook).replace('</body>', scriptTags + '\n</body>');
    document.getElementById('console-output').innerHTML = ''; 
    document.getElementById('preview-frame').srcdoc = html;
    switchTab('run');
}

// --- Exports ---
function exportForAI() {
    let output = "Project Context\n\n";
    for (const [name, code] of Object.entries(vfs)) {
        output += `\n--- File: ${name} ---\n${code}\n`;
    }
    navigator.clipboard.writeText(output).then(() => flashSaveStatus("Copied for AI!"));
}

async function exportProject() {
    const zip = new JSZip();
    for (const [fn, code] of Object.entries(vfs)) zip.file(fn, code);
    const c = await zip.generateAsync({type: "blob"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(c);
    a.download = "DevOS_Project.zip";
    a.click();
}
