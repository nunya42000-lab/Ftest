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
 * Renders the Time Machine UI in the Time tab
 */
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    container.innerHTML = '';

    // Determine which file is currently active using the multi-tab state
    const currentFileName = typeof activeTab !== 'undefined' ? activeTab : null;

    if (!currentFileName || !fileHistory[currentFileName] || fileHistory[currentFileName].length === 0) {
        container.innerHTML = `<div style="color:var(--muted); font-style:italic; padding: 10px;">No history available for the currently active tab.</div>`;
        return;
    }

    // Reverse to show newest snapshots first
    const snapshots = [...fileHistory[currentFileName]].reverse();

    snapshots.forEach(snap => {
        const date = new Date(snap.timestamp);
        
        const div = document.createElement('div');
        div.style.padding = "10px";
        div.style.marginBottom = "8px";
        div.style.background = "var(--surface-light)";
        div.style.border = "1px solid var(--border)";
        div.style.borderRadius = "6px";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        
        div.innerHTML = `
            <div>
                <div style="font-weight:bold; color:var(--text); font-size:13px;">${date.toLocaleDateString()}</div>
                <div style="color:var(--muted); font-size:11px;">${date.toLocaleTimeString()}</div>
            </div>
            <button class="btn-warn" style="padding:4px 8px;" onclick="restoreSnapshot('${currentFileName}', ${snap.timestamp})">Restore</button>
        `;
        container.appendChild(div);
    });
}

/**
 * Reverts the VFS code to a specific snapshot
 */
async function restoreSnapshot(filename, timestamp) {
    const snap = fileHistory[filename].find(s => s.timestamp === timestamp);
    if (!snap) return;

    if (confirm(`Revert ${filename} to ${new Date(timestamp).toLocaleTimeString()}?\n\nCurrent unsaved changes will be lost.`)) {
        
        // Take a safety snapshot of the CURRENT state before overwriting
        const currentFileName = typeof activeTab !== 'undefined' ? activeTab : null;
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
        
        // Jump back to the editor to see the changes
        if (typeof switchTab === 'function') switchTab('editor');
    }
}

// Automatically refresh the Time Machine UI whenever you click a file tab or sidebar item
document.addEventListener('click', (e) => {
    if (e.target.closest('.file-tab') || e.target.closest('.file-item')) {
        setTimeout(renderHistory, 100);
    }
});
