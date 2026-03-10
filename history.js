// history.js - Time Machine (Local Version History)

let fileHistory = {};
const MAX_HISTORY_PER_FILE = 15;

// Load history on boot
document.addEventListener('DOMContentLoaded', async () => {
    fileHistory = (await localforage.getItem('devos_history')) || {};
});

/**
 * Takes a snapshot of a file's code before it changes.
 * Called automatically by saveVFS() in main.js
 */
async function takeSnapshot(filename, code) {
    if (!fileHistory[filename]) {
        fileHistory[filename] = [];
    }

    // Avoid duplicate consecutive snapshots if the code hasn't actually changed
    const historyLen = fileHistory[filename].length;
    if (historyLen > 0 && fileHistory[filename][historyLen - 1].code === code) {
        return;
    }

    const snapshot = {
        timestamp: Date.now(),
        code: code
    };

    fileHistory[filename].push(snapshot);

    // Enforce the history limit to prevent LocalStorage bloat
    if (fileHistory[filename].length > MAX_HISTORY_PER_FILE) {
        fileHistory[filename].shift(); // Remove the oldest snapshot
    }

    await localforage.setItem('devos_history', fileHistory);
    renderHistory();
}

/**
 * Renders the Time Machine UI in the Settings tab
 */
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    container.innerHTML = '';

    // Determine which file is currently open
    const currentFileName = typeof activeTab !== 'undefined' ? activeTab : (typeof currentFile !== 'undefined' ? currentFile : null);

    if (!currentFileName || !fileHistory[currentFileName] || fileHistory[currentFileName].length === 0) {
        container.innerHTML = `<div style="color:var(--muted); font-size:11px; text-align:center; padding: 10px;">No history available for the active file.</div>`;
        return;
    }

    // Header indicating which file we are looking at
    container.innerHTML = `<div style="font-size:12px; font-weight:bold; margin-bottom:5px; padding-bottom:5px; border-bottom:1px solid var(--border); color:var(--accent);">Active File: ${currentFileName}</div>`;

    // Render from newest to oldest
    const snapshots = [...fileHistory[currentFileName]].reverse();

    snapshots.forEach((snap) => {
        const date = new Date(snap.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = date.toLocaleDateString();

        const div = document.createElement('div');
        div.style = "display:flex; justify-content:space-between; align-items:center; padding:8px 6px; border-bottom:1px solid var(--border);";
        
        div.innerHTML = `
            <div style="font-size:11px; color:var(--text);">
                <div style="font-weight:bold;">${timeStr}</div>
                <div style="color:var(--muted); font-size:10px;">${dateStr}</div>
            </div>
            <div>
                <button class="btn-outline" style="padding:4px 8px; font-size:10px; margin-right:4px;" onclick="viewSnapshot('${currentFileName}', ${snap.timestamp})">PEEK</button>
                <button class="btn-warn" style="padding:4px 8px; font-size:10px;" onclick="restoreSnapshot('${currentFileName}', ${snap.timestamp})">RESTORE</button>
            </div>
        `;
        container.appendChild(div);
    });
}

/**
 * Peeks at a snapshot by logging it to the Intelligence diagnostic view
 */
function viewSnapshot(filename, timestamp) {
    const snap = fileHistory[filename].find(s => s.timestamp === timestamp);
    if (snap && typeof logDiag === 'function') {
        const timeStr = new Date(timestamp).toLocaleTimeString();
        logDiag(`--- PEEK: ${filename} @ ${timeStr} ---\n\n${snap.code}`, "info");
        switchTab('tools'); // Jump to the Intelligence tab so you can read it
    }
}

/**
 * Restores a specific snapshot to the VFS and the editor
 */
async function restoreSnapshot(filename, timestamp) {
    const snap = fileHistory[filename].find(s => s.timestamp === timestamp);
    if (!snap) return;

    if (confirm(`Restore ${filename} to the version from ${new Date(timestamp).toLocaleTimeString()}? \n\nCurrent unsaved changes will be lost.`)) {
        
        // Take a safety snapshot of the CURRENT state before overwriting
        const currentFileName = typeof activeTab !== 'undefined' ? activeTab : (typeof currentFile !== 'undefined' ? currentFile : null);
        if (currentFileName === filename && typeof cmEditor !== 'undefined') {
           await takeSnapshot(filename, cmEditor.getValue());
        }

        // Apply the restored code
        vfs[filename] = snap.code;
        
        // Update the editor view if the restored file is currently open
        if (currentFileName === filename && typeof cmEditor !== 'undefined') {
            cmEditor.setValue(snap.code);
        }

        // Save everything
        if (typeof saveVFS === 'function') await saveVFS();
        if (typeof renderFileList === 'function') renderFileList();
        
        if (typeof logDiag === 'function') {
            logDiag(`Successfully restored ${filename} to ${new Date(timestamp).toLocaleTimeString()}`, "success");
        }
        
        // Jump back to the editor to see the changes
        if (typeof switchTab === 'function') {
            switchTab('editor');
        }
    }
}

// Clever listener to automatically refresh the Time Machine UI whenever you click a file tab or sidebar item
document.addEventListener('click', (e) => {
    if (e.target.closest('.file-tab') || e.target.closest('.file-item')) {
        setTimeout(renderHistory, 100);
    }
});
      
