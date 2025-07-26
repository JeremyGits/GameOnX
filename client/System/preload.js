// preload.js (unchanged from your version, as paths are handled in main.js BrowserWindow preloads)
const { contextBridge, ipcRenderer } = require("electron");
const socketIo = require("socket.io-client");

console.log("Preload.js loaded successfully");

const socket = socketIo("http://localhost:3000");

contextBridge.exposeInMainWorld("electronAPI", {
  loginX: () => ipcRenderer.send("login-x"),
  launchGame: (gamePath) => ipcRenderer.send("launch-game", gamePath),
  getTournaments: () => ipcRenderer.invoke("get-tournaments"),
  getFromStore: (key) => ipcRenderer.invoke("get-from-store", key),
  onUserProfiles: (callback) => ipcRenderer.on("user-profiles", (event, users) => callback(users)),
  selectUser: (id) => ipcRenderer.send("select-user", id),
  deleteUser: (id) => ipcRenderer.send("delete-user", id),
  submitOnboarding: (data) => ipcRenderer.send("submit-onboarding", data),
  onScannedGames: (callback) => ipcRenderer.on('scanned-games', (event, games) => callback(games)),
  submitPin: (verifier) => ipcRenderer.send("submit-pin", verifier),
});

contextBridge.exposeInMainWorld("socket", socket);
console.log("APIs and socket exposed in preload");