# KLU GameZone — React + Node.js + MongoDB

## Features
- React + Vite responsive gaming portal
- Upcoming tournament countdown
- Six featured games and tournament cards
- Favourite game selector saved in browser localStorage
- Tournament search, game filter, and registration-status tabs
- Slot availability progress bars
- Sample leaderboard preview
- Login, signup, logout, tournament registration (one registration per player per tournament; registered events show "Registered")
- Admin registration dashboard
- Express + MongoDB Atlas backend

## Requirements
- Node.js LTS (recommended)
- MongoDB Atlas account and database

## Setup
1. Extract this ZIP and open the `KLU_GameZone_React_Enhanced` folder in VS Code.
2. Copy `server/.env.example` to `server/.env`.
3. Put your MongoDB connection string and strong secrets in `server/.env`.
4. Terminal 1:
   ```powershell
   cd server
   npm.cmd install
   npm.cmd run dev
   ```
5. Terminal 2:
   ```powershell
   cd client
   npm.cmd install
   npm.cmd run dev
   ```
6. Open http://localhost:5173

## Environment
See `server/.env.example`. Use a long random SESSION_SECRET and an admin password of at least 12 characters. Keep `.env` private; never commit it.

## Production build
```powershell
cd client
npm.cmd run build
cd ../server
npm.cmd start
```
The server then serves `client/dist` at http://localhost:3000.

## Notes
- `OPEN_TOURNAMENTS` in `server/server.js` must list the same open tournaments as `events` in `client/src/App.jsx`.
- In MongoDB Atlas, add your IP under Network Access, otherwise the server cannot connect.
- Tournament dates, slot counts, and leaderboard entries in `client/src/App.jsx` are demonstration data. Update them for real campus events.
- Favourite games are stored locally in the browser. To store preferences per account, add a backend preference endpoint.
- The leaderboard is a sample preview and is not yet connected to match scoring.
- This starter uses the default in-memory Express session store for local development. For production, configure a persistent session store, HTTPS, CSRF protection, rate limiting, validation, and backups.
