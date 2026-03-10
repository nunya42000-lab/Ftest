/**
 * preview-env.js - Live Sandbox & Hardware Simulation
 * Handles the iframe lifecycle, console interception, and sensor spoofing.
 */

let previewFPS = 0;
let lastFrameTime = performance.now();
let isSensorSimActive = false;

document.addEventListener('DOMContentLoaded', () => {
    initPreviewHooks();
});

function initPreviewHooks() {
    // Monitor FPS for the IDE's performance overhead
    const trackFPS = (now) => {
        const delta = now - lastFrameTime;
        lastFrameTime = now;
        previewFPS = Math.round(1000 / delta);
        const el = document.getElementById('fps-counter');
        if (el) el.innerText = `${previewFPS} FPS`;
        requestAnimationFrame(trackFPS);
    };
    requestAnimationFrame(trackFPS);
}

/**
 * Compiles the current VFS state into a single blob-url and launches the sandbox.
 */
function refreshLivePreview() {
    const frame = document.getElementById('live-preview-frame');
    const ghost = document.getElementById('ghost-console');
    if (!frame) return;

    // Clear previous ghost console logs
    if (ghost) ghost.innerHTML = '';
    triggerHaptic('medium');

    // 1. Get core files
    const html = vfs['index.html'] || '<html><body><h1>No index.html found</h1></body></html>';
    const css = vfs['styles.css'] || '';
    const js = vfs['main.js'] || '';

    // 2. Build the Injection Script (Console Interceptor & Sensor Spoofing)
    const injectionScript = `
        <script>
            (function() {
                const ghost = window.parent.document.getElementById('ghost-console');
                const originalConsole = {
                    log: console.log,
                    warn: console.warn,
                    error: console.error
                };

                function logToGhost(type, args) {
                    if (!ghost) return;
                    const entry = document.createElement('div');
                    entry.style.borderBottom = '1px solid rgba(0,255,0,0.2)';
                    entry.style.padding = '4px 0';
                    entry.style.color = type === 'error' ? '#f85149' : (type === 'warn' ? '#d29922' : '#0f0');
                    
                    const timestamp = new Date().toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'});
                    entry.innerHTML = \`[\${timestamp}] \${Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\`;
                    
                    ghost.appendChild(entry);
                    ghost.scrollTop = ghost.scrollHeight;
                }

                console.log = function() { logToGhost('log', arguments); originalConsole.log.apply(console, arguments); };
                console.warn = function() { logToGhost('warn', arguments); originalConsole.warn.apply(console, arguments); };
                console.error = function() { logToGhost('error', arguments); originalConsole.error.apply(console, arguments); };

                // Catch uncaught runtime errors
                window.onerror = function(msg, url, line) {
                    logToGhost('error', [\`Runtime Error: \${msg} at line \${line}\`]);
                };

                // Sensor Spoofing Listener
                window.addEventListener('message', (event) => {
                    if (event.data.type === 'DEVOS_SENSOR_UPDATE') {
                        const sensorEvt = new CustomEvent('deviceorientation', {
                            detail: event.data.values
                        });
                        // Manually trigger the event for internal logic
                        window.dispatchEvent(sensorEvt);
                        // Mock the property for standard API checks
                        window.mockedOrientation = event.data.values;
                    }
                });
            })();
        </script>
    `;

    // 3. Assemble the full document
    // We inject the CSS and JS directly into the head/body to avoid multi-file blob complexity
    const combinedContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>${css}</style>
            ${injectionScript}
        </head>
        <body>
            ${html}
            <script>${js}</script>
        </body>
        </html>
    `;

    // 4. Set the frame source
    const blob = new Blob([combinedContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    frame.src = url;

    // Show ghost console by default when previewing
    if (ghost) ghost.style.display = 'block';
}

/**
 * Aspect Ratio Management
 */
function resizePreview(mode) {
    const frame = document.getElementById('live-preview-frame');
    if (!frame) return;

    if (mode === '100%') {
        frame.style.width = '100%';
        frame.style.height = '100%';
        frame.style.borderRadius = '0';
    } else {
        const [w, h] = mode.split('x');
        frame.style.width = `${w}px`;
        frame.style.height = `${h}px`;
        frame.style.borderRadius = '20px';
        frame.style.border = '10px solid #222';
    }
}

/**
 * Sensor Simulation (Gyro/Accelerometer)
 */
function toggleDeviceSensorSimulator() {
    const overlay = document.getElementById('sensor-sim-overlay');
    isSensorSimActive = !isSensorSimActive;
    
    if (overlay) {
        overlay.style.display = isSensorSimActive ? 'flex' : 'none';
    }

    if (isSensorSimActive) {
        initSensorListeners();
    }
}

function initSensorListeners() {
    const sliders = ['alpha', 'beta', 'gamma'];
    sliders.forEach(id => {
        const el = document.getElementById(`sim-${id}`);
        if (el) {
            el.oninput = () => {
                const values = {
                    alpha: document.getElementById('sim-alpha').value,
                    beta: document.getElementById('sim-beta').value,
                    gamma: document.getElementById('sim-gamma').value
                };
                broadcastToPreview({ type: 'DEVOS_SENSOR_UPDATE', values });
            };
        }
    });
}

function broadcastToPreview(data) {
    const frame = document.getElementById('live-preview-frame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(data, '*');
    }
}
