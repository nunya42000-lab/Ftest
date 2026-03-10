// diff.js - Side-by-Side File Comparison Engine

let diffEditorInstance = null;

/**
 * Hook called by main.js when the 'Compare' tab is opened.
 * Populates the dropdowns with current files and historical snapshots.
 */
function initDiffViewer() {
    populateDiffDropdowns();
}

/**
 * Builds the options for the select dropdowns
 */
function populateDiffDropdowns() {
    const selectA = document.getElementById('diff-file-a');
    const selectB = document.getElementById('diff-file-b');
    
    if (!selectA || !selectB) return;

    let optionsHTML = '';
    
    // Iterate through all files in the VFS
    Object.keys(vfs).forEach(filename => {
        // 1. Add the live, current version of the file
        optionsHTML += `<option value="vfs|${filename}">📄 ${filename} (Live Current Version)</option>`;
        
        // 2. Add historical snapshots if the Time Machine (history.js) has them
        if (typeof fileHistory !== 'undefined' && fileHistory[filename]) {
            // Reverse so newest snapshots are at the top
            const snapshots = [...fileHistory[filename]].reverse();
            snapshots.forEach(snap => {
                const date = new Date(snap.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString();
                optionsHTML += `<option value="hist|${filename}|${snap.timestamp}">🕒 ${filename} (Snapshot: ${dateStr} @ ${timeStr})</option>`;
            });
        }
    });

    if (!optionsHTML) {
        optionsHTML = `<option value="">No files available</option>`;
    }

    // Preserve selections if possible, otherwise apply new HTML
    const prevA = selectA.value;
    const prevB = selectB.value;
    
    selectA.innerHTML = optionsHTML;
    selectB.innerHTML = optionsHTML;
    
    if (prevA && selectA.querySelector(`option[value="${prevA}"]`)) selectA.value = prevA;
    if (prevB && selectB.querySelector(`option[value="${prevB}"]`)) selectB.value = prevB;
}

/**
 * Helper to fetch the actual string content based on the dropdown selection value
 */
function getDiffContent(valueString) {
    if (!valueString) return '';
    
    const parts = valueString.split('|');
    const type = parts[0];     // 'vfs' or 'hist'
    const filename = parts[1];
    
    if (type === 'vfs') {
        return typeof vfs[filename] === 'string' ? vfs[filename] : '';
    } else if (type === 'hist') {
        const timestamp = parseInt(parts[2]);
        if (typeof fileHistory !== 'undefined' && fileHistory[filename]) {
            const snap = fileHistory[filename].find(s => s.timestamp === timestamp);
            return snap ? snap.code : '';
        }
    }
    return '';
}

/**
 * Executes the diff and renders the CodeMirror MergeView
 */
function executeDiff() {
    if (typeof diff_match_patch === 'undefined') {
        alert("The diff_match_patch library failed to load. Please check your internet connection.");
        return;
    }

    const valA = document.getElementById('diff-file-a').value;
    const valB = document.getElementById('diff-file-b').value;
    
    if (!valA || !valB) {
        alert("Please select two files to compare.");
        return;
    }

    const contentA = getDiffContent(valA); // Original (Left)
    const contentB = getDiffContent(valB); // Modified (Right)
    
    const container = document.getElementById('diff-container');
    container.innerHTML = ''; // Clear the previous viewer or placeholder text
    
    // Determine the current theme so the diff viewer matches the IDE
    const currentTheme = localStorage.getItem('settings_theme') || 'dracula';
    const cmTheme = currentTheme === 'light' ? 'default' : currentTheme;

    // Determine syntax highlighting mode naively based on file extension
    const filename = valA.split('|')[1] || '';
    const ext = filename.split('.').pop().toLowerCase();
    let mode = 'javascript';
    if (ext === 'html') mode = 'htmlmixed';
    if (ext === 'css') mode = 'css';
    if (ext === 'json') mode = 'application/json';

    // Initialize the CodeMirror Merge addon
    diffEditorInstance = CodeMirror.MergeView(container, {
        value: contentB,       // Modified version goes on the Right
        origLeft: null,        // We only need a 2-way diff, not 3-way
        orig: contentA,        // Original version goes on the Left
        lineNumbers: true,
        mode: mode,
        theme: cmTheme,
        highlightDifferences: true,
        connect: 'align',      // Draws visual connector lines between changed chunks
        collapseIdentical: false, // Set to true if you want to hide unchanged code blocks
        revertButtons: false   // Disable inline reverting to keep it read-only
    });

    // Make sure it stretches to fill the container properly
    setTimeout(() => {
        if (diffEditorInstance && diffEditorInstance.edit) {
            diffEditorInstance.edit.refresh();
            diffEditorInstance.right.orig.refresh();
        }
    }, 100);
}

// Add a quick refresh hook so if you change themes, the diff viewer updates if it's open
const originalChangeTheme = changeTheme;
if (typeof originalChangeTheme === 'function') {
    window.changeTheme = function(themeName) {
        originalChangeTheme(themeName);
        const cmTheme = themeName === 'light' ? 'default' : themeName;
        if (diffEditorInstance) {
            if (diffEditorInstance.edit) diffEditorInstance.edit.setOption('theme', cmTheme);
            if (diffEditorInstance.right && diffEditorInstance.right.orig) diffEditorInstance.right.orig.setOption('theme', cmTheme);
        }
    };
}
