// explorer.js - File System and UI Sidebar Management

/**
 * Renders the list of files in the sidebar
 */
function renderFileList() {
    const list = document.getElementById('file-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    Object.keys(vfs).forEach(filename => {
        const div = document.createElement('div');
        div.className = `file-item ${currentFile === filename ? 'active' : ''}`;
        
        // Include inline styles or classes for the delete button
        div.innerHTML = `
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="loadFile('${filename}')">📄 ${filename}</span>
            <span style="color:var(--danger); font-size:12px; padding:4px 8px; border-radius:4px;" onclick="deleteFile('${filename}', event)">✖</span>
        `;
        list.appendChild(div);
    });

    // Update project stats if the intelligence module is loaded
    if (typeof updateProjectStats === 'function') {
        updateProjectStats(); 
    }
}

/**
 * Loads a file into the CodeMirror editor
 */
function loadFile(filename) {
    if (!vfs[filename]) return;
    
    currentFile = filename;
    document.getElementById('current-file-label').innerText = filename;
    
    if (cmEditor) {
        cmEditor.setValue(vfs[filename]);
    }
    
    renderFileList();
    
    // Auto-close sidebar on mobile/portrait after selecting a file for better UX
    const sidebar = document.getElementById('ui-sidebar');
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
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
    if (event) event.stopPropagation(); // Prevent triggering loadFile
    
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
        // Push to trash if the main.js logic supports it
        if (typeof pushToTrash === 'function') {
            pushToTrash(filename, vfs[filename]);
        }
        
        delete vfs[filename];
        
        // Clear editor if the deleted file was currently open
        if (currentFile === filename) {
            currentFile = null;
            document.getElementById('current-file-label').innerText = 'no file selected';
            if (cmEditor) cmEditor.setValue('');
        }
        
        renderFileList();
        if (typeof saveVFS === 'function') saveVFS();
    }
}

/**
 * Clears the editor view
 */
function closeAllFiles() {
    currentFile = null;
    document.getElementById('current-file-label').innerText = 'no file selected';
    if (cmEditor) cmEditor.setValue('');
    renderFileList();
}

/**
 * Toggles the sidebar visibility (used heavily in portrait mode)
 */
function toggleSidebar() {
    const sidebar = document.getElementById('ui-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

/**
 * Exports the entire VFS as a ZIP file
 */
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

/**
 * Imports files from the user's local device into the VFS
 */
function loadFiles(event) {
    const files = event.target.files;
    if (!files.length) return;

    let filesRead = 0;
    for (let file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            vfs[file.name] = e.target.result;
            filesRead++;
            
            // Re-render and save once all files are loaded
            if (filesRead === files.length) {
                renderFileList();
                if (typeof saveVFS === 'function') saveVFS();
            }
        };
        reader.readAsText(file);
    }
}
