const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const Store = require("electron-store").default;
const store = new Store();

let splashWindow, loginWindow, mainWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  splashWindow.loadFile("splash.html");
  splashWindow.on("closed", () => (splashWindow = null));
}

function scanGames(callback) {
  // Scan registry for Steam games
  exec('reg query "HKCU\\Software\\Valve\\Steam\\apps" /s', (err, stdout) => {
    let games = [];
    if (!err) {
      // Parse output for game names (simplified; expand for full paths)
      games.push("Steam Game Example"); // Placeholder; parse real keys
    }
    // Scan for Epic (similar reg query)
    exec('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher" /s', (err, stdout) => {
      if (!err) {
        games.push("Epic Game Example");
      }
      // If no games, allow manual add
      if (games.length === 0) {
        dialog.showOpenDialog({ properties: ["openDirectory"] }).then(result => {
          if (!result.canceled) {
            games.push(result.filePaths[0]); // Add folder as "game"
          }
          callback(games);
        });
      } else {
        callback(games);
      }
    });
  });
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: { preload: path.join(__dirname, "preload.js"), nodeIntegration: false, contextIsolation: true },
  });
  loginWindow.loadFile("login.html");
  loginWindow.on("closed", () => (loginWindow = null));
}

function createMainWindow(games) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, "preload.js"), nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.loadFile("index.html");
  // Send scanned games to renderer
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("scanned-games", games);
  });
  mainWindow.webContents.openDevTools(); // For dev
}

app.whenReady().then(() => {
  createSplashWindow();
  scanGames(games => {
    setTimeout(() => { // Simulate load time
      splashWindow.close();
      // Check for stored token
      const storedToken = store.get("refreshToken");
      if (storedToken) {
        // Attempt refresh (call backend refresh endpoint)
        // If success, load main; else, show login
        createMainWindow(games); // Assume success for demo
      } else {
        createLoginWindow();
      }
    }, 5000); // 5s splash
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createSplashWindow();
});

// IPC for login
ipcMain.on("login-x", () => {
  shell.openExternal("http://localhost:3000/login");
  // After callback, store token and load main (simulated)
  store.set("refreshToken", "example_token"); // Real from callback
  loginWindow.close();
  scanGames(games => createMainWindow(games));
});

ipcMain.on("load-main", () => {
  loginWindow.close();
  scanGames(games => createMainWindow(games));
});

ipcMain.on("launch-game", (event, gamePath) => {
  exec(gamePath || "notepad.exe", (err) => {
    if (err) console.error("Game launch error:", err);
  });
});

ipcMain.handle("get-tournaments", async () => {
  return [{ id: "1", name: "Test Tournament" }];
});

