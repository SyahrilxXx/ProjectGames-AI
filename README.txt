NEXORA MULTIPLAYER WORLD — Setup

Requirements:
- Node.js 18 or newer
- Internet connection for first dependency installation (npm install)

Run locally:
1. Extract ZIP.
2. Open terminal in this folder.
3. Run: npm install
4. Run: npm start
5. Open http://localhost:3000 in your browser.
6. Register an account, then invite friends using your computer's LAN IP and port 3000 (same Wi-Fi). For internet access, deploy to a Node.js host and use HTTPS.

Features:
- Register and login system.
- Passwords hashed with Node.js scrypt (not stored as plain text).
- Signed login token, seven-day expiry.
- JSON user store in data/users.json.
- Real-time multiplayer movement using Socket.IO.
- Shared world chat and emotes.
- Responsive futuristic dark-blue UI.

Important:
- This starter is a real-time multiplayer prototype, not yet a production-grade public game.
- For public deployment, set TOKEN_SECRET to a long random secret, add HTTPS, rate limiting, database backups, moderation/reporting, and persistent player profiles.
- Accounts are stored locally in data/users.json. Back up this file.
- The world currently uses one shared room and simple 2D movement; no question/quiz gameplay.
