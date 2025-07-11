# GameOn Gaming Client

GameOn is a modern, open-source gaming client inspired by classic platforms like MPlayer and Heat.net. It aims to recreate the nostalgic experience of game lobbies, real-time chat, tournaments, and ranked matchmaking while integrating contemporary features such as authentication via X (formerly Twitter) API. Developers can use GameOn as a starting point for building custom gaming communities, extending it with game-specific integrations, or contributing to enhance its core functionality. It's built as a full-stack app with a Node.js backend for API and real-time features, MongoDB for data persistence, and an Electron frontend for a native desktop feel.

The app supports features like scanning installed games (via registry or manual folder addition), persistent login sessions, and launching external games. It's designed for easy extension—add new games to the dropdown, customize lobbies, or integrate more social features.

## Architecture Overview

- **Backend (Node.js/Express/Socket.io/Mongoose)**: Handles X OAuth login, user management, tournament creation/joining, ranked matchmaking, and real-time chat. Uses MongoDB for storing users, tournaments, and rankings.
- **Frontend (Electron/HTML/CSS/JS)**: Desktop app with splash screen for loading/game scanning, login screen for X auth, and main lobby for interactions. Uses IPC for backend communication and Socket.io for real-time updates.
- **Authentication**: X OAuth2 with PKCE for secure login; refresh tokens stored securely in Electron's safeStorage for persistent sessions.
- **Game Integration**: Scans Steam/Epic registry keys or allows manual folder addition during startup; games populate the lobby dropdown.

## Prerequisites

- Node.js v18+ (for backend and frontend)
- MongoDB Community Server (local instance on port 27017)
- X Developer Account with API keys (Client ID/Secret for OAuth)
- npm for dependency management

## Setup

1. **Clone the Repository** (if not already done):
 
2. **Install Dependencies**:
- Backend: `cd server && npm install`
- Frontend: `cd client && npm install`
 
3. 3. **Configure Environment**:
- Edit `server/.env` with your X API credentials:
X_CLIENT_ID=your_client_id
X_CLIENT_SECRET=your_client_secret
SESSION_SECRET=your_session_secret (e.g., random string)

- Ensure MongoDB is running (install if needed, start service or `mongod --dbpath C:\data\db`).

4. **Start the Backend**:
- Launches Electron app with splash screen, then login/lobby.

## Features

- **Splash Screen & Game Scanning**: On startup, shows a loading splash while scanning installed games from Steam/Epic registry or manual folders. Scanned games populate the lobby dropdown.
- **X Authentication**: Secure login via X OAuth (PKCE flow). Persistent sessions with encrypted refresh tokens—auto-login on subsequent launches.
- **Main Lobby**: General "GameOn Lobby" on start, with user list (PFPs from X), room grid for joining/creating games, real-time chat, and right menu for navigation.
- **Rooms & Lobbies**: Create/join game-specific rooms with chat bubbles, player counts, and icons (emojis).
- **Tournaments**: Create open tournaments, join as participant, track status (open/ongoing/closed).
- **Ranked Matchmaking**: Queue for ranked matches; simple Elo system updates rankings post-game.
- **Real-Time Updates**: Socket.io for chat, user joins, match found notifications.
- **Game Launch**: Launch detected games (placeholder opens Notepad; customize with exec paths like "steam://run/<id>").
- **Dev Tools**: Open by default in main window for debugging.

## Troubleshooting

- **MongoDB Connection Error (ECONNREFUSED)**: Ensure MongoDB is running on localhost:27017. Start service: `net start MongoDB` (admin prompt) or manual `mongod`.
- **Login Fails**: Check .env keys, server running. Browser opens for X auth; close after to return to app.
- **Splash Quits Early**: Check console logs (added in main.js). If scan fails, it may close; extend timeout in setTimeout.
- **Module Errors (e.g., socket.io-client)**: Run `npm install` in client; ensure no EBUSY (kill processes before install).
- **White Backgrounds**: Styles updated for black theme; CSP meta added to suppress warnings.

## Contributing

Contributions welcome! Fork the repo, make changes, submit PRs. Focus areas:
- Improve game scanning (parse app manifests for names/paths).
- Add more X integrations (e.g., post to X from app).
- Enhance matchmaking (add skill-based queuing).
- Package for distribution (electron-builder already in deps; run `npm run build`).

## Built With

- Backend: Node.js, Express, Socket.io, Mongoose, dotenv, axios, pkce-challenge, express-session
- Frontend: Electron, HTML/CSS/JS
- Database: MongoDB
- Auth: X API OAuth2
