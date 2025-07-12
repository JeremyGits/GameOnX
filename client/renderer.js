// renderer.js - Additional renderer process script for Electron
// This can be loaded in index.html or other pages for dynamic UI logic

document.addEventListener('DOMContentLoaded', () => {
  console.log('Renderer loaded');
  // Example: Listen for IPC messages
  const { ipcRenderer } = require('electron');
  ipcRenderer.on('scanned-games', (event, games) => {
    console.log('Scanned games:', games);
    // Update UI with games list
  });
});
