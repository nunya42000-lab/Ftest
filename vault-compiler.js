// vault-compiler.js - Optimized Dependency Engine

/**
 * Scans JavaScript code to identify provided definitions and required dependencies.
 * This is the core engine used by both the Compiler and intelligence.js.
 */
function analyzeSnippetDependencies(code) {
    const provides = new Set();
    const requires = new Set();
    
    if (typeof code !== 'string') return { provides, requires };

    // 1. Identify "Provides" (Definitions)
    const fnMatches = code.matchAll(/function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/g);
    for (const match of fnMatches) provides.add(match[1]);

    const varMatches = code.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*(?:=|;)/g);
    for (const match of varMatches) provides.add(match[1]);

    const classMatches = code.matchAll(/class\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*(?:extends|{)/g);
    for (const match of classMatches) provides.add(match[1]);

    // 2. Identify "Requires" (Usage)
    const wordMatches = code.matchAll(/\b([a-zA-Z_$][0-9a-zA-Z_$]*)\b/g);
    
    // Comprehensive ignore list to prevent false positives on native JS features
    const ignoreList = new Set([
        'const','let','var','function','class','if','else','for','while','return',
        'true','false','null','undefined','new','this','console','window','document',
        'await','async','Math','Object','Array','String','Number','Promise','setTimeout',
        'setInterval','addEventListener','fetch','JSON','localStorage','sessionStorage',
        'switch','case','break','continue','default','try','catch','finally','throw',
        'typeof','instanceof','yield','export','import','from','get','set'
    ]);

    for (const match of wordMatches) {
        const word = match[1];
        if (!provides.has(word) && !ignoreList.has(word) && isNaN(word)) {
            requires.add(word);
        }
    }

    return { provides, requires };
}

/**
 * Builds a topological sort of the snippets based on their dependencies.
 * Detects circular dependencies to prevent infinite loops.
 */
async function compileProject(snippetsToCompile) {
    if (!snippetsToCompile || snippetsToCompile.length === 0) {
        return { success: false, error: 'No snippets selected for compilation.' };
    }

    // 1. Analyze all snippets
    const nodes = snippetsToCompile.map(s => {
        const { provides, requires } = analyzeSnippetDependencies(s.code);
        return {
            name: s.name,
            code: s.code,
            provides: Array.from(provides),
            requires: Array.from(requires)
        };
    });

    // 2. Build Dependency Graph
    const edges = new Map();
    nodes.forEach(n => edges.set(n.name, []));

    nodes.forEach(nodeA => {
        nodes.forEach(nodeB => {
            if (nodeA.name !== nodeB.name) {
                // If Node A requires something Node B provides, Node A depends on Node B
                const dependsOnB = nodeA.requires.some(req => nodeB.provides.includes(req));
                if (dependsOnB) {
                    edges.get(nodeA.name).push(nodeB.name);
                }
            }
        });
    });

    // 3. Topological Sort (Depth-First Search)
    const visited = new Set();
    const tempMark = new Set();
    const sorted = [];
    let hasCycle = false;
    let cyclePath = '';

    function visit(nodeName) {
        if (tempMark.has(nodeName)) {
            hasCycle = true;
            cyclePath = Array.from(tempMark).join(' -> ') + ' -> ' + nodeName;
            return; 
        }
        if (!visited.has(nodeName)) {
            tempMark.add(nodeName);
            for (const dep of edges.get(nodeName)) {
                visit(dep);
                if (hasCycle) return;
            }
            tempMark.delete(nodeName);
            visited.add(nodeName);
            sorted.push(nodeName);
        }
    }

    for (const node of nodes) {
        if (!visited.has(node.name)) {
            visit(node.name);
        }
        if (hasCycle) break;
    }

    if (hasCycle) {
        return { 
            success: false, 
            error: `Circular dependency detected near: ${cyclePath}. Check if your snippets are calling each other recursively.` 
        };
    }

    // 4. Assemble Final Source
    const orderedSnippets = sorted.map(name => nodes.find(n => n.name === name));
    
    let finalCode = `/* =========================================\n`;
    finalCode += `   DevOS Vault Build: ${new Date().toLocaleString()}\n`;
    finalCode += `   Build Order: ${sorted.join(' -> ')}\n`;
    finalCode += `========================================= */\n\n`;
    
    finalCode += orderedSnippets.map(n => `// --- Snippet: ${n.name} ---\n${n.code}`).join('\n\n');

    return { success: true, code: finalCode, order: sorted };
}

/**
 * Main Bridge for the UI Compiler Button
 */
async function compileSelected() {
    // Attempt to grab snippets from the global state managed in main.js
    if (typeof snippets === 'undefined' || snippets.length === 0) {
        alert("Your Vault is empty. Cut or Copy snippets into the Vault first.");
        return;
    }

    const result = await compileProject(snippets);
    
    if (result.success) {
        vfs['compiled_vault.js'] = result.code;
        
        if (typeof saveVFS === 'function') await saveVFS();
        if (typeof renderFileList === 'function') renderFileList();
        
        // Open the newly compiled file
        if (typeof openTab === 'function') {
            openTab('compiled_vault.js');
        } else if (typeof loadFile === 'function') {
            loadFile('compiled_vault.js');
        }
        
        alert(`Build Success!\nExecution Order:\n${result.order.join(' -> ')}`);
    } else {
        alert(`Build Failed:\n${result.error}`);
    }
}
