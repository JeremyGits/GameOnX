const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { exec } = require("child_process");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadFile("index.html");
  mainWindow.webContents.openDevTools(); // For dev
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.on("login-x", () => {
  shell.openExternal("http://localhost:3000/login");
});

ipcMain.on("launch-game", (event, gamePath) => {
  // Example: Launch external game (placeholder: notepad)
  exec(gamePath || "notepad.exe", (err) => {
    if (err) console.error("Game launch error:", err);
  });
});

ipcMain.handle("get-tournaments", async () => {
  // Example IPC to fetch from backend (use axios in renderer for real)
  return [{ id: "1", name: "Test Tournament" }];
});
