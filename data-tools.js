/**
 * data-tools.js - Storage Inspection & Data Seeding
 * Manages the sandbox's LocalStorage and IndexedDB states.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initial render is triggered by the Intelligence tab's switch logic
});

/**
 * 1. Storage Inspector
 * Scans LocalStorage to let you view and edit variables live.
 */
function refreshStorageInspector() {
    const container = document.getElementById('storage-inspector-ui');
    if (!container) return;

    container.innerHTML = '';
    
    const keys = Object.keys(localStorage);
    // Filter out IDE-specific keys so we only see the sandbox/project data
    const projectKeys = keys.filter(k => 
        !k.startsWith('devos_') && 
        !k.startsWith('settings_') && 
        k !== 'vault_snippets'
    );

    if (projectKeys.length === 0) {
        container.innerHTML = '<div style="color:var(--muted); font-style:italic; font-size:12px;">No project data found in LocalStorage.</div>';
        return;
    }

    projectKeys.forEach(key => {
        const val = localStorage.getItem(key);
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 5px;
            padding: 10px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            margin-bottom: 8px;
        `;

        row.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:var(--accent); font-size:13px;">${key}</strong>
                <button class="btn-danger" style="padding:2px 6px; font-size:10px;" onclick="deleteStorageKey('${key}')">Delete</button>
            </div>
            <textarea id="storage-val-${key}" style="width:100%; background:var(--panel); color:var(--text); border:1px solid var(--border); border-radius:4px; font-size:11px; padding:5px; height:60px;">${val}</textarea>
            <button class="btn-primary" style="width:100%; font-size:10px;" onclick="updateStorageKey('${key}')">Update Value</button>
        `;
        container.appendChild(row);
    });
}

function updateStorageKey(key) {
    const newVal = document.getElementById(`storage-val-${key}`).value;
    localStorage.setItem(key, newVal);
    triggerHaptic('success');
    alert(`Updated ${key} successfully.`);
    refreshLivePreview(); // Reload sandbox to reflect changes
}

function deleteStorageKey(key) {
    if (confirm(`Delete key "${key}"?`)) {
        localStorage.removeItem(key);
        triggerHaptic('medium');
        refreshStorageInspector();
        refreshLivePreview();
    }
}

/**
 * 2. Data Seeder
 * Injects pre-defined mock data patterns for rapid testing.
 */
function openDataSeeder() {
    const seedName = prompt("Enter a name for this data pattern (e.g., 'simon_high_score', 'pirate_max_bet'):");
    if (!seedName) return;

    const seedData = prompt("Enter the JSON or value to store:");
    if (seedData) {
        localStorage.setItem(seedName, seedData);
        triggerHaptic('success');
        refreshStorageInspector();
        refreshLivePreview();
    }
}

/**
 * 3. Global Storage Wipe
 * Clears only the sandbox data, leaving IDE settings intact.
 */
function clearLiveStorage() {
    const keys = Object.keys(localStorage);
    const projectKeys = keys.filter(k => 
        !k.startsWith('devos_') && 
        !k.startsWith('settings_') && 
        k !== 'vault_snippets'
    );

    if (confirm(`Are you sure you want to wipe ALL project data (${projectKeys.length} keys)? IDE settings will remain.`)) {
        projectKeys.forEach(k => localStorage.removeItem(k));
        triggerHaptic('error');
        refreshStorageInspector();
        refreshLivePreview();
    }
}

/**
 * 4. Export Data to JSON
 * Handy for saving your game states to use later.
 */
function exportStorageToJSON() {
    const data = {};
    const keys = Object.keys(localStorage).filter(k => !k.startsWith('devos_') && k !== 'vault_snippets');
    keys.forEach(k => data[k] = localStorage.getItem(k));

    const blob = new Blob([JSON.stringify(data, null, 4)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_data_export.json';
    a.click();
}
