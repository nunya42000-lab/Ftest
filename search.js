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
            const fileHeader = document.createElement('div');
            fileHeader.style.fontWeight = 'bold';
            fileHeader.style.color = 'var(--accent)';
            fileHeader.style.paddingBottom = '4px';
            fileHeader.style.borderBottom = '1px solid var(--border)';
            fileHeader.style.cursor = 'pointer';
            fileHeader.innerHTML = `📄 ${filename} <span style="color:var(--muted); font-size:11px;">(${matches.length})</span>`;
            
            // Allow clicking the header to just open the file
            fileHeader.onclick = () => {
                if (typeof openTab === 'function') openTab(filename);
            };
            fileBranch.appendChild(fileHeader);
            
            const matchContainer = document.createElement('div');
            matchContainer.style.paddingLeft = '10px';
            matchContainer.style.marginTop = '4px';
            matchContainer.style.borderLeft = '2px solid var(--border)';
            
            // Match Nodes (Children)
            matches.forEach(match => {
                const matchDiv = document.createElement('div');
                matchDiv.style.padding = '4px';
                matchDiv.style.fontSize = '12px';
                matchDiv.style.color = 'var(--text)';
                matchDiv.style.cursor = 'pointer';
                matchDiv.style.whiteSpace = 'nowrap';
                matchDiv.style.overflow = 'hidden';
                matchDiv.style.textOverflow = 'ellipsis';
                
                matchDiv.innerHTML = `<span style="color:var(--warn); margin-right:6px;">Line ${match.lineNum}:</span> ${escapeHTML(match.text)}`;
                
                // Click a match to open file and jump to line
                matchDiv.onclick = () => {
                    // Open the file tab via multi-tab manager
                    if (typeof openTab === 'function') openTab(filename);
                    
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
