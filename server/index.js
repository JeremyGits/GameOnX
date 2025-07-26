// server/index.js (updated: remove OAuth2 /refresh endpoint, add pfp to UserSchema, remove deprecated Mongoose options)

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const session = require("express-session");
const socketIo = require("socket.io");
const http = require("http");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" } // Allow from Electron
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Load from .env; generate a strong random string
    resave: false,
    saveUninitialized: true,
    cookie: { 
      maxAge: 60000 * 60, // 1 hour
      secure: process.env.NODE_ENV === 'production' // Secure cookie in production (requires HTTPS)
    },
  })
);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Models
const UserSchema = new mongoose.Schema({
  xId: { type: String, unique: true },
  username: String,
  pfp: String,
  ranking: { type: Number, default: 1000 },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Added for friends list
  localUsername: String,
  localPassword: String // Hashed
});
const User = mongoose.model("User", UserSchema);

const TournamentSchema = new mongoose.Schema({
  name: String,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, default: "open" }, // open, ongoing, closed
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
const Tournament = mongoose.model("Tournament", TournamentSchema);

// Health endpoint for connection check
app.get("/health", (req, res) => res.send("OK"));

// Save user (called from Electron after auth)
app.post("/save-user", async (req, res) => {
  const { xId, username, pfp, localUsername, localPassword } = req.body;
  try {
    let hashedPassword;
    if (localPassword) {
      hashedPassword = await bcrypt.hash(localPassword, 10);
    }
    await User.findOneAndUpdate(
      { xId },
      { username, pfp, localUsername, localPassword: hashedPassword },
      { upsert: true }
    );
    res.send("User saved");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving user");
  }
});

// Delete user (new endpoint for client delete)
app.delete("/user/:xId", async (req, res) => {
  try {
    const result = await User.deleteOne({ xId: req.params.xId });
    if (result.deletedCount === 0) {
      return res.status(404).send("User not found");
    }
    res.send("User deleted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting user");
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

// Friends APIs (new)
app.get("/friends", async (req, res) => { // Assume userId from query or auth; for prototype, use query param
  const { userId } = req.query;
  try {
    const user = await User.findOne({ xId: userId }).populate("friends", "username"); // Populate friend usernames
    res.json(user ? user.friends.map(f => ({ username: f.username, online: false })) : []); // Online status placeholder
  } catch (err) {
    res.status(500).send("Error fetching friends");
  }
});

app.post("/add-friend", async (req, res) => {
  const { userId, username } = req.body; // userId of requester, username to add
  try {
    const user = await User.findOne({ xId: userId });
    const friend = await User.findOne({ username });
    if (!user || !friend) return res.status(400).send("User not found");
    if (!user.friends.includes(friend._id)) {
      user.friends.push(friend._id);
      friend.friends.push(user._id); // Mutual add for simplicity
      await user.save();
      await friend.save();
    }
    res.send("Friend added");
  } catch (err) {
    res.status(500).send("Error adding friend");
  }
});

// Socket.io for real-time features
let matchmakingQueue = []; // Simple queue for ranked matches
let rooms = {}; // In-memory rooms for prototype (id: { name, players: [] })

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

  // New: Room creation and updates
  socket.on("create-room", ({ name }) => {
    const roomId = `room_${Math.random().toString(36).substring(2)}`; // Simple ID gen
    rooms[roomId] = { name, players: [socket.id] };
    socket.join(roomId);
    io.to(roomId).emit("room-update", { players: rooms[roomId].players });
  });

  socket.on("join-room", (roomId) => { // Client would emit this; add to client if needed
    if (rooms[roomId]) {
      rooms[roomId].players.push(socket.id);
      socket.join(roomId);
      io.to(roomId).emit("room-update", { players: rooms[roomId].players });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Clean up rooms on disconnect
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p !== socket.id);
      if (rooms[roomId].players.length === 0) delete rooms[roomId];
      else io.to(roomId).emit("room-update", { players: rooms[roomId].players });
    }
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