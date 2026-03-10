// explorer.js - File System, UI Sidebar, and Drag & Drop

/**
 * Renders the list of files in the sidebar
 */
function renderFileList() {
    const list = document.getElementById('file-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    Object.keys(vfs).forEach(filename => {
        const div = document.createElement('div');
        // If main.js has multi-tab activeFile logic, we use it, otherwise fallback to currentFile
        const isActive = (typeof activeTab !== 'undefined' ? activeTab === filename : currentFile === filename);
        
        div.className = `file-item ${isActive ? 'active' : ''}`;
        
        div.innerHTML = `
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="loadFile('${filename}')">📄 ${filename}</span>
            <span style="color:var(--danger); font-size:12px; padding:4px 8px; border-radius:4px;" onclick="deleteFile('${filename}', event)">✖</span>
        `;
        list.appendChild(div);
    });

    if (typeof updateProjectStats === 'function') {
        updateProjectStats(); 
    }
}

/**
 * Loads a file into the Editor (Now routes through Multi-Tab system if available)
 */
function loadFile(filename) {
    if (!vfs[filename]) return;
    
    // NEW: If the multi-tab system is loaded in main.js, route through it
    if (typeof openTab === 'function') {
        openTab(filename);
    } else {
        // Fallback for standalone loading
        currentFile = filename;
        document.getElementById('current-file-label').innerText = filename;
        if (cmEditor) cmEditor.setValue(vfs[filename]);
        renderFileList();
    }
    
    // Auto-close sidebar on mobile/portrait after selecting a file
    const sidebar = document.getElementById('ui-sidebar');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
        toggleSidebar();
    }
}

/**
 * Prompts the user to create a new file
 */
function createNewFile() {
    const name = prompt("Enter new file name (e.g., script.js, style.css):");
    if (name && !vfs[name]) { 
        vfs[name] = ""; 
        renderFileList(); 
        loadFile(name); 
        if (typeof saveVFS === 'function') saveVFS();
    }
}

/**
 * Deletes a file from the Virtual File System
 */
function deleteFile(filename, event) {
    if (event) event.stopPropagation();
    
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
        if (typeof pushToTrash === 'function') {
            pushToTrash(filename, vfs[filename]);
        }
        
        delete vfs[filename];
        
        // NEW: Handle tab closing if the multi-tab system is active
        if (typeof closeTab === 'function') {
            closeTab(filename, true);
        } else if (currentFile === filename) {
            currentFile = null;
            document.getElementById('current-file-label').innerText = 'no file selected';
            if (cmEditor) cmEditor.setValue('');
        }
        
        renderFileList();
        if (typeof saveVFS === 'function') saveVFS();
    }
}

/**
 * Clears the editor view and closes all open tabs
 */
function closeAllFiles() {
    if (typeof closeAllTabs === 'function') {
        closeAllTabs();
    } else {
        currentFile = null;
        document.getElementById('current-file-label').innerText = 'no file selected';
        if (cmEditor) cmEditor.setValue('');
    }
    renderFileList();
}

function toggleSidebar() {
    const sidebar = document.getElementById('ui-sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

async function exportProjectZip() {
    if (typeof JSZip === 'undefined') {
        alert("JSZip library is not loaded.");
        return;
    }
    
    const zip = new JSZip();
    Object.entries(vfs).forEach(([name, content]) => {
        zip.file(name, content);
    });
    
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "DevOS_Project.zip";
    a.click();
    URL.revokeObjectURL(url);
}

// --- Import Logic (Manual & Drag/Drop) ---

function loadFiles(event) {
    handleIncomingFiles(event.target.files);
}

function handleIncomingFiles(files) {
    if (!files || !files.length) return;

    let filesRead = 0;
    for (let file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            vfs[file.name] = e.target.result;
            filesRead++;
            
            if (filesRead === files.length) {
                renderFileList();
                if (typeof saveVFS === 'function') saveVFS();
            }
        };
        reader.readAsText(file);
    }
}

// --- NEW: Drag and Drop Global Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('drop-overlay');
    if (!overlay) return;

    // Show overlay when dragging files into the window
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            overlay.classList.add('dragover');
        }
    });

    // Hide overlay when dragging leaves the window
    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Ensure we only hide if we are leaving the actual window, not child elements
        if (e.relatedTarget === null || e.relatedTarget.nodeName === "HTML") {
            overlay.classList.remove('dragover');
        }
    });

    // Handle the actual drop event
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.remove('dragover');
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleIncomingFiles(e.dataTransfer.files);
            
            // Auto-switch to Explorer tab to show the new files if on mobile
            const sidebar = document.getElementById('ui-sidebar');
            if (window.innerWidth <= 768 && sidebar && !sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        }
    });
});
