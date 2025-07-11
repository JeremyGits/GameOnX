// server/index.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const pkceChallenge = require("pkce-challenge");
const mongoose = require("mongoose");
const session = require("express-session");
const socketIo = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" } // Allow from Electron
});

const PORT = 3000;
const CLIENT_ID = process.env.X_CLIENT_ID;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/callback";
const SESSION_SECRET = process.env.SESSION_SECRET || "your-secret-key"; // Add to .env

// Middleware
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 * 60 }, // 1 hour
  })
);

// MongoDB connection with error handling
mongoose
  .connect("mongodb://localhost/gaming-client", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Models
const UserSchema = new mongoose.Schema({
  xId: { type: String, unique: true },
  username: String,
  ranking: { type: Number, default: 1000 },
  refreshToken: String, // Store for long sessions
});
const User = mongoose.model("User", UserSchema);

const TournamentSchema = new mongoose.Schema({
  name: String,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, default: "open" }, // open, ongoing, closed
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
const Tournament = mongoose.model("Tournament", TournamentSchema);

// OAuth Login - Generate PKCE and redirect
app.get("/login", async (req, res) => {
  try {
    const { code_challenge, code_verifier } = await pkceChallenge();
    req.session.code_verifier = code_verifier;
    const authUrl = `https://x.com/i/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=users.read%20offline.access&state=state&code_challenge=${code_challenge}&code_challenge_method=S256`;
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).send("Error initiating login");
  }
});

// OAuth Callback - Exchange code for token
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  if (state !== "state") return res.status(400).send("Invalid state");

  const code_verifier = req.session.code_verifier;
  if (!code_verifier) return res.status(400).send("Session expired");

  try {
    const tokenResponse = await axios.post(
      "https://api.x.com/2/oauth2/token",
      new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Fetch user info
    const userResponse = await axios.get("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { id, username } = userResponse.data.data;

    // Save/update user
    await User.findOneAndUpdate(
      { xId: id },
      { xId: id, username, refreshToken: refresh_token },
      { upsert: true }
    );

    // In real app, redirect to custom URI for Electron to handle
    res.send(`Logged in as ${username}. Close this window and return to the app.`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Authentication failed");
  }
});

// Refresh token
app.post("/refresh", async (req, res) => {
  const { refresh_token, userId } = req.body;
  try {
    const response = await axios.post(
      "https://api.x.com/2/oauth2/token",
      new URLSearchParams({
        refresh_token,
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        },
      }
    );
    // Update user's refresh token
    await User.findOneAndUpdate({ xId: userId }, { refreshToken: response.data.refresh_token });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Refresh failed" });
  }
});

// Get user info (for client)
app.get("/user/:xId", async (req, res) => {
  try {
    const user = await User.findOne({ xId: req.params.xId });
    res.json(user);
  } catch (err) {
    res.status(500).send("Error fetching user");
  }
});

// Tournament APIs
app.get("/tournaments", async (req, res) => {
  try {
    const tournaments = await Tournament.find({ status: "open" });
    res.json(tournaments);
  } catch (err) {
    res.status(500).send("Error fetching tournaments");
  }
});

app.post("/create-tournament", async (req, res) => {
  try {
    const { name } = req.body;
    const tournament = new Tournament({ name });
    await tournament.save();
    res.json(tournament);
  } catch (err) {
    res.status(500).send("Error creating tournament");
  }
});

app.post("/join-tournament", async (req, res) => {
  const { userId, tournamentId } = req.body;
  try {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament || tournament.status !== "open") return res.status(400).send("Invalid tournament");
    const user = await User.findOne({ xId: userId });
    if (!user) return res.status(400).send("User not found");
    tournament.participants.push(user._id);
    await tournament.save();
    res.send("Joined tournament!");
  } catch (err) {
    res.status(500).send("Error joining tournament");
  }
});

// Socket.io for real-time features
let matchmakingQueue = []; // Simple queue for ranked matches

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join lobby
  socket.on("join-lobby", (lobbyId) => {
    socket.join(lobbyId);
    io.to(lobbyId).emit("user-joined", { id: socket.id, message: "A new player joined!" });
  });

  // Chat in lobby
  socket.on("chat", ({ msg, lobbyId, username }) => {
    io.to(lobbyId).emit("chat", { username, msg });
  });

  // Queue for ranked match
  socket.on("queue-ranked", async (userId) => {
    matchmakingQueue.push({ socketId: socket.id, userId });
    io.to(socket.id).emit("queued", { message: "In queue..." });

    // Simple matchmaking logic (check every 5s)
    const matchInterval = setInterval(async () => {
      if (matchmakingQueue.length >= 2) {
        const player1 = matchmakingQueue.shift();
        const player2 = matchmakingQueue.shift();

        const lobbyId = `match_${player1.userId}_${player2.userId}`;
        io.to(player1.socketId).emit("match-found", { opponent: player2.userId, lobbyId });
        io.to(player2.socketId).emit("match-found", { opponent: player1.userId, lobbyId });

        // Simulate game end after 30s (in real, wait for result)
        setTimeout(async () => {
          // Assume player1 wins
          await updateElo(player1.userId, player2.userId, true);
          io.to(lobbyId).emit("game-end", { winner: player1.userId });
        }, 30000);
      }
    }, 5000);

    socket.on("disconnect", () => {
      matchmakingQueue = matchmakingQueue.filter((p) => p.socketId !== socket.id);
      clearInterval(matchInterval);
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Function to update Elo rankings
async function updateElo(winnerId, loserId, isWin) {
  const winner = await User.findOne({ xId: winnerId });
  const loser = await User.findOne({ xId: loserId });
  if (!winner || !loser) return;

  const k = 32; // Elo constant
  const expectedWin = 1 / (1 + Math.pow(10, (loser.ranking - winner.ranking) / 400));
  winner.ranking += k * (1 - expectedWin);
  loser.ranking += k * (0 - (1 - expectedWin));

  await winner.save();
  await loser.save();
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
