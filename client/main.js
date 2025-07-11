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
  exec('reg query "HKCU\\Software\\Valve\\Steam\\apps" /s', (err, stdout) => {
    let games = [];
    if (!err) {
      games.push("Steam Game Example");
    }
    exec('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher" /s', (err, stdout) => {
      if (!err) {
        games.push("Epic Game Example");
      }
      if (games.length === 0) {
        dialog.showOpenDialog({ properties: ["openDirectory"] }).then(result => {
          if (!result.canceled) {
            games.push(result.filePaths[0]);
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
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("scanned-games", games);
  });
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createSplashWindow();
  scanGames(games => {
    setTimeout(() => {
      splashWindow.close();
      const storedToken = store.get("refreshToken");
      if (storedToken) {
        createMainWindow(games);
      } else {
        createLoginWindow();
      }
    }, 5000);
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
  store.set("refreshToken", "example_token");
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
