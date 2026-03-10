/**
 * help-section.js - Integrated Documentation & Help System
 * Renders the help manual using Markdown for high readability.
 */

const HELP_CONTENT = `
# 📖 DevOS Ultimate Guide

Welcome to the ultimate mobile development environment. Since you're coding on a phone, every tool here is designed for touch-first speed.

---

## ⌨️ Mobile Coding Tools
- **Soft-Key Bar:** Located above your keyboard in the Editor. Tapping symbols like \`{ \` or \`=>\` inserts them instantly. Paired symbols (like brackets) will automatically place your cursor in the middle.
- **Voice Macros:** Tap 🎙️ **Voice** and say "Format" or the name of a Vault snippet to inject code without typing.
- **Haptics:** You'll feel a subtle vibration for successful actions and a sharp alert for errors.

---

## 📱 Live Sandbox & Ghost Console
- **📱 Preview Tab:** Renders your app in an isolated sandbox.
- **Ghost Console:** An overlay that appears on top of your app to show \`console.log\` and runtime errors.
- **Gyro Sim:** Use the sliders to simulate tilting your phone—perfect for testing motion-based game logic.
- **FPS Counter:** Keep an eye on the green text in the corner; if it drops below 30, your logic might be too heavy for mobile.

---

## 🎨 Visual Builders
- **State Machine:** Map out logic flows (e.g., *IDLE -> SPINNING -> WIN*). Hit "Generate" to get a clean JS switch-case block.
- **Audio Synth:** Create retro game sounds using math. Test the sound, then generate a JS function to play it offline.
- **Sprite Slicer:** Upload a master sprite sheet to generate CSS classes for every frame automatically.

---

## 🧠 Intelligence & Data
- **Dependency Tracker:** A collapsible tree showing how your files connect.
- **Storage Inspector:** View and edit the \`localStorage\` of your sandbox app live.
- **Data Seeder:** Inject fake data (like high scores or bet amounts) to test specific game outcomes.

---

## 🌿 Git-Lite (Branching)
- Use **Branches** in the sidebar to experiment safely. 
- Create a "Test" branch to try new logic. If it fails, switch back to "Main" to restore your working project instantly.

---

## 🚀 Production & Export
- **CMD Palette:** Tap ⌨️ **CMD** to search for any tool by name.
- **Production Build:** Found in Settings. It minifies all your code and zips it up for final deployment.
- **AI Context:** Found in the palette. It copies your project's "brain" so you can paste it into an assistant for expert help.
`;

document.addEventListener('DOMContentLoaded', () => {
    // We render the help content once the IDE boots
    renderHelpSystem();
});

/**
 * Renders the Markdown content into the Help View
 */
function renderHelpSystem() {
    const container = document.getElementById('help-markdown-container');
    if (!container || typeof marked === 'undefined') return;

    // Use marked.js to convert the string into HTML
    container.innerHTML = marked.parse(HELP_CONTENT);
    
    // Add some inline styling to the rendered markdown for the theme
    const style = document.createElement('style');
    style.innerHTML = `
        #help-markdown-container h1 { color: var(--accent); border-bottom: 2px solid var(--border); padding-bottom: 10px; }
        #help-markdown-container h2 { color: var(--warn); margin-top: 25px; }
        #help-markdown-container h3 { color: var(--text); }
        #help-markdown-container code { background: var(--panel); padding: 2px 5px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 0.9em; }
        #help-markdown-container hr { border: 0; border-top: 1px solid var(--border); margin: 20px 0; }
        #help-markdown-container ul { padding-left: 20px; }
        #help-markdown-container li { margin-bottom: 10px; }
    `;
    container.appendChild(style);
}
