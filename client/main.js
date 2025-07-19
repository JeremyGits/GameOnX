// main.js (updated with custom PIN entry window instead of invalid dialog.showInputBox)

const { app, BrowserWindow, ipcMain, shell, dialog, protocol } = require("electron");
const path = require("path");
const fs = require("fs"); // Added for file logging
const child_process = require("child_process"); // For execSync
const Store = require("electron-store").default;
const store = new Store();
const axios = require("axios");
const crypto = require("crypto");
const querystring = require("querystring");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const CONSUMER_KEY = process.env.X_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.X_CONSUMER_SECRET;

let splashWindow, loginWindow, mainWindow, onboardingWindow, pinWindow;

// Create logs dir if not exists
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}
const logFile = path.join(logsDir, "oauth.log");

// Function to append to log file
function logToFile(message) {
  fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

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
  logToFile("Splash window created");
  console.log("Splash window created");
}

function scanGames() {
  logToFile("scanGames started - sync mode");
  console.log("scanGames started - sync mode");
  let games = [];
  try {
    const steamOutput = child_process.execSync('reg query "HKCU\\Software\\Valve\\Steam\\apps" /s').toString();
    if (steamOutput) {
      games.push("Steam Game Example");
      logToFile("Steam game added");
      console.log("Steam game added");
    }
  } catch (err) {
    logToFile(`Steam registry query error: ${err.message}`);
    console.log("Steam registry query error:", err.message);
  }

  try {
    const epicOutput = child_process.execSync('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher" /s').toString();
    if (epicOutput) {
      games.push("Epic Game Example");
      logToFile("Epic game added");
      console.log("Epic game added");
    }
  } catch (err) {
    logToFile(`Epic registry query error: ${err.message}`);
    console.log("Epic registry query error:", err.message);
  }

  if (games.length === 0) {
    logToFile("No games found, using defaults");
    console.log("No games found, using defaults");
    games = ["Default Game 1", "Default Game 2"];
  }

  logToFile(`scanGames completed with games: ${JSON.stringify(games)}`);
  console.log("scanGames completed with games:", games);
  return games;
}

function createLoginWindow() {
  logToFile("createLoginWindow called");
  console.log("createLoginWindow called");
  loginWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* ws://localhost:*; style-src 'self' 'unsafe-inline'"
    },
  });
  loginWindow.loadFile("login.html").then(() => {
    logToFile("login.html loaded");
    console.log("login.html loaded");
  }).catch(err => {
    logToFile(`login.html load error: ${err.message}`);
    console.log("login.html load error:", err.message);
  });
  loginWindow.webContents.on("did-finish-load", () => {
    const users = store.get("users") || [];
    loginWindow.webContents.send("user-profiles", users);
    logToFile("loginWindow did-finish-load, user-profiles sent");
    console.log("loginWindow did-finish-load, user-profiles sent");
  });
  loginWindow.on("closed", () => {
    loginWindow = null;
    logToFile("loginWindow closed");
    console.log("loginWindow closed");
  });
  loginWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.error("Login window load failed:", code, desc);
    logToFile(`Login window load failed: ${code} - ${desc}`);
  });
  // loginWindow.webContents.openDevTools(); // Uncomment for debugging
}

function createMainWindow(games) {
  logToFile("createMainWindow called with games: " + JSON.stringify(games));
  console.log("createMainWindow called with games:", games);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* ws://localhost:*; style-src 'self' 'unsafe-inline'"
    },
  });
  mainWindow.loadFile("index.html").then(() => {
    logToFile("index.html loaded");
    console.log("index.html loaded");
  }).catch(err => {
    logToFile(`index.html load error: ${err.message}`);
    console.log("index.html load error:", err.message);
  });
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("scanned-games", games);
    logToFile("mainWindow did-finish-load, scanned-games sent");
    console.log("mainWindow did-finish-load, scanned-games sent");
  });
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.error("Main window load failed:", code, desc);
    logToFile(`Main window load failed: ${code} - ${desc}`);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    logToFile("mainWindow closed");
    console.log("mainWindow closed");
  });
}

function createOnboardingWindow() {
  onboardingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* ws://localhost:*; style-src 'self' 'unsafe-inline'"
    },
  });
  onboardingWindow.loadFile("onboarding.html").then(() => {
    logToFile("onboarding.html loaded");
    console.log("onboarding.html loaded");
  }).catch(err => {
    logToFile(`onboarding.html load error: ${err.message}`);
    console.log("onboarding.html load error:", err.message);
  });
  onboardingWindow.on("closed", () => (onboardingWindow = null));
}

function createPinWindow(oauth_token) {
  pinWindow = new BrowserWindow({
    width: 400,
    height: 200,
    parent: loginWindow,
    modal: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  pinWindow.loadFile("pin.html").then(() => {
    logToFile("pin.html loaded");
    console.log("pin.html loaded");
  }).catch(err => {
    logToFile(`pin.html load error: ${err.message}`);
    console.log("pin.html load error:", err.message);
  });
  pinWindow.on("closed", () => (pinWindow = null));
  // Listen for PIN submission from renderer
  ipcMain.once("submit-pin", (event, verifier) => {
    if (pinWindow) pinWindow.close();
    handlePinExchange(oauth_token, verifier);
  });
}

function generateNonce() {
  return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function generateSignature(method, url, params, oauth_token_secret = '') {
  const sortedParams = Object.keys(params).sort().map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
  const signatureBase = [method, encodeURIComponent(url), encodeURIComponent(sortedParams)].join('&');
  console.log("Signature base string:", signatureBase);
  logToFile(`Signature base string: ${signatureBase}`);
  const signingKey = `${encodeURIComponent(CONSUMER_SECRET)}&${encodeURIComponent(oauth_token_secret)}`;
  console.log("Signing key:", signingKey);
  logToFile(`Signing key: ${signingKey}`);
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  console.log("Generated signature:", signature);
  logToFile(`Generated signature: ${signature}`);
  return signature;
}

async function handlePinExchange(oauth_token, verifier) {
  console.log("Processing PIN verifier:", verifier);
  logToFile(`Processing PIN verifier: ${verifier}`);
  try {
    // Exchange for access token
    const params = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: generateTimestamp(),
      oauth_token: oauth_token,
      oauth_verifier: verifier,
      oauth_version: "1.0",
    };
    params.oauth_signature = generateSignature('POST', 'https://api.x.com/oauth/access_token', params);

    const authHeader = 'OAuth ' + Object.keys(params).map(key => `${key}="${encodeURIComponent(params[key])}"`).join(', ');
    console.log("Access token request header:", authHeader);
    logToFile(`Access token request header: ${authHeader}`);

    const accessResponse = await axios.post("https://api.x.com/oauth/access_token", null, {
      headers: { Authorization: authHeader },
    });
    console.log("Access token response:", accessResponse.data);
    logToFile(`Access token response: ${JSON.stringify(accessResponse.data)}`);

    const accessData = querystring.parse(accessResponse.data);
    const access_token = accessData.oauth_token;
    const access_token_secret = accessData.oauth_token_secret;
    const user_id = accessData.user_id;
    const screen_name = accessData.screen_name;

    // Fetch full user data with v1.1 verify_credentials
    const userParams = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: generateTimestamp(),
      oauth_token: access_token,
      oauth_version: "1.0",
      include_entities: "false",
      skip_status: "true",
      include_email: "false"  // Add query params here for signature
    };
    userParams.oauth_signature = generateSignature('GET', 'https://api.x.com/1.1/account/verify_credentials.json', userParams, access_token_secret);

    const userAuthHeader = 'OAuth ' + Object.keys(userParams).filter(key => key !== 'include_entities' && key !== 'skip_status' && key !== 'include_email').map(key => `${key}="${encodeURIComponent(userParams[key])}"`).join(', ');
    console.log("Verify credentials header:", userAuthHeader);
    logToFile(`Verify credentials header: ${userAuthHeader}`);

    const userResponse = await axios.get("https://api.x.com/1.1/account/verify_credentials.json?include_entities=false&skip_status=true&include_email=false", {
      headers: { Authorization: userAuthHeader },
    });
    console.log("User response:", userResponse.data);
    logToFile(`User response: ${JSON.stringify(userResponse.data)}`);

    const user = userResponse.data;
    user.pfp = user.profile_image_url_https.replace("_normal", "_bigger");
    user.access_token = access_token;
    user.access_token_secret = access_token_secret;

    // Multi-profile: Add/update in array
    let users = store.get("users") || [];
    const existingIndex = users.findIndex(u => u.id_str === user.id_str);
    if (existingIndex !== -1) {
      users[existingIndex] = { ...users[existingIndex], ...user };
    } else {
      users.push(user);
    }
    store.set("users", users);

    // Save/upsert to backend without local creds yet
    await axios.post("http://localhost:3000/save-user", {
      xId: user.id_str,
      username: user.screen_name,
      pfp: user.pfp,
    });
    console.log("User saved to DB");
    logToFile("User saved to DB");

    if (loginWindow) loginWindow.close();

    // If new user, open onboarding; else load main
    if (existingIndex === -1) {
      store.set("pendingUser", user);
      createOnboardingWindow();
    } else {
      store.set("currentUser", user);
      const games = scanGames();
      createMainWindow(games);
      if (mainWindow) mainWindow.focus();
    }
  } catch (err) {
    console.error("OAuth PIN exchange error:", err.response ? err.response.data : err.message);
    logToFile(`OAuth PIN exchange error: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    dialog.showErrorBox("Login Unavailable", `Error - ${err.response ? err.response.status + ': ' + (err.response.data.error || "Forbidden") : err.message}. Check console or X portal.`);
  }
}

app.whenReady().then(() => {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on("second-instance", (event, argv) => {
    console.log("Second instance detected with argv:", argv);
    logToFile(`Second instance detected with argv: ${JSON.stringify(argv)}`);
    if (loginWindow) {
      loginWindow.focus();
    } else if (mainWindow) {
      mainWindow.focus();
    }
  });

  // No need for protocol registration with oob

  createSplashWindow();
  setTimeout(() => {
    if (splashWindow) splashWindow.close();
    createLoginWindow();
  }, 3000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createSplashWindow();
});

// IPC for login (OAuth1 start with oob PIN flow)
ipcMain.on("login-x", async () => {
  try {
    const params = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: generateTimestamp(),
      oauth_version: "1.0",
      oauth_callback: "oob",  // Use oob for PIN-based flow
    };
    params.oauth_signature = generateSignature('POST', 'https://api.x.com/oauth/request_token', params);

    const authHeader = 'OAuth ' + Object.keys(params).map(key => `${key}="${encodeURIComponent(params[key])}"`).join(', ');

    const requestResponse = await axios.post("https://api.x.com/oauth/request_token", null, {
      headers: { Authorization: authHeader },
    });
    const requestData = querystring.parse(requestResponse.data);
    const oauth_token = requestData.oauth_token;

    store.set("oauth_token", oauth_token);

    const authUrl = `https://api.x.com/oauth/authorize?oauth_token=${oauth_token}`;
    shell.openExternal(authUrl);

    // Open custom PIN window after authorization URL
    createPinWindow(oauth_token);
  } catch (err) {
    console.error("Login initiation error:", err.response ? err.response.data : err.message);
    logToFile(`Login initiation error: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
  }
});

ipcMain.on("select-user", (event, id) => {
  try {
    const users = store.get("users") || [];
    const user = users.find(u => u.id_str === id);
    if (user) {
      store.set("currentUser", user);
      if (loginWindow) loginWindow.close();
      const games = scanGames();
      createMainWindow(games);
      if (mainWindow) {
        mainWindow.focus();
        mainWindow.show(); // Force show/focus
      }
    } else {
      throw new Error("User not found");
    }
  } catch (err) {
    console.error("Select user error:", err.message);
    logToFile(`Select user error: ${err.message}`);
    dialog.showErrorBox("Selection Error", `Failed to load profile: ${err.message}. Check logs.`);
  }
});

ipcMain.on("submit-onboarding", async (event, data) => {
  const pendingUser = store.get("pendingUser");
  if (!pendingUser) return;

  try {
    // Update backend with local creds
    await axios.post("http://localhost:3000/save-user", {
      xId: pendingUser.id_str,
      username: pendingUser.screen_name,
      pfp: pendingUser.pfp,
      localUsername: data.username,
      localPassword: data.password,
    });

    // Update local store
    let users = store.get("users") || [];
    const index = users.findIndex(u => u.id_str === pendingUser.id_str);
    if (index !== -1) {
      users[index].localUsername = data.username; // Don't store password locally
    }
    store.set("users", users);
    store.set("currentUser", users[index]);
    store.delete("pendingUser");

    if (onboardingWindow) onboardingWindow.close();
    const games = scanGames();
    createMainWindow(games);
  } catch (err) {
    console.error("Onboarding submit error:", err);
    logToFile(`Onboarding submit error: ${err.message}`);
    dialog.showErrorBox("Onboarding Error", "Failed to save local credentials.");
  }
});

ipcMain.on("launch-game", (event, gamePath) => {
  exec(gamePath || "notepad.exe", (err) => {
    if (err) {
      console.error("Game launch error:", err);
      logToFile(`Game launch error: ${err.message}`);
    }
  });
});

ipcMain.handle("get-tournaments", async () => {
  return [{ id: "1", name: "Test Tournament" }];
});

ipcMain.handle("get-from-store", (event, key) => store.get(key));