// vault-compiler.js - Optimized Dependency Engine

/**
 * Scans JavaScript code to identify provided definitions and required dependencies.
 */
function analyzeSnippetDependencies(code) {
    const provides = new Set();
    const requires = new Set();
    
    // 1. Identify "Provides" (Definitions)
    const fnMatches = code.matchAll(/function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/g);
    for (const match of fnMatches) provides.add(match[1]);

    const varMatches = code.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=/g);
    for (const match of varMatches) provides.add(match[1]);

    const classMatches = code.matchAll(/class\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\{/g);
    for (const match of classMatches) provides.add(match[1]);

    // 2. Identify "Requires" (Usage)
    const wordMatches = code.matchAll(/\b([a-zA-Z_$][0-9a-zA-Z_$]*)\b/g);
    
    const ignoreList = new Set([
        'const','let','var','function','class','if','else','for','while','return',
        'true','false','null','undefined','new','this','console','window','document',
        'await','async','Math','Object','Array','String','Number','Promise','setTimeout',
        'setInterval','addEventListener','fetch','JSON','localStorage','alert'
    ]);

    for (const match of wordMatches) {
        const word = match[1];
        if (!ignoreList.has(word) && !provides.has(word)) {
            requires.add(word);
        }
    }

    return {
        provides: Array.from(provides),
        requires: Array.from(requires)
    };
}

/**
 * Compiles a list of snippets into a single executable file, ordered by dependency.
 */
async function compileProject(selectedSnippets) {
    if (selectedSnippets.length === 0) return { success: false, error: "No snippets selected for compilation." };

    // 1. Build Node Map
    const nodes = selectedSnippets.map(s => ({
        name: s.name,
        code: s.code,
        ...analyzeSnippetDependencies(s.code)
    }));

    // 2. Build Dependency Edges
    const edges = new Map();
    nodes.forEach(n => edges.set(n.name, []));

    for (const nodeA of nodes) {
        for (const req of nodeA.requires) {
            // Find if any OTHER selected snippet provides this requirement
            const provider = nodes.find(n => n !== nodeA && n.provides.includes(req));
            if (provider) {
                edges.get(nodeA.name).push(provider.name);
            }
        }
    }

    // 3. Topological Sort
    const visited = new Set();
    const tempMark = new Set();
    const sorted = [];
    let hasCycle = false;
    let cyclePath = "";

    function visit(nodeName) {
        if (tempMark.has(nodeName)) { 
            hasCycle = true; 
            cyclePath = nodeName;
            return; 
        }
        if (!visited.has(nodeName)) {
            tempMark.add(nodeName);
            for (const dep of edges.get(nodeName)) visit(dep);
            tempMark.delete(nodeName);
            visited.add(nodeName);
            sorted.push(nodeName);
        }
    }

    for (const node of nodes) {
        if (!visited.has(node.name)) visit(node.name);
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
    const finalCode = orderedSnippets.map(n => `// Snippet: ${n.name}\n${n.code}`).join('\n\n');

    return { success: true, code: finalCode, order: sorted };
}

/**
 * Main Bridge for the UI Compiler Button
 */
async function compileSelected() {
    // In a real scenario, this would filter based on UI checkboxes
    // For now, it compiles everything currently in the Vault
    const result = await compileProject(snippets);
    
    if (result.success) {
        vfs['compiled_project.js'] = result.code;
        renderFileList();
        loadFile('compiled_project.js');
        logDiag(`Build Success! Execution Order: ${result.order.join(' -> ')}`, "success");
    } else {
        logDiag(`Build Failed: ${result.error}`, "error");
    }
        }
        
