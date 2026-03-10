// search.js - Global Branching Search Implementation

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            executeGlobalSearch(e.target.value);
        });
    }
});

/**
 * Searches across all files in the VFS and builds a branching UI tree
 */
function executeGlobalSearch(query) {
    const resultsContainer = document.getElementById('search-results-tree');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    // Don't process empty queries
    if (!query || !query.trim()) return;

    let totalMatches = 0;

    // Search through the vfs (Virtual File System)
    Object.entries(vfs).forEach(([filename, content]) => {
        if (typeof content !== 'string') return;
        
        const lines = content.split('\n');
        const matches = [];
        
        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
                matches.push({ lineNum: index + 1, text: line.trim() });
            }
        });

        // If the file has matches, build a branching UI element
        if (matches.length > 0) {
            totalMatches += matches.length;
            
            const fileBranch = document.createElement('div');
            fileBranch.style.marginBottom = '12px';
            
            // File Node (Parent)
            fileBranch.innerHTML = `<strong style="color:var(--accent); display:block; margin-bottom:4px;">📁 ${filename} <span style="color:var(--muted); font-size:11px; font-weight:normal;">(${matches.length} matches)</span></strong>`;
            
            // Match Nodes (Leaves)
            const matchContainer = document.createElement('div');
            matchContainer.style.marginLeft = '15px';
            matchContainer.style.borderLeft = '2px solid var(--border)';
            matchContainer.style.paddingLeft = '10px';

            matches.forEach(match => {
                const matchDiv = document.createElement('div');
                matchDiv.style.cursor = 'pointer';
                matchDiv.style.padding = '4px 0';
                matchDiv.style.borderBottom = '1px dashed transparent';
                
                // Highlight the matched query word for better UX
                const regex = new RegExp(`(${escapeHTML(query)})`, 'gi');
                const highlightedText = escapeHTML(match.text).replace(regex, '<span style="background:rgba(210, 153, 34, 0.3); color:var(--warn); border-radius:2px;">$1</span>');
                
                matchDiv.innerHTML = `<span style="color:var(--muted); font-size:11px; display:inline-block; width:45px;">Line ${match.lineNum}:</span> <span>${highlightedText}</span>`;
                
                // Hover effect
                matchDiv.onmouseenter = () => matchDiv.style.borderBottom = '1px dashed var(--border)';
                matchDiv.onmouseleave = () => matchDiv.style.borderBottom = '1px dashed transparent';
                
                // Clickable Action: Switch tab, open file, and jump to line
                matchDiv.onclick = () => {
                    if (typeof switchTab === 'function') {
                        // Pass null for event since it's a programmatic switch
                        switchTab('editor', null); 
                    }
                    
                    if (typeof loadFile === 'function') {
                        loadFile(filename);
                    }
                    
                    // Jump to line in CodeMirror
                    setTimeout(() => {
                        if (typeof cmEditor !== 'undefined' && cmEditor) {
                            cmEditor.setCursor(match.lineNum - 1, 0);
                            
                            // Center the matched line on screen
                            const t = cmEditor.charCoords({line: match.lineNum - 1, ch: 0}, "local").top; 
                            const middleHeight = cmEditor.getScrollerElement().offsetHeight / 2; 
                            cmEditor.scrollTo(null, t - middleHeight - 5);
                            
                            cmEditor.focus();
                        }
                    }, 100);
                };
                matchContainer.appendChild(matchDiv);
            });

            fileBranch.appendChild(matchContainer);
            resultsContainer.appendChild(fileBranch);
        }
    });

    // Display a message if no results were found
    if (totalMatches === 0) {
        resultsContainer.innerHTML = `<div style="color:var(--muted); font-style:italic; padding:10px 0;">No matches found for "${escapeHTML(query)}"</div>`;
    }
}

/**
 * Utility to prevent XSS and safely render code text in the search UI
 */
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
            }
