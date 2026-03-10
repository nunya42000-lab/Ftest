// explorer.js - File System, UI Sidebar, ZIP/TXT Import, and Drag & Drop

/**
 * Renders the list of files in the sidebar
 */
function renderFileList() {
    const list = document.getElementById('file-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    Object.keys(vfs).forEach(filename => {
        // Multi-tab active awareness
        const isActive = (typeof activeTab !== 'undefined' ? activeTab === filename : false);
        
        const div = document.createElement('div');
        div.className = `file-item ${isActive ? 'active' : ''}`;
        
        // Inline styles for stability, mapped to CSS vars
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid var(--border)';
        div.style.background = isActive ? 'var(--surface-light)' : 'transparent';
        div.style.borderLeft = isActive ? '3px solid var(--accent)' : '3px solid transparent';
        
        div.innerHTML = `
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size: 13px;" onclick="openTab('${filename}')">📄 ${filename}</span>
            <span style="color:var(--danger); font-size:12px; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="deleteFile('${filename}', event)" title="Delete File">✖</span>
        `;
        list.appendChild(div);
    });

    // Refresh cross-referenced UI elements if they exist
    if (typeof updateProjectStats === 'function') updateProjectStats();
    if (typeof scanDeclarations === 'function') scanDeclarations(); 
}

/**
 * Deletes a file from the VFS and closes its tab if open
 */
async function deleteFile(filename, event) {
    if (event) event.stopPropagation();
    
    if (confirm(`Are you sure you want to permanently delete "${filename}"?`)) {
        delete vfs[filename];
        
        // Handle closing the tab if it's currently open in the multi-tab array
        if (typeof openTabs !== 'undefined' && openTabs.includes(filename)) {
            closeTab(filename);
        }
        
        await localforage.setItem('devos_vfs', vfs);
        renderFileList();
    }
}

// --- ZIP and TXT File Importing Logic ---

/**
 * Triggered by the invisible file input in the sidebar
 */
async function handleFileInput(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        await handleIncomingFiles(files);
        event.target.value = ""; // Reset input so the same file can be selected again if needed
    }
}

/**
 * Core processor for Drag & Drop and File Input
 */
async function handleIncomingFiles(files) {
    let filesAdded = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'zip') {
            // Handle ZIP extraction via JSZip
            try {
                const zip = new JSZip();
                const contents = await zip.loadAsync(file);
                
                for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
                    if (!zipEntry.dir) {
                        // Only extract text-based files to avoid cluttering VFS with binaries
                        const entryExt = relativePath.split('.').pop().toLowerCase();
                        const allowedExts = ['js', 'html', 'css', 'json', 'txt', 'md', 'csv', 'xml', 'svg'];
                        
                        if (allowedExts.includes(entryExt)) {
                            const textContent = await zipEntry.async("text");
                            // Replace slashes with dashes to keep a flat file structure while avoiding overwrites
                            const safeName = relativePath.replace(/\\/g, '-').replace(/\//g, '-');
                            vfs[safeName] = textContent;
                            filesAdded++;
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to read ZIP archive:", err);
                alert(`Error unzipping ${file.name}. Ensure it is a valid ZIP archive.`);
            }
        } else {
            // Handle standard files (TXT, JS, HTML, CSS, etc.)
            try {
                const text = await readFileAsText(file);
                vfs[file.name] = text;
                filesAdded++;
            } catch (err) {
                console.error("Failed to read text file:", err);
            }
        }
    }

    if (filesAdded > 0) {
        await localforage.setItem('devos_vfs', vfs);
        renderFileList();
        alert(`Successfully imported ${filesAdded} file(s) into the Explorer.`);
    }
}

/**
 * Promise wrapper for FileReader
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// --- Drag and Drop Global Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('drop-overlay');
    if (!overlay) return;

    // Show overlay when dragging files into the window
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            overlay.style.display = 'flex';
            overlay.classList.add('dragover');
        }
    });

    // Hide overlay when dragging leaves the window
    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Ensure we only hide if we are leaving the actual window boundaries
        if (e.relatedTarget === null || e.relatedTarget.nodeName === "HTML") {
            overlay.classList.remove('dragover');
            overlay.style.display = 'none';
        }
    });

    // Handle the actual drop event
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.remove('dragover');
        overlay.style.display = 'none';
        
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
