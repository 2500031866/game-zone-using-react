import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Gamepad2, Trophy, Search, User, LogOut, Shield, CalendarDays, Users, ChevronRight, Zap,
  Star, Bell, Heart, Target, Medal, Menu, X, CheckCircle2,
} from "lucide-react";

const events = [
  { id: 1, name: "Free Fire Championship", game: "Free Fire", mode: "Squad", date: "2026-11-18T16:00:00+05:30", prize: "₹10,000", status: "Registration Open", emoji: "🔥", desc: "Battle for the championship title in an intense squad tournament.", slots: 32, registered: 21 },
  { id: 2, name: "BGMI Battle Arena", game: "BGMI", mode: "Squad", date: "2026-11-22T15:00:00+05:30", prize: "₹15,000", status: "Registration Open", emoji: "🎯", desc: "Drop in, survive and become the last team standing.", slots: 40, registered: 28 },
  { id: 3, name: "Valorant Campus Clash", game: "Valorant", mode: "5 vs 5", date: "2026-11-26T14:00:00+05:30", prize: "₹12,000", status: "Coming Soon", emoji: "⚡", desc: "Show your tactical skills in a campus showdown.", slots: 20, registered: 0 },
  { id: 4, name: "EA FC Showdown", game: "EA FC", mode: "1 vs 1", date: "2026-12-02T13:00:00+05:30", prize: "₹5,000", status: "Registration Open", emoji: "⚽", desc: "Compete head-to-head and claim the football crown.", slots: 32, registered: 12 },
  { id: 5, name: "Chess Masters", game: "Chess", mode: "1 vs 1", date: "2026-12-06T10:00:00+05:30", prize: "₹3,000", status: "Registration Open", emoji: "♟️", desc: "Plan every move and prove your strategic thinking.", slots: 64, registered: 35 },
  { id: 6, name: "Call of Duty Mobile Cup", game: "COD Mobile", mode: "Squad", date: "2026-12-10T16:00:00+05:30", prize: "₹8,000", status: "Coming Soon", emoji: "💥", desc: "Team up for a fast-paced campus battle.", slots: 24, registered: 0 },
];
const games = ["Free Fire", "BGMI", "Valorant", "EA FC", "Chess", "COD Mobile"];
const gameEmoji = ["🔥", "🎯", "⚡", "⚽", "♟️", "💥"];
const leaderboard = [
  { name: "ShadowX", game: "Free Fire", points: 980 },
  { name: "KLU Titans", game: "BGMI", points: 920 },
  { name: "PixelForce", game: "Valorant", points: 870 },
  { name: "CheckMate", game: "Chess", points: 810 },
];
const emptyDetails = { name: "", email: "", address: "", team: "" };
const emptyCredentials = { username: "", password: "" };

const dateText = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function loadInterests() {
  try {
    const v = JSON.parse(localStorage.getItem("klu_interests") || "[]");
    return Array.isArray(v) ? v.filter((g) => games.includes(g)) : [];
  } catch {
    return [];
  }
}

async function api(url, opts = {}) {
  const { headers, ...rest } = opts;
  const r = await fetch(url, {
    credentials: "same-origin",
    ...rest,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "Request failed");
  return d;
}

function Countdown({ date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(date).getTime() - now);
  const units = [
    ["D", Math.floor(diff / 86400000)],
    ["H", Math.floor(diff / 3600000) % 24],
    ["M", Math.floor(diff / 60000) % 60],
    ["S", Math.floor(diff / 1000) % 60],
  ];
  return (
    <div className="countdown">
      {units.map(([k, v]) => (
        <span key={k}><b>{String(v).padStart(2, "0")}</b><small>{k}</small></span>
      ))}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(false);
  const [mode, setMode] = useState("login");
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [search, setSearch] = useState("");
  const [game, setGame] = useState("All Games");
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(emptyDetails);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [rows, setRows] = useState([]);
  const [mine, setMine] = useState([]); // tournaments the logged-in user registered for
  const [interest, setInterest] = useState(loadInterests);
  const [tab, setTab] = useState("all");
  const [mobileMenu, setMobileMenu] = useState(false);

  const refreshMine = useCallback(async () => {
    try {
      const d = await api("/api/registrations/mine");
      setMine(d.tournaments || []);
    } catch {
      setMine([]);
    }
  }, []);

  // Restore session on page load.
  useEffect(() => {
    api("/api/me").then((d) => setUser(d.user)).catch(() => {});
  }, []);

  // Load the user's registrations whenever the logged-in user changes.
  useEffect(() => {
    if (user) refreshMine();
    else setMine([]);
  }, [user, refreshMine]);

  useEffect(() => {
    try { localStorage.setItem("klu_interests", JSON.stringify(interest)); } catch { /* storage unavailable */ }
  }, [interest]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // Escape closes any open modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setAuth(false); setSelected(null); setAdmin(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(
      (e) =>
        (game === "All Games" || e.game === game) &&
        (tab === "all" || (tab === "open" && e.status === "Registration Open") || (tab === "soon" && e.status === "Coming Soon")) &&
        (e.name.toLowerCase().includes(q) || e.game.toLowerCase().includes(q))
    );
  }, [game, search, tab]);

  const nextEvent = useMemo(
    () => events.filter((e) => new Date(e.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date))[0],
    []
  );

  function openLogin(message) {
    setMode("login");
    setAuth(true);
    if (message) setNotice(message);
  }

  async function authSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api(mode === "login" ? "/api/login" : "/api/signup", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setUser(d.user);
      setAuth(false);
      setNotice(d.message);
      setCredentials(emptyCredentials);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/api/logout", { method: "POST" });
      setUser(null);
      setAdmin(false);
      setRows([]);
      setMobileMenu(false);
      setNotice("Logged out.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function register(e) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const d = await api("/api/registrations", {
        method: "POST",
        body: JSON.stringify({ ...details, tournament: selected.name }),
      });
      setMine((old) => [...old, selected.name]);
      setNotice(d.message);
      setSelected(null);
      setDetails(emptyDetails);
    } catch (err) {
      setNotice(err.message);
      if (/already registered/i.test(err.message)) refreshMine();
    } finally {
      setBusy(false);
    }
  }

  async function loadAdmin() {
    try {
      const d = await api("/api/admin/registrations");
      setRows(d.registrations);
      setAdmin(true);
      setMobileMenu(false);
    } catch (err) {
      setNotice(err.message);
    }
  }

  function toggleInterest(g) {
    setInterest((old) => (old.includes(g) ? old.filter((x) => x !== g) : [...old, g]));
  }

  function onRegisterClick(t) {
    if (!user) openLogin("Please log in to register.");
    else setSelected(t);
  }

  return (
    <div className="app" id="top">
      <div className="strip">
        <span><Zap size={13} /> OFFICIAL CAMPUS GAMING HUB</span>
        <span>KL UNIVERSITY • PLAY FAIR, PLAY HARD</span>
      </div>

      <header>
        <a className="logo" href="#top">
          <i><Gamepad2 /></i>
          <span>KLU <b>GAMEZONE</b><small>PLAY • COMPETE • WIN</small></span>
        </a>
        <button className="mobile-toggle" aria-label="Toggle menu" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X /> : <Menu />}
        </button>
        <nav className={mobileMenu ? "nav-open" : ""}>
          <a href="#tournaments" onClick={() => setMobileMenu(false)}>Tournaments</a>
          <a href="#interests" onClick={() => setMobileMenu(false)}>My games</a>
          <a href="#leaderboard" onClick={() => setMobileMenu(false)}>Leaderboard</a>
          <a href="#about" onClick={() => setMobileMenu(false)}>About</a>
          {user?.role === "admin" && <button className="outline" onClick={loadAdmin}><Shield size={15} /> Admin</button>}
          {user ? (
            <>
              <span className="welcome"><User size={15} />{user.username}</span>
              <button className="outline" onClick={logout}><LogOut size={15} /> Logout</button>
            </>
          ) : (
            <button className="primary" onClick={() => { setMobileMenu(false); openLogin(); }}>Login / Signup</button>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="copy">
          <div className="eyebrow">● LEVEL UP YOUR CAMPUS EXPERIENCE</div>
          <h1>YOUR GAME.<br /><em>YOUR GLORY.</em></h1>
          <p>Enter the arena. Find your squad. Compete with the best gamers at KL University.</p>
          <a className="primary linkbtn" href="#tournaments">Explore tournaments <ChevronRight size={17} /></a>
          <div className="stats">
            <b>{String(events.length).padStart(2, "0")}<small>UPCOMING EVENTS</small></b>
            <b>{String(games.length).padStart(2, "0")}<small>GAMES TO CHOOSE</small></b>
            <b>1<small>CAMPUS COMMUNITY</small></b>
          </div>
        </div>
        <div className="art"><div className="glow"></div><Gamepad2 size={170} strokeWidth={1} /><span>🏆 COMPETE</span></div>
      </section>

      {nextEvent && (
        <section className="next-event">
          <div>
            <div className="eyebrow"><Bell size={14} /> NEXT TOURNAMENT STARTS IN</div>
            <h2>{nextEvent.emoji} {nextEvent.name}</h2>
            <p>{dateText(nextEvent.date)} · {nextEvent.game} · Prize {nextEvent.prize}</p>
          </div>
          <Countdown date={nextEvent.date} />
          <a className="primary linkbtn" href="#tournaments">View event <ChevronRight size={16} /></a>
        </section>
      )}

      <section className="interest-section" id="interests">
        <div className="heading">
          <div className="eyebrow">PERSONALIZE YOUR GAMEZONE</div>
          <h2>Which games are <em>you interested in?</em></h2>
          <p>Select your favourite games. Your choices are saved on this device.</p>
        </div>
        <div className="interest-grid">
          {games.map((g, i) => (
            <button key={g} className={`interest-chip ${interest.includes(g) ? "chosen" : ""}`} aria-pressed={interest.includes(g)} onClick={() => toggleInterest(g)}>
              <span>{gameEmoji[i]}</span>{g}{interest.includes(g) && <CheckCircle2 size={16} />}
            </button>
          ))}
        </div>
        <p className="interest-note">
          <Heart size={15} /> {interest.length ? `You selected ${interest.length} game(s): ${interest.join(", ")}` : "Choose at least one game to build your personal gaming list."}
        </p>
      </section>

      <main id="tournaments">
        <div className="heading">
          <div className="eyebrow">FIND YOUR NEXT CHALLENGE</div>
          <h2>Featured <em>tournaments</em></h2>
          <p>Choose your game and get ready to compete.</p>
        </div>
        <div className="filters">
          <label><Search size={17} /><input placeholder="Search tournaments or games..." aria-label="Search tournaments" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <select aria-label="Filter by game" value={game} onChange={(e) => setGame(e.target.value)}>
            <option>All Games</option>
            {games.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="tabs">
          {[["all", "All events"], ["open", "Registration open"], ["soon", "Coming soon"]].map(([v, l]) => (
            <button key={v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>
        <div className="cards">
          {shown.map((t) => {
            const isMine = mine.includes(t.name);
            const filled = Math.min(t.slots, t.registered + (isMine ? 1 : 0));
            const pct = Math.round((filled / t.slots) * 100);
            const full = filled >= t.slots;
            const open = t.status === "Registration Open";
            return (
              <article className="card" key={t.id}>
                <div className="cardtop"><b>{t.emoji}</b><span className={open ? "open" : ""}>{t.status}</span></div>
                <small>{t.game.toUpperCase()} • {t.mode.toUpperCase()}</small>
                <h3>{t.name}</h3>
                <p>{t.desc}</p>
                <div className="meta">
                  <span><CalendarDays size={14} />{dateText(t.date)}</span>
                  <span><Users size={14} />{t.mode}</span>
                </div>
                <div className="slots">
                  <div><span>{filled}/{t.slots} slots filled</span><span>{pct}%</span></div>
                  <i><b style={{ width: `${pct}%` }} /></i>
                </div>
                <div className="bottom">
                  <b>{t.prize}<small>PRIZE POOL</small></b>
                  <button className="primary" disabled={!open || isMine || full} onClick={() => onRegisterClick(t)}>
                    {isMine ? <>Registered <CheckCircle2 size={14} /></> : full && open ? "Full" : <>Register <ChevronRight size={14} /></>}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!shown.length && <p className="empty">No tournaments found. Try another search or filter.</p>}
      </main>

      <section className="leaderboard" id="leaderboard">
        <div className="heading">
          <div className="eyebrow">CAMPUS CHAMPIONS</div>
          <h2>Top <em>players &amp; teams</em></h2>
          <p>Sample leaderboard preview. Official scores can be updated by the organizer.</p>
        </div>
        <div className="leader-list">
          {leaderboard.map((p, i) => (
            <div className="leader-row" key={p.name}>
              <b className="rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</b>
              <div className="leader-avatar">{p.name.slice(0, 1)}</div>
              <div className="leader-name"><b>{p.name}</b><small>{p.game}</small></div>
              <strong>{p.points} pts</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="features">
        <div><Target /><h3>Fair competition</h3><p>Clear tournament details and organized registrations.</p></div>
        <div><Users /><h3>Find your squad</h3><p>Discover team-based events and connect with players.</p></div>
        <div><Medal /><h3>Earn recognition</h3><p>Compete, improve your skills and climb the leaderboard.</p></div>
        <div><Star /><h3>All skill levels</h3><p>Explore different games and join the campus community.</p></div>
      </section>

      <section id="about" className="about">
        <Trophy size={45} />
        <div>
          <div className="eyebrow">BUILT FOR THE CAMPUS COMMUNITY</div>
          <h2>More than a game. <em>It's your arena.</em></h2>
          <p>KLU GameZone brings campus gamers together through organized tournaments, easy registration and a shared competitive space. Discover events, represent your team and make every match count.</p>
        </div>
      </section>

      <footer>
        <b>KLU <em>GAMEZONE</em></b>
        <span>© 2026 KLU GameZone • Student project</span>
        <a href="#top">Back to top ↑</a>
      </footer>

      {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}>×</button></div>}

      {auth && (
        <div className="shade" onClick={() => setAuth(false)}>
          <section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="close" aria-label="Close" onClick={() => setAuth(false)}>×</button>
            <Gamepad2 color="#a6ff4d" />
            <div className="eyebrow">WELCOME TO THE ARENA</div>
            <h2>{mode === "login" ? "Player login" : "Create account"}</h2>
            <form onSubmit={authSubmit}>
              <label>Username
                <input required autoFocus minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" title="3-20 letters, numbers or underscores" autoComplete="username" value={credentials.username} onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} />
              </label>
              <label>Password
                <input required type="password" minLength={8} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} />
              </label>
              <button className="primary full" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}</button>
            </form>
            <p>{mode === "login" ? "New player?" : "Already registered?"}{" "}
              <button type="button" className="textbtn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Sign up" : "Login"}</button>
            </p>
          </section>
        </div>
      )}

      {selected && (
        <div className="shade" onClick={() => setSelected(null)}>
          <section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="close" aria-label="Close" onClick={() => setSelected(null)}>×</button>
            <div className="eyebrow">TOURNAMENT REGISTRATION</div>
            <h2>{selected.name}</h2>
            <p className="modal-sub">Event date: {dateText(selected.date)} · Prize: {selected.prize}</p>
            <form onSubmit={register}>
              <label>Full name<input required maxLength={100} autoComplete="name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></label>
              <label>Email<input type="email" required maxLength={254} autoComplete="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} /></label>
              <label>Address<textarea required maxLength={500} value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} /></label>
              <label>Team name<input maxLength={100} placeholder="Enter team name (if applicable)" value={details.team} onChange={(e) => setDetails({ ...details, team: e.target.value })} /></label>
              <button className="primary full" disabled={busy}>{busy ? "Submitting..." : "Submit registration"}</button>
            </form>
          </section>
        </div>
      )}

      {admin && (
        <div className="shade" onClick={() => setAdmin(false)}>
          <section className="modal admin" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="close" aria-label="Close" onClick={() => setAdmin(false)}>×</button>
            <div className="eyebrow">ADMIN DASHBOARD</div>
            <h2>Tournament registrations</h2>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Player</th><th>Username</th><th>Tournament</th><th>Team</th><th>Email</th><th>Address</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}><td>{r.name}</td><td>{r.username}</td><td>{r.tournament}</td><td>{r.team || "—"}</td><td>{r.email}</td><td>{r.address}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <p>No registrations yet.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
