// intelligence.js - Smart Features and Dependency Tracking

/**
 * Generates a smart dependency tree by analyzing all JS files in the VFS.
 */
function generateDependencyTree() {
    const files = Object.keys(vfs).filter(f => f.endsWith('.js'));
    window.dependencyMap = {}; // Attached to window so other modules can read it
    

    // Ensure the vault-compiler's analysis function is available
    if (typeof analyzeSnippetDependencies !== 'function') {
        const tracker = document.getElementById('dep-tracker-ui');
        if (tracker) {
            tracker.innerHTML = `<div style="color:var(--danger); padding:10px;">Error: vault-compiler.js is missing or not loaded. Cannot analyze dependencies.</div>`;
        }
        return;
    }

    // 1. Analyze dependencies across all JS files
    files.forEach(file => {
        const analysis = analyzeSnippetDependencies(vfs[file]);
        dependencyMap[file] = {
            // Convert Sets to Arrays for easier iteration
            provides: Array.from(analysis.provides || []),
            requires: Array.from(analysis.requires || []),
            dependsOnFiles: []
        };
    });

    // 2. Cross-reference "requires" with "provides" to build the file-to-file links
    Object.keys(dependencyMap).forEach(file => {
        dependencyMap[file].requires.forEach(req => {
            Object.keys(dependencyMap).forEach(targetFile => {
                if (file !== targetFile && dependencyMap[targetFile].provides.includes(req)) {
                    if (!dependencyMap[file].dependsOnFiles.includes(targetFile)) {
                        dependencyMap[file].dependsOnFiles.push(targetFile);
                    }
                }
            });
        });
    });

    // 3. Render the results to the UI
    renderDependencyTree(dependencyMap);
}

/**
 * Renders the dependency map into the Intelligence tab UI.
 */
function renderDependencyTree(map) {
    let html = `<div style="padding:15px; background:var(--surface-light); border-radius:8px; border:1px solid var(--border); margin-bottom:15px;">`;
    html += `<h4 style="margin-top:0; color:var(--accent); font-size:13px;">Smart Dependency Tracker</h4>`;
    
    const files = Object.keys(map);
    if (files.length === 0) {
        html += `<div style="color:var(--muted); font-size:12px;">No JavaScript files found to analyze. Create some .js files to see the dependency graph.</div>`;
    }
    
    files.forEach(file => {
        const deps = map[file].dependsOnFiles;
        html += `<div style="margin-bottom: 12px; font-size:13px;">`;
        html += `<strong>📄 ${file}</strong>`;
        
        // Render Dependencies
        if (deps.length > 0) {
            html += `<div style="margin-left: 20px; color: var(--warn); font-size:12px;">↳ Imports from: ${deps.join(', ')}</div>`;
        } else {
            html += `<div style="margin-left: 20px; color: var(--success); font-size:12px;">↳ No internal file dependencies</div>`;
        }
        
        // Smart Feature: Warn about potentially unused exports/definitions
        if (map[file].provides.length > 0) {
            const unused = map[file].provides.filter(p => !isUsedAnywhere(p, map, file));
            if (unused.length > 0) {
                const displayUnused = unused.slice(0, 3).join(', ') + (unused.length > 3 ? '...' : '');
                html += `<div style="margin-left: 20px; color: var(--muted); font-size:11px;">💡 Tip: Unused definitions (${displayUnused})</div>`;
            }
        }
        
        html += `</div>`;
    });
    
    html += `</div>`;
    
    // Inject into the DOM
    const tracker = document.getElementById('dep-tracker-ui');
    if (tracker) {
        tracker.innerHTML = html;
    }
}

/**
 * Helper to check if a specific definition is used in any other file
 */
function isUsedAnywhere(definition, map, currentFile) {
    let used = false;
    Object.keys(map).forEach(f => {
        if (f !== currentFile && map[f].requires.includes(definition)) {
            used = true;
        }
    });
    return used;
}

/**
 * Hook to be called when switching to the Tools/Intelligence tab or when files change
 */
function updateProjectStats() {
    // Generate the tree immediately when called
    generateDependencyTree();
    
    // You can add more general project health stats here in the future
    const statsContainer = document.getElementById('project-stats-container');
    if (statsContainer) {
        const fileCount = Object.keys(vfs).length;
        const totalLines = Object.values(vfs).reduce((acc, content) => acc + (typeof content === 'string' ? content.split('\\n').length : 0), 0);
        
        statsContainer.innerHTML = `
            <div style="display:flex; gap:10px; margin-bottom:15px; font-size:12px;">
                <span style="background:var(--surface-light); padding:5px 10px; border-radius:4px; border:1px solid var(--border);">Files: <strong style="color:var(--accent)">${fileCount}</strong></span>
                <span style="background:var(--surface-light); padding:5px 10px; border-radius:4px; border:1px solid var(--border);">Total Lines: <strong style="color:var(--accent)">${totalLines}</strong></span>
            </div>
        `;
    }
                        }
  
