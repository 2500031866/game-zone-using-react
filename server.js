require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const production = process.env.NODE_ENV === "production";
const SESSION_COOKIE = "klu_gamezone_session";

// Tournaments that accept registrations. Keep in sync with `events` in client/src/App.jsx
// (only the ones whose status is "Registration Open").
const OPEN_TOURNAMENTS = [
  "Free Fire Championship",
  "BGMI Battle Arena",
  "EA FC Showdown",
  "Chess Masters",
];

app.disable("x-powered-by");
if (production) app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(
  session({
    name: SESSION_COOKIE,
    secret: process.env.SESSION_SECRET || "development-only-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: production, sameSite: "lax", maxAge: 86400000 },
  })
);

/* ---------- Models ---------- */
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      username: {
        type: String, required: true, unique: true, trim: true, lowercase: true,
        minlength: 3, maxlength: 20, match: /^[a-z0-9_]+$/,
      },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ["user", "admin"], default: "user" },
    },
    { timestamps: true }
  )
);

const registrationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, maxlength: 254 },
    address: { type: String, required: true, maxlength: 500 },
    team: { type: String, default: "", maxlength: 100 },
    tournament: { type: String, required: true, maxlength: 150 },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
// One registration per player per tournament.
registrationSchema.index({ userId: 1, tournament: 1 }, { unique: true });
const Registration = mongoose.model("Registration", registrationSchema);

/* ---------- Helpers ---------- */
const run = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const loginRequired = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ message: "Please log in first." });

const adminRequired = run(async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ message: "Please log in first." });
  const u = await User.findById(req.session.userId).select("role");
  if (!u || u.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
});

// Small in-memory limiter for login/signup (per IP). Use a shared store if you run multiple servers.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let e = hits.get(key);
    if (!e || e.reset <= now) e = { count: 0, reset: now + windowMs };
    e.count += 1;
    hits.set(key, e);
    if (e.count > max) {
      res.set("Retry-After", String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ message: "Too many attempts. Please try again in a few minutes." });
    }
    next();
  };
}
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

const startSession = (req, res, user, status, message) =>
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ message: "Could not start session." });
    req.session.userId = user._id.toString();
    res.status(status).json({ message, user: { username: user.username, role: user.role } });
  });

/* ---------- Routes ---------- */
app.get("/api/health", (req, res) =>
  res.json({
    message: "KLU GameZone backend is running",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  })
);

app.post("/api/signup", authLimiter, run(async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = req.body.password;
  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ message: "Username must be 3-20 characters (letters, numbers or underscores)." });
  if (typeof password !== "string" || password.length < 8 || password.length > 72)
    return res.status(400).json({ message: "Password must be 8-72 characters." });
  let user;
  try {
    user = await User.create({ username, passwordHash: await bcrypt.hash(password, 12) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "Username already taken." });
    throw e;
  }
  startSession(req, res, user, 201, "Account created!");
}));

app.post("/api/login", authLimiter, run(async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = req.body.password;
  const user = await User.findOne({ username });
  if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ message: "Invalid username or password." });
  startSession(req, res, user, 200, "Login successful!");
}));

app.get("/api/me", run(async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not logged in." });
  const u = await User.findById(req.session.userId).select("username role");
  if (!u) return res.status(401).json({ message: "Account not found." });
  res.json({ user: { username: u.username, role: u.role } });
}));

app.post("/api/logout", (req, res, next) =>
  req.session.destroy((e) => {
    if (e) return next(e);
    res.clearCookie(SESSION_COOKIE);
    res.json({ message: "Logged out." });
  })
);

app.post("/api/registrations", loginRequired, run(async (req, res) => {
  const d = {
    name: String(req.body.name || "").trim(),
    email: String(req.body.email || "").trim().toLowerCase(),
    address: String(req.body.address || "").trim(),
    team: String(req.body.team || "").trim(),
    tournament: String(req.body.tournament || "").trim(),
  };
  if (!d.name || !d.email || !d.address || !d.tournament)
    return res.status(400).json({ message: "Name, email, address and tournament are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    return res.status(400).json({ message: "Enter a valid email." });
  if (d.name.length > 100 || d.email.length > 254 || d.address.length > 500 || d.team.length > 100)
    return res.status(400).json({ message: "One of the fields is too long." });
  if (!OPEN_TOURNAMENTS.includes(d.tournament))
    return res.status(400).json({ message: "This tournament is not open for registration." });
  try {
    const r = await Registration.create({ ...d, userId: req.session.userId });
    res.status(201).json({ message: "Registration saved!", id: r._id });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "You are already registered for this tournament." });
    throw e;
  }
}));

// Tournament names the logged-in user has already registered for.
app.get("/api/registrations/mine", loginRequired, run(async (req, res) => {
  const rows = await Registration.find({ userId: req.session.userId }).select("tournament").lean();
  res.json({ tournaments: rows.map((r) => r.tournament) });
}));

app.get("/api/admin/registrations", adminRequired, run(async (req, res) => {
  const rows = await Registration.find().sort({ registeredAt: -1 }).populate("userId", "username").lean();
  res.json({
    registrations: rows.map((r) => ({
      id: r._id,
      username: r.userId?.username || "Unknown",
      name: r.name,
      email: r.email,
      address: r.address,
      team: r.team,
      tournament: r.tournament,
      registeredAt: r.registeredAt,
    })),
  });
}));

// Unknown API routes get JSON, not the React index.html.
app.use("/api", (req, res) => res.status(404).json({ message: "Not found." }));

const dist = path.join(__dirname, "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

// Error handler (4 args required by Express).
// eslint-disable-next-line no-unused-vars
app.use((e, req, res, next) => {
  if (res.headersSent) return next(e);
  if (e.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body." });
  if (e.type === "entity.too.large") return res.status(413).json({ message: "Request too large." });
  console.error(e.message || e);
  res.status(500).json({ message: "Server error. Check terminal." });
});

/* ---------- Startup ---------- */
async function start() {
  if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET)
    throw new Error("Set MONGODB_URI and SESSION_SECRET in server/.env (copy server/.env.example).");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB");
  await Registration.init(); // make sure the unique index exists before accepting traffic

  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (ADMIN_USERNAME && ADMIN_PASSWORD) {
    const username = ADMIN_USERNAME.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      console.warn("ADMIN_USERNAME must be 3-20 characters (letters, numbers, underscore). Admin not created.");
    } else if (ADMIN_PASSWORD.length < 12) {
      console.warn("ADMIN_PASSWORD must be at least 12 characters. Admin not created.");
    } else {
      const a = await User.findOne({ username });
      if (!a) {
        await User.create({ username, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: "admin" });
        console.log(`Admin account "${username}" created.`);
      } else if (a.role !== "admin") {
        a.role = "admin";
        await a.save();
      }
    }
  }
  app.listen(PORT, () => console.log(`KLU GameZone API: http://localhost:${PORT}`));
}

if (require.main === module) {
  start().catch((e) => {
    console.error("Startup failed:", e.message);
    process.exit(1);
  });
}

module.exports = { app, User, Registration, OPEN_TOURNAMENTS };
