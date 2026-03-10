/**
 * build-tools.js - Production Bundler & Minifier
 * Compresses and packages the project for final deployment.
 */

/**
 * 1. Production Bundler
 * Gathers all VFS files, minifies JS/CSS, and creates a deployment ZIP.
 */
async function buildForProduction() {
    triggerHaptic('medium');
    const zip = new JSZip();
    const buildFolder = zip.folder("production_build");

    const jsFiles = Object.keys(vfs).filter(f => f.endsWith('.js'));
    const cssFiles = Object.keys(vfs).filter(f => f.endsWith('.css'));
    const otherFiles = Object.keys(vfs).filter(f => !f.endsWith('.js') && !f.endsWith('.css'));

    // 1. Minify and Add JavaScript
    for (const file of jsFiles) {
        try {
            const minified = await minifyJS(vfs[file]);
            buildFolder.file(file, minified);
        } catch (err) {
            console.error(`Minification failed for ${file}:`, err);
            buildFolder.file(file, vfs[file]); // Fallback to raw if minification fails
        }
    }

    // 2. Add CSS (Simple Minification)
    for (const file of cssFiles) {
        const minifiedCss = vfs[file]
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\s+/g, ' ')             // Collapse whitespace
            .trim();
        buildFolder.file(file, minifiedCss);
    }

    // 3. Add HTML and Other Assets
    for (const file of otherFiles) {
        buildFolder.file(file, vfs[file]);
    }

    // 4. Generate and Download
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DevOS_Build_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    triggerHaptic('success');
    alert("Production build complete! Your minified project has been downloaded as a ZIP.");
}

/**
 * 2. JS Minification via Terser
 */
async function minifyJS(code) {
    if (typeof Terser === 'undefined') {
        console.warn("Terser not loaded. Exporting unminified JS.");
        return code;
    }

    try {
        const result = await Terser.minify(code, {
            mangle: true,
            compress: {
                dead_code: true,
                drop_console: false, // Keep console logs for ghost-console debugging
                drop_debugger: true
            }
        });
        return result.code;
    } catch (err) {
        throw err;
    }
}

/**
 * 3. AI Context Exporter
 * Bundles current project context for easy pasting into an AI assistant.
 */
function copyAIContext() {
    let context = "### DEVOS PROJECT CONTEXT\n\n";
    
    // Add active file
    if (activeTab) {
        context += `**ACTIVE FILE (${activeTab}):**\n\`\`\`javascript\n${vfs[activeTab]}\n\`\`\`\n\n`;
    }

    // Add Dependency Tree info
    if (typeof dependencyMap !== 'undefined') {
        context += "**DEPENDENCY TREE:**\n";
        Object.keys(dependencyMap).forEach(file => {
            context += `- ${file} depends on: [${dependencyMap[file].dependsOnFiles.join(', ')}]\n`;
        });
    }

    // Copy to clipboard
    navigator.clipboard.writeText(context).then(() => {
        triggerHaptic('success');
        alert("AI Context copied to clipboard! Paste it into your assistant for help.");
    });
}

/**
 * 4. Component Generator
 * Boilerplate for new modules.
 */
function generateComponent() {
    const name = prompt("Enter Component Name (e.g. 'BetSelector'):");
    if (!name) return;

    const lowerName = name.toLowerCase();
    
    vfs[`${lowerName}.html`] = `<div id="${lowerName}-container">\n    \n</div>`;
    vfs[`${lowerName}.js`] = `// ${name} Logic\nfunction init${name}() {\n    console.log('${name} Initialized');\n}`;
    vfs[`${lowerName}.css`] = `#${lowerName}-container {\n    padding: 10px;\n}`;

    saveVFS();
    renderFileList();
    openTab(`${lowerName}.js`);
    triggerHaptic('success');
}
