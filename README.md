# GameOn Gaming Client

A modern gaming client inspired by old-school platforms like MPlayer/Heat.net.
Features X authentication, real-time lobbies, chat, ranked matchmaking, and tournaments.

## Setup
1. Edit server/.env with X API keys.
2. Run MongoDB locally.
3. Start backend: cd server && node index.js
4. Start frontend: cd client && npm start

## Features
- Login via X OAuth.
- Join/create tournaments.
- Real-time chat in lobbies.
- Ranked queue with Elo.
- Launch external games.

Built with Node.js, Express, Socket.io, Electron, MongoDB.
