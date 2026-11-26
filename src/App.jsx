import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ideas = [
  "Sunset picnic by the water",
  "Cook a new recipe together",
  "Stargazing and hot chocolate",
  "Visit a little bookshop",
  "Make a playlist for each other",
  "Take a golden-hour photo walk",
];

const games = [
  "Two truths and a lie",
  "Co-op video game night",
  "Build the best blanket fort",
  "Draw each other in 60 seconds",
  "The question jar",
  "Board game tournament",
];

export default function App() {
  const [session, setSession] = useState(null);
  const [section, setSection] = useState("ideas");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [spaceId, setSpaceId] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [dates, setDates] = useState([]);
  const [members, setMembers] = useState([]);
  const [title, setTitle] = useState("");
  const [dateOn, setDateOn] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSpaceId("");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("members")
      .select("space_id, display_name")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        if (data) {
          setSpaceId(data.space_id);
          setDisplayName(data.display_name);
        }
      });
  }, [session]);

  async function loadSharedData(id = spaceId) {
    if (!id) return;
    const [dateResult, memberResult] = await Promise.all([
      supabase.from("dates").select("*").eq("space_id", id).order("date_on"),
      supabase
        .from("members")
        .select("user_id, display_name, points")
        .eq("space_id", id)
        .order("display_name"),
    ]);
    if (dateResult.error || memberResult.error) {
      setMessage(dateResult.error?.message || memberResult.error?.message);
      return;
    }
    setDates(dateResult.data);
    setMembers(memberResult.data);
  }

  useEffect(() => {
    if (spaceId) loadSharedData(spaceId);
  }, [spaceId]);

  async function authenticate(event) {
    event.preventDefault();
    setMessage("");
    const result =
      authMode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) setMessage(result.error.message);
    else if (authMode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
    }
  }

  async function createSpace() {
    setMessage("");
    const { data, error } = await supabase.rpc("create_space", {
      p_display_name: displayName.trim(),
    });
    if (error) return setMessage(error.message);
    setShareCode(data);
    const { data: membership } = await supabase
      .from("members")
      .select("space_id")
      .eq("user_id", session.user.id)
      .single();
    if (membership) setSpaceId(membership.space_id);
  }

  async function joinSpace(event) {
    event.preventDefault();
    setMessage("");
    const { error } = await supabase.rpc("join_space", {
      p_invite_code: inviteCode.trim(),
      p_display_name: displayName.trim(),
    });
    if (error) return setMessage(error.message);
    const { data } = await supabase
      .from("members")
      .select("space_id")
      .eq("user_id", session.user.id)
      .single();
    if (data) setSpaceId(data.space_id);
  }

  async function addDate(event) {
    event.preventDefault();
    setMessage("");
    const { error } = await supabase.from("dates").insert({
      space_id: spaceId,
      title: title.trim(),
      date_on: dateOn,
      notes: notes.trim(),
      created_by: session.user.id,
    });
    if (error) return setMessage(error.message);
    setTitle("");
    setDateOn("");
    setNotes("");
    loadSharedData();
  }

  async function deleteDate(id) {
    const { error } = await supabase.from("dates").delete().eq("id", id);
    if (error) setMessage(error.message);
    else loadSharedData();
  }

  async function addPoint(memberId) {
    const { error } = await supabase.rpc("add_point", {
      p_member_id: memberId,
    });
    if (error) setMessage(error.message);
    else loadSharedData();
  }

  if (!session) {
    return (
      <main className="page auth-page">
        <div className="stars" aria-hidden="true">✦　·　✧　·　✦</div>
        <section className="card auth-card">
          <p className="eyebrow">A little space for us</p>
          <h1>Katie &amp; Callum’s<br />Date Nights</h1>
          <p className="muted">Sign in to plan lovely things together.</p>
          <form onSubmit={authenticate} className="form">
            {authMode === "signup" && (
              <input
                required
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              required
              type="password"
              minLength={6}
              placeholder="Password (at least 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="primary">
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
          >
            {authMode === "login"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  if (!spaceId) {
    return (
      <main className="page auth-page">
        <section className="card auth-card">
          <p className="eyebrow">Make it a shared space</p>
          <h1>Welcome in ✧</h1>
          <p className="muted">
            Create a space and share its invite code, or enter your partner’s code.
          </p>
          <input
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button className="primary" onClick={createSpace} disabled={!displayName.trim()}>
            Create our space
          </button>
          <div className="divider">or join a space</div>
          <form onSubmit={joinSpace} className="form">
            <input
              required
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <button className="secondary">Join</button>
          </form>
          {shareCode && (
            <p className="notice">
              Share this invite code with your partner: <strong>{shareCode}</strong>
            </p>
          )}
          {message && <p className="notice">{message}</p>}
          <button className="text-button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  const nav = [
    ["ideas", "Date ideas"],
    ["games", "Games"],
    ["calendar", "Our calendar"],
    ["scoreboard", "Tally board"],
  ];

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">✦ our little corner of the ocean ✦</p>
          <h1>Katie &amp; Callum’s Date Nights</h1>
        </div>
        <button className="text-button signout" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <nav className="tabs" aria-label="Date night sections">
        {nav.map(([key, label]) => (
          <button
            key={key}
            className={section === key ? "tab active" : "tab"}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {message && <p className="notice">{message}</p>}

      {section === "ideas" && (
        <section className="card">
          <p className="eyebrow">Little adventures</p>
          <h2>Date ideas</h2>
          <div className="tile-grid">
            {ideas.map((idea) => <article className="tile" key={idea}>✧ {idea}</article>)}
          </div>
        </section>
      )}

      {section === "games" && (
        <section className="card">
          <p className="eyebrow">Play together</p>
          <h2>Games to play</h2>
          <div className="tile-grid">
            {games.map((game) => <article className="tile" key={game}>✦ {game}</article>)}
          </div>
        </section>
      )}

      {section === "calendar" && (
        <section className="card">
          <p className="eyebrow">Make a little plan</p>
          <h2>Our calendar</h2>
          <form onSubmit={addDate} className="form date-form">
            <input
              required
              placeholder="Date night idea"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              required
              type="date"
              value={dateOn}
              onChange={(e) => setDateOn(e.target.value)}
            />
            <input
              placeholder="Reminder or notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button className="primary">Add to our calendar</button>
          </form>
          <div className="date-list">
            {dates.length === 0 && <p className="muted">No plans yet—add your first date ✧</p>}
            {dates.map((date) => (
              <article className="date-item" key={date.id}>
                <div>
                  <span className="date-chip">
                    {new Date(`${date.date_on}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                  <h3>{date.title}</h3>
                  {date.notes && <p className="muted">{date.notes}</p>}
                </div>
                <button className="text-button" onClick={() => deleteDate(date.id)}>
                  Remove
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {section === "scoreboard" && (
        <section className="card">
          <p className="eyebrow">Every date counts</p>
          <h2>Tally board</h2>
          <p className="muted">Give a point for a date night well spent.</p>
          <div className="score-grid">
            {members.map((member) => (
              <article className="score-card" key={member.user_id}>
                <span className="score-star">✦</span>
                <h3>{member.display_name}</h3>
                <p className="score">{member.points}</p>
                <button className="primary" onClick={() => addPoint(member.user_id)}>
                  Add a point
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer>Made for two, under the same stars ✧</footer>
    </main>
  );
}
