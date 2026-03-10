/**
 * git-lite.js - Local Branching & Project Snapshots
 * Allows safe experimentation by saving the entire VFS state.
 */

let currentBranch = 'main';
let projectBranches = {};

document.addEventListener('DOMContentLoaded', async () => {
    // Load branches from storage
    const savedBranches = await localforage.getItem('devos_branches');
    projectBranches = savedBranches || { 'main': { ...vfs } };
    
    const savedCurrent = await localforage.getItem('devos_current_branch');
    currentBranch = savedCurrent || 'main';

    renderBranchList();
});

/**
 * Creates a new branch by cloning the current VFS state.
 */
async function createNewBranch() {
    const branchName = prompt("Enter new branch name (e.g., 'experimental-ui', 'logic-fix'):");
    if (!branchName) return;

    const formattedName = branchName.toLowerCase().replace(/\s+/g, '-');

    if (projectBranches[formattedName]) {
        alert("A branch with that name already exists.");
        return;
    }

    // Save current state to the current branch before switching
    projectBranches[currentBranch] = { ...vfs };
    
    // Create the new branch as a clone of current VFS
    projectBranches[formattedName] = { ...vfs };
    
    currentBranch = formattedName;
    
    await saveBranchData();
    triggerHaptic('success');
    renderBranchList();
    alert(`Switched to new branch: ${currentBranch}`);
}

/**
 * Switches the VFS to a different branch.
 */
async function switchBranch(name) {
    if (name === currentBranch) return;

    if (confirm(`Switch to branch "${name}"? Current unsaved changes in "${currentBranch}" will be stashed.`)) {
        // 1. Stash current VFS into the current branch
        projectBranches[currentBranch] = { ...vfs };

        // 2. Update current branch pointer
        currentBranch = name;

        // 3. Load the new branch's VFS into the live environment
        vfs = { ...projectBranches[name] };

        await saveBranchData();
        await localforage.setItem('devos_vfs', vfs);

        // 4. Update UI
        triggerHaptic('medium');
        renderBranchList();
        renderFileList();
        
        // Reset tabs to avoid confusion across branches
        openTabs = [];
        activeTab = null;
        if (cmEditor) cmEditor.setValue('');
        renderTabs();

        alert(`Switched to: ${currentBranch}`);
    }
}

/**
 * Deletes a branch.
 */
async function deleteBranch(name, event) {
    if (event) event.stopPropagation();
    if (name === 'main') {
        alert("Cannot delete the 'main' branch.");
        return;
    }

    if (confirm(`Permanently delete branch "${name}"? This cannot be undone.`)) {
        delete projectBranches[name];
        if (currentBranch === name) currentBranch = 'main';
        
        await saveBranchData();
        renderBranchList();
        triggerHaptic('error');
    }
}

/**
 * UI Rendering for the Sidebar Accordion
 */
function renderBranchList() {
    const list = document.getElementById('branch-list');
    if (!list) return;

    list.innerHTML = '';

    Object.keys(projectBranches).forEach(name => {
        const isActive = name === currentBranch;
        const div = document.createElement('div');
        div.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 10px;
            margin-bottom: 5px;
            background: ${isActive ? 'var(--surface-light)' : 'transparent'};
            border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
            border-radius: 6px;
            cursor: pointer;
        `;

        div.onclick = () => switchBranch(name);

        div.innerHTML = `
            <span style="color:${isActive ? 'var(--accent)' : 'var(--text)'}; font-weight:${isActive ? 'bold' : 'normal'};">
                ${isActive ? '● ' : '○ '}${name}
            </span>
            ${name !== 'main' ? `<span onclick="deleteBranch('${name}', event)" style="color:var(--danger); font-size:10px; padding:2px 5px;">✖</span>` : ''}
        `;
        list.appendChild(div);
    });
}

async function saveBranchData() {
    await localforage.setItem('devos_branches', projectBranches);
    await localforage.setItem('devos_current_branch', currentBranch);
}
