const { app, BrowserWindow, ipcMain, shell, dialog, protocol } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const Store = require("electron-store").default;
const store = new Store();
const axios = require("axios");
const pkceChallenge = require("pkce-challenge");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") }); // Load .env from client folder

const CLIENT_ID = process.env.X_CLIENT_ID;
const REDIRECT_URI = "gameon://callback";

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
  let games = [];
  try {
    exec('reg query "HKCU\\Software\\Valve\\Steam\\apps" /s', (err, stdout) => {
      if (err) {
        console.error("Steam registry query error:", err);
      } else {
        games.push("Steam Game Example");
      }
      try {
        exec('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher" /s', (err, stdout) => {
          if (err) {
            console.error("Epic registry query error:", err);
          } else {
            games.push("Epic Game Example");
          }
          if (games.length === 0) {
            dialog.showOpenDialog({ properties: ["openDirectory"] }).then(result => {
              if (!result.canceled) {
                games.push(result.filePaths[0]);
              }
              callback(games);
            }).catch(err => {
              console.error("Dialog error:", err);
              callback(games);
            });
          } else {
            callback(games);
          }
        });
      } catch (innerErr) {
        console.error("Inner scan error:", innerErr);
        callback(games);
      }
    });
  } catch (outerErr) {
    console.error("Outer scan error:", outerErr);
    callback(games);
  }
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

async function handleOAuthCallback(url) {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const returnedState = parsed.searchParams.get("state");

    const storedState = store.get("oauth_state");
    if (returnedState !== storedState) {
      console.error("Invalid state in OAuth callback");
      return;
    }

    const verifier = store.get("oauth_verifier");

    const tokenResponse = await axios.post(
      "https://api.x.com/2/oauth2/token",
      new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    store.set("access_token", access_token);
    store.set("refresh_token", refresh_token);

    const userResponse = await axios.get("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = userResponse.data.data;
    store.set("user", user);

    // Save to backend DB
    await axios.post("http://localhost:3000/save-user", {
      xId: user.id,
      username: user.username,
      refreshToken: refresh_token,
    });

    if (loginWindow) loginWindow.close();
    scanGames(games => createMainWindow(games));
  } catch (err) {
    console.error("OAuth callback error:", err);
  }
}

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient("gameon");

  protocol.registerBufferProtocol("gameon", (req, callback) => {
    callback({ mimeType: "text/html", data: Buffer.from("<h5>OAuth Callback Handled</h5>") });
  });

  createSplashWindow();
  scanGames(games => {
    setTimeout(() => {
      if (splashWindow) splashWindow.close();
      const storedToken = store.get("refresh_token");
      if (storedToken) {
        createMainWindow(games);
      } else {
        createLoginWindow();
      }
    }, 3000); // Reduced for testing
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createSplashWindow();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleOAuthCallback(url);
});

app.on("second-instance", (event, argv) => {
  const url = argv.find((arg) => arg.startsWith("gameon://"));
  if (url) handleOAuthCallback(url);
});

// IPC for login
ipcMain.on("login-x", async () => {
  try {
    const pkce = await pkceChallenge();
    const verifier = pkce.code_verifier;
    const challenge = pkce.code_challenge;
    const state = "state_" + Math.random().toString(36).substring(2); // Random state

    store.set("oauth_verifier", verifier);
    store.set("oauth_state", state);

    const authUrl = `https://x.com/i/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=users.read%20offline.access&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
    shell.openExternal(authUrl);
  } catch (err) {
    console.error("Login initiation error:", err);
  }
});

ipcMain.on("load-main", () => {
  if (loginWindow) loginWindow.close();
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