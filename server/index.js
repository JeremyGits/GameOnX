// server/index.js
const config = require("./config.js");
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const session = require("express-session");
const socketIo = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" } // Allow from Electron
});

const PORT = config.port;

// Middleware
app.use(express.json());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 * 60 }, // 1 hour
  })
);

// MongoDB connection with error handling
mongoose
  .connect(config.mongoUri, {
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

// Save user (called from Electron after auth)
app.post("/save-user", async (req, res) => {
  const { xId, username, refreshToken } = req.body;
  try {
    await User.findOneAndUpdate(
      { xId },
      { xId, username, refreshToken },
      { upsert: true }
    );
    res.send("User saved");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving user");
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
        client_id: process.env.X_CLIENT_ID,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
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