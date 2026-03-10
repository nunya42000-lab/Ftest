// diff.js - Side-by-Side File Comparison Engine with Scrollable Editors

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

    selectA.innerHTML = optionsHTML;
    selectB.innerHTML = optionsHTML;

    // Auto-select different files if available to make comparing faster
    if (selectA.options.length > 0) selectA.selectedIndex = 0;
    if (selectB.options.length > 1) selectB.selectedIndex = 1;
}

/**
 * Executes the comparison and loads it into the CodeMirror MergeView
 */
async function executeDiff() {
    const valA = document.getElementById('diff-file-a').value;
    const valB = document.getElementById('diff-file-b').value;
    const container = document.getElementById('diff-container');
    
    if (!valA || !valB || !container) return;

    const contentA = await getDiffContent(valA);
    const contentB = await getDiffContent(valB);

    // Clear previous diff viewer
    container.innerHTML = '';

    // Inherit the global theme
    const themeName = localStorage.getItem('settings_theme') || 'dracula';
    const cmTheme = themeName === 'light' ? 'default' : themeName;

    // Determine language mode based on filename extensions
    let mode = 'javascript';
    if (valA.includes('.html') || valB.includes('.html')) mode = 'htmlmixed';
    if (valA.includes('.css') || valB.includes('.css')) mode = 'css';

    // Initialize CodeMirror MergeView
    diffEditorInstance = CodeMirror.MergeView(container, {
        value: contentB,       // Modified version goes on the Right
        origLeft: null,        // We only need a 2-way diff, not 3-way
        orig: contentA,        // Original version goes on the Left
        lineNumbers: true,
        mode: mode,
        theme: cmTheme,
        highlightDifferences: true,
        connect: 'align',      // Draws visual connector lines between changed chunks
        collapseIdentical: false, // Keep full files visible for scrolling
        revertButtons: false   // Disable inline reverting to keep it read-only
    });

    // Apply specific scrollable editor sizing and sync logic
    setupScrollableEditors();
}

/**
 * Configures the independent scrolling mechanics and the sync toggle
 */
function setupScrollableEditors() {
    if (!diffEditorInstance || !diffEditorInstance.edit || !diffEditorInstance.right) return;
    
    const editorA = diffEditorInstance.right.orig;
    const editorB = diffEditorInstance.edit;
    const syncScrollCheckbox = document.getElementById('sync-scroll-diff');
    
    // Explicitly allow both editors to scroll vertically
    editorA.setSize("100%", "100%");
    editorB.setSize("100%", "100%");

    // Handle syncing Scroll from A to B
    const handleScrollA = () => {
        if (syncScrollCheckbox && syncScrollCheckbox.checked) {
            const infoA = editorA.getScrollInfo();
            editorB.scrollTo(infoA.left, infoA.top);
        }
    };

    // Handle syncing Scroll from B to A
    const handleScrollB = () => {
        if (syncScrollCheckbox && syncScrollCheckbox.checked) {
            const infoB = editorB.getScrollInfo();
            editorA.scrollTo(infoB.left, infoB.top);
        }
    };

    editorA.on("scroll", handleScrollA);
    editorB.on("scroll", handleScrollB);

    // Refresh layout calculations
    setTimeout(() => {
        editorA.refresh();
        editorB.refresh();
    }, 100);
}

/**
 * Helper to fetch content from VFS or History based on the dropdown value string
 */
async function getDiffContent(valueStr) {
    const parts = valueStr.split('|');
    const type = parts[0];
    const filename = parts[1];

    if (type === 'vfs') {
        return vfs[filename] || '';
    } else if (type === 'hist') {
        const timestamp = parseInt(parts[2]);
        const history = fileHistory[filename] || [];
        const snap = history.find(h => h.timestamp === timestamp);
        return snap ? snap.code : '';
    }
    return '';
}

// Add a quick refresh hook so if you change themes, the diff viewer updates if it's open
const originalChangeTheme = window.changeTheme;
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
