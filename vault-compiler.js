// vault-compiler.js

/**
 * Scans JavaScript code and returns what it provides and what it requires.
 */
function analyzeSnippetDependencies(code) {
    const provides = new Set();
    
    // 1. Find what this snippet CREATES (Provides)
    const fnMatches = code.matchAll(/function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/g);
    for (const match of fnMatches) provides.add(match[1]);

    const varMatches = code.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=/g);
    for (const match of varMatches) provides.add(match[1]);

    const classMatches = code.matchAll(/class\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\{/g);
    for (const match of classMatches) provides.add(match[1]);

    // 2. Find what this snippet USES (Requires)
    const requires = new Set();
    const wordMatches = code.matchAll(/\b([a-zA-Z_$][0-9a-zA-Z_$]*)\b/g);
    
    // Standard JS/Browser globals to ignore
    const ignoreList = new Set([
        'const','let','var','function','class','if','else','for','while','return',
        'true','false','null','undefined','new','this','console','window','document',
        'await','async','Math','Object','Array','String','Number','Promise','setTimeout'
    ]);

    for (const match of wordMatches) {
        const word = match[1];
        // If it's not a keyword, and we didn't define it in this snippet, it's a requirement
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
 * Sorts selected snippets based on their dependencies.
 */
function compileSnippets(selectedSnippets) {
    // 1. Analyze all selected snippets
    const nodes = selectedSnippets.map(snip => ({
        ...snip,
        ...analyzeSnippetDependencies(snip.code)
    }));

    // 2. Build the Adjacency List (The Graph)
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

    // 3. Topological Sort (Execution Timing)
    const visited = new Set();
    const tempMark = new Set();
    const sorted = [];
    let hasCycle = false;

    function visit(nodeName) {
        if (tempMark.has(nodeName)) { hasCycle = true; return; }
        if (!visited.has(nodeName)) {
            tempMark.add(nodeName); // Mark as currently exploring
            for (const dep of edges.get(nodeName)) visit(dep); // Visit dependencies first
            tempMark.delete(nodeName);
            visited.add(nodeName);
            sorted.push(nodeName); // Add to sorted list AFTER dependencies are resolved
        }
    }

    for (const node of nodes) {
        if (!visited.has(node.name)) visit(node.name);
    }

    if (hasCycle) {
        return { success: false, error: "Circular dependency detected! Two snippets are waiting on each other." };
    }

    // 4. Assemble the final working file
    const orderedSnippets = sorted.map(name => nodes.find(n => n.name === name));
    const finalCode = orderedSnippets.map(n => `// --- Extracted from Vault: ${n.name} ---\n${n.code}`).join('\n\n');

    return { success: true, code: finalCode, order: sorted };
}
