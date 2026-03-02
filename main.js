// --- Global State ---
let vfs = {}; 
let currentFile = null;
let cmEditor = null;
let snippets = [];
let snapshots = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data
    vfs = (await localforage.getItem('devos_vfs')) || { 'index.html': '<h1>Hello DevOS</h1>', 'main.js': 'console.log("Ready.");' };
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
        indentUnit: 4
    });

    cmEditor.on('change', triggerAutoSave);

    // 3. NATIVE GESTURE: Double-Tap to Vault
    cmEditor.getWrapperElement().addEventListener('dblclick', async (e) => {
        const selectedText = cmEditor.getSelection();
        if (selectedText && selectedText.trim().length > 0) {
            e.preventDefault(); // Stop default zoom
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
        switchFile(Object.keys(vfs)[0]);
    }
    renderFileList();
    renderVault();
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW Registration failed:", err));
    }
});

// --- UI & Navigation ---
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

function toggleMobileToolbar() {
    const tb = document.getElementById('mobile-toolbar');
    const isChecked = document.getElementById('toggle-toolbar').checked;
    tb.style.display = isChecked ? 'flex' : 'none';
    if(cmEditor) setTimeout(() => cmEditor.refresh(), 50);
}

function insertSymbol(sym, isTemplate = false) {
    if(!cmEditor) return;
    const doc = cmEditor.getDoc();
    const cursor = doc.getCursor();
    if(isTemplate) {
        doc.replaceRange('${}', cursor);
        doc.setCursor({line: cursor.line, ch: cursor.ch + 2});
    } else {
        doc.replaceRange(sym, cursor);
        doc.setCursor({line: cursor.line, ch: cursor.ch + 1});
    }
    cmEditor.focus();
}

// --- File System Operations (VFS) ---
async function saveVFS() {
    if (currentFile && cmEditor) {
        vfs[currentFile] = cmEditor.getValue();
    }
    await localforage.setItem('devos_vfs', vfs);
}

let autoSaveTimer;
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
        div.style.padding = '10px 15px';
        div.style.borderBottom = '1px solid var(--border)';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.color = (fn === currentFile) ? 'var(--accent)' : 'var(--text)';
        div.style.backgroundColor = (fn === currentFile) ? 'var(--surface-light)' : 'transparent';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = fn;
        nameSpan.onclick = () => { switchFile(fn); toggleSidebar(); };
        
        const delBtn = document.createElement('button');
        delBtn.innerText = '×';
        delBtn.className = 'btn-danger';
        delBtn.style.padding = '2px 6px';
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Delete ${fn}?`)) {
                delete vfs[fn];
                if (currentFile === fn) currentFile = null;
                await saveVFS();
                renderFileList();
                if (Object.keys(vfs).length > 0) switchFile(Object.keys(vfs)[0]);
                else cmEditor.setValue('');
            }
        };
        
        div.appendChild(nameSpan);
        div.appendChild(delBtn);
        list.appendChild(div);
    });
}
// Replace the existing renderVault in main.js
function renderVault() {
    const viewVault = document.getElementById('view-vault');
    viewVault.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
            <h3 style="margin: 0; color:var(--accent);">Snippet Vault</h3>
            <div style="display:flex; gap:10px;">
                <button class="btn-primary" onclick="createManualSnippet()">+ NEW</button>
                <button class="btn-outline" style="color:var(--success); border-color:var(--success);" onclick="compileSelected()">📦 Compile Checked</button>
            </div>
        </div>
        <div id="snippet-list" style="overflow-y: auto; flex: 1;"></div>
    `;

    const list = document.getElementById('snippet-list');
    snippets.forEach((snip, index) => {
        const div = document.createElement('div');
        div.className = 'help-card';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '8px';
        
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const leftHeader = document.createElement('div');
        leftHeader.style.display = 'flex';
        leftHeader.style.alignItems = 'center';
        leftHeader.style.gap = '10px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'vault-checkbox';
        checkbox.value = index;
        checkbox.style.width = '18px';
        checkbox.style.height = '18px';

        const title = document.createElement('strong');
        title.innerText = snip.name;
        title.style.color = 'var(--text)';
        
        leftHeader.appendChild(checkbox);
        leftHeader.appendChild(title);

        const delBtn = document.createElement('button');
        delBtn.innerText = '🗑️';
        delBtn.className = 'btn-danger';
        delBtn.style.padding = '4px 8px';
        delBtn.onclick = async () => {
            if(confirm("Delete snippet?")) {
                snippets.splice(index, 1);
                await localforage.setItem('vault_snippets', snippets);
                renderVault();
            }
        };
        
        header.appendChild(leftHeader);
        header.appendChild(delBtn);
        
        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.background = 'var(--bg)';
        pre.style.padding = '8px';
        pre.style.borderRadius = '4px';
        pre.style.fontSize = '12px';
        pre.style.maxHeight = '100px';
        pre.style.overflow = 'hidden';
        pre.innerText = snip.code;

        div.appendChild(header);
        div.appendChild(pre);
        list.appendChild(div);
    });
}

// Add this new function to handle the compilation
async function compileSelected() {
    const checkboxes = document.querySelectorAll('.vault-checkbox:checked');
    if (checkboxes.length === 0) return alert("Please check at least one snippet to compile.");

    const selectedSnippets = Array.from(checkboxes).map(cb => snippets[parseInt(cb.value)]);
    
    // Call the compiler engine
    const result = compileSnippets(selectedSnippets);

    if (!result.success) {
        return alert(result.error);
    }

    // Save the compiled result as a new working file
    const timestamp = new Date().toISOString().slice(11,19).replace(/:/g, '-');
    const newFileName = `compiled_${timestamp}.js`;
    
    vfs[newFileName] = result.code;
    await saveVFS();
    renderFileList();
    switchFile(newFileName);
    switchTab('editor');
    
    alert(`Successfully compiled ${selectedSnippets.length} snippets in correct dependency order!`);
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

async function createNewFile() {
    const name = prompt("Enter file name (e.g., app.js, style.css):");
    if (name && !vfs[name]) {
        vfs[name] = '';
        await saveVFS();
        renderFileList();
        switchFile(name);
        toggleSidebar();
    }
}

async function renameCurrentFile() {
    if (!currentFile) return;
    const newName = prompt("Rename file to:", currentFile);
    if (newName && newName !== currentFile && !vfs[newName]) {
        vfs[newName] = vfs[currentFile];
        delete vfs[currentFile];
        currentFile = newName;
        await saveVFS();
        renderFileList();
        document.getElementById('current-file-label').innerText = currentFile;
    }
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
}

async function clearAllFiles() {
    if(confirm("DANGER: This will delete all files in the workspace. Are you sure?")) {
        vfs = {};
        currentFile = null;
        cmEditor.setValue('');
        await saveVFS();
        renderFileList();
        document.getElementById('current-file-label').innerText = "Select a file";
    }
}

// --- Snippet Vault ---
async function copyToVault() {
    if (!cmEditor) return;
    const selectedText = cmEditor.getSelection();
    if (!selectedText || selectedText.trim() === '') return alert("Highlight code first.");
    const name = prompt("Save snippet to Vault as:", "Snippet " + (snippets.length + 1));
    if (name) {
        snippets.push({ name: name, code: selectedText });
        await localforage.setItem('vault_snippets', snippets);
        renderVault();
        flashSaveStatus("Saved to Vault!");
    }
}

async function createManualSnippet() {
    const name = prompt("Snippet Name:");
    if(name) {
        snippets.push({ name: name, code: "// New snippet" });
        await localforage.setItem('vault_snippets', snippets);
        renderVault();
    }
}




// --- Sandbox & Execution ---
const consoleInterceptorScript = `
<script>
    const ogLog = console.log;
    const ogErr = console.error;
    const out = window.parent.document.getElementById('console-output');
    function logMsg(msg, isErr=false) {
        if(!out) return;
        const d = document.createElement('div');
        d.className = isErr ? 'log-error' : 'log-msg';
        d.innerText = '> ' + (typeof msg === 'object' ? JSON.stringify(msg) : msg);
        out.appendChild(d);
        out.scrollTop = out.scrollHeight;
    }
    console.log = function(...args) { logMsg(args.join(' ')); ogLog.apply(console, args); };
    console.error = function(...args) { logMsg(args.join(' '), true); ogErr.apply(console, args); };
    window.onerror = function(msg, url, line) { logMsg(msg + ' (Line: ' + line + ')', true); return false; };
</script>
`;

function runPreview() {
    if (currentFile) vfs[currentFile] = cmEditor.getValue();
    let html = vfs['index.html'] || '<h1>No index.html found</h1>';

    const scripts = Object.keys(vfs).filter(fn => fn.endsWith('.js') && fn !== 'sw.js');
    let scriptTags = scripts.map(fn => {
        const blob = new Blob([vfs[fn]], {type: 'application/javascript'});
        return `<script type="module" src="${URL.createObjectURL(blob)}"></script>`;
    }).join('\n');

    if(html.includes('<head>')) {
        html = html.replace('<head>', '<head>\n' + consoleInterceptorScript);
    } else {
        html = consoleInterceptorScript + html;
    }
    html = html.replace('</body>', scriptTags + '\n</body>');

    document.getElementById('console-output').innerHTML = ''; 
    document.getElementById('preview-frame').srcdoc = html;
    switchTab('run');
}

function stopPreview() {
    document.getElementById('preview-frame').srcdoc = '';
    document.getElementById('console-output').innerHTML = '<div class="log-msg">Preview stopped.</div>';
}

// --- Exports ---
async function exportProject() {
    const zip = new JSZip();
    for (const [fn, code] of Object.entries(vfs)) zip.file(fn, code);
    const c = await zip.generateAsync({type: "blob"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(c);
    a.download = "DevOS_Project.zip";
    a.click();
}

function exportForAI() {
    let output = "Project Context\n\n";
    for (const [name, code] of Object.entries(vfs)) {
        output += `\n--- File: ${name} ---\n${code}\n`;
    }
    navigator.clipboard.writeText(output).then(() => alert("Project copied to clipboard for AI!"));
}
