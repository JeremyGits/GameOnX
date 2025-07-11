const { contextBridge, ipcRenderer } = require("electron");
const socketIo = require("socket.io-client");

contextBridge.exposeInMainWorld("electronAPI", {
  loginX: () => ipcRenderer.send("login-x"),
  launchGame: (gamePath) => ipcRenderer.send("launch-game", gamePath),
  getTournaments: () => ipcRenderer.invoke("get-tournaments"),
});

contextBridge.exposeInMainWorld("socketIo", socketIo);
