import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Avatar } from "../components/Avatar";
import { Flag } from "../components/Flag";
import { PopButton } from "../components/PopButton";
import { TriondaBall } from "../components/TriondaBall";
import { HowToPlayModal } from "../components/HowToPlayModal";
import { mergeYou } from "../data/leaderboard";
import {
  useLeaderboard,
  useLeaderboardMatchIds,
  useMyScore,
} from "../data/useLeaderboard";
import { getMatches } from "../data/matches";
import { useAuth } from "../features/auth/AuthProvider";
import { requestNotifications } from "../lib/pwa";
import type { LeaderboardEntry } from "../data/types";

type Tab = "knockout" | "group" | "match";
const TAB_ORDER = ["knockout", "group", "match"] as const;
const TAB_LABELS: Record<Tab, string> = {
  knockout: "Knockout",
  group: "Group",
  match: "Matches",
};

/** Average ranking only includes players who've played more than this many games. */
const MIN_GAMES_FOR_AVG = 5;

const MEDALS = ["🥇", "🥈", "🥉"];

/** Points-per-game for a player (0 when they haven't played any games). */
function ppg(e: { points: number; games: number }): number {
  return e.games > 0 ? e.points / e.games : 0;
}

/**
 * How many leading rows earn a medal. Medals follow the *displayed value*, not
 * rank (rank is always unique even on a tie), and are awarded only while the top
 * values are strictly decreasing: the instant two players share the top value
 * the podium is contested, so the badge is dropped for that position and
 * everything below it. A tie for 1st therefore shows no medals at all.
 */
function topMedalCount(
  standings: LeaderboardEntry[],
  valueOf: (e: LeaderboardEntry) => number,
): number {
  let count = 0;
  for (let i = 0; i < Math.min(MEDALS.length, standings.length); i++) {
    const tiedBelow =
      i + 1 < standings.length &&
      valueOf(standings[i + 1]) === valueOf(standings[i]);
    if (tiedBelow) break;
    count = i + 1;
  }
  return count;
}

/** Up/down rank-change indicator. Null = no prior standing → render nothing. */
function Movement({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  if (delta === 0)
    return <span className="text-[10px] font-bold leading-none text-ink/25">–</span>;
  const up = delta > 0;
  return (
    <span
      className={`flex items-center text-[10px] font-extrabold leading-none ${
        up ? "text-grass" : "text-coral"
      }`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

function LeaderRow({
  e,
  i,
  medal,
  highlight = false,
  avgMode,
  showMovement,
}: {
  e: LeaderboardEntry;
  i: number;
  medal: string | null;
  highlight?: boolean;
  avgMode: boolean;
  showMovement: boolean;
}) {
  const badge = avgMode ? ppg(e).toFixed(1) : e.points;
  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.04 }}
      className={`flex items-center gap-3 border-b-2 border-ink/5 px-3 py-2 last:border-0 ${
        highlight ? "bg-sky/25" : ""
      }`}
    >
      <div className="grid w-7 shrink-0 place-items-center">
        <span className="font-display text-lg leading-none">{medal ?? e.rank}</span>
        {showMovement && <Movement delta={e.movement} />}
      </div>
      <Avatar seed={e.seed} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base leading-tight">
          {highlight ? "You" : e.username}
        </p>
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink/50">
          <Flag iso={e.country} size={15} shadow={false} />·{" "}
          {avgMode ? `${e.games} games` : `${e.hits} correct`}
        </p>
      </div>
      <span className="rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 font-display text-sm shadow-pop">
        {badge}
      </span>
    </motion.li>
  );
}

/** A big, friendly switch — flips the board between totals and points-per-game. */
function AvgSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="mt-2 flex w-full items-center justify-between rounded-2xl border-2 border-ink bg-cream px-3 py-2 text-left active:translate-y-[1px]"
    >
      <span>
        <span className="block font-display text-base leading-none">
          Points per game
        </span>
        <span className="mt-1 block text-[11px] font-bold text-ink/50">
          {on ? "Ranking by average · 6+ games" : "Tap to rank by average"}
        </span>
      </span>
      <span
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 border-ink transition-colors ${
          on ? "bg-grass" : "bg-white"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full border-2 border-ink bg-sun shadow-pop ${
            on ? "right-0.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const matches = getMatches();
  const { email, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("group");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [avg, setAvg] = useState(false);
  const [howTo, setHowTo] = useState(false);

  // Average ranking is meaningless per single match, so it's locked off there.
  const avgMode = avg && tab !== "match";

  const SEEN_KEY = "score26:onboarded";
  const startPredicting = () => {
    // Ask for notifications on this gesture (one-time, browser-compliant).
    void requestNotifications();
    if (localStorage.getItem(SEEN_KEY)) navigate("/matches");
    else setHowTo(true);
  };
  const continueFromHowTo = () => {
    void requestNotifications();
    localStorage.setItem(SEEN_KEY, "1");
    setHowTo(false);
    navigate("/matches");
  };
  const closeHowTo = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setHowTo(false);
  };

  // Only matches that have been played have a leaderboard. Show the most
  // recently played match first (leftmost), so the latest results lead.
  const { data: playedIds = [] } = useLeaderboardMatchIds();
  const playedMatches = matches
    .filter((m) => playedIds.includes(m.id))
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff));
  const activeMatchId =
    matchId && playedIds.includes(matchId) ? matchId : (playedMatches[0]?.id ?? null);

  const { data: field = [], isLoading } = useLeaderboard(
    tab,
    activeMatchId ?? undefined,
    email,
  );

  // "You" — identity from the signed-in profile, points from real data (0 until
  // signed in AND scored by the engine).
  const { data: myScore } = useMyScore(tab, activeMatchId ?? undefined, email);
  const youConfig = {
    username: profile?.username ?? "You",
    seed: profile?.avatarSeed ?? "Champion",
    country: profile?.country.iso ?? "mw",
    points: myScore?.points ?? 0,
    hits: myScore?.hits ?? 0,
    games: myScore?.games ?? 0,
    movement: myScore?.movement ?? null,
  };

  // A board is only worth showing once there are real competitors on it (or, for
  // the Match tab, once a played match is selected). Knockout sits empty until
  // those fixtures kick off.
  const hasField = tab === "match" ? !!activeMatchId : field.length > 0;

  // Rank everyone. The average board ranks by points-per-game and is limited to
  // players who've played more than MIN_GAMES_FOR_AVG games.
  const ranked = hasField ? mergeYou(field, youConfig) : [];
  const standings = avgMode
    ? ranked
        .filter((e) => e.games > MIN_GAMES_FOR_AVG)
        .sort((a, b) => ppg(b) - ppg(a))
        .map((e, i) => ({ ...e, rank: i + 1 }))
    : ranked;

  const you = standings.find((e) => e.id === "me");
  const visible = standings;
  const valueOf = avgMode ? ppg : (e: LeaderboardEntry) => e.points;
  const medalCount = topMedalCount(standings, valueOf);
  // Movement arrows track standings shifts — irrelevant on a single-match board
  // or while the avg re-ranks the field by a different metric.
  const showMovement = !avgMode && tab !== "match";

  // Empty / locked copy when there's nothing to rank.
  const emptyMsg = isLoading
    ? "Loading…"
    : tab === "match"
      ? "🔒 Match leaderboards open once the game kicks off."
      : tab === "knockout"
        ? "🔒 Knockout standings open when the Round of 32 kicks off."
        : "No games scored yet.";
  // Field exists but nobody qualifies for the average board yet.
  const avgEmpty = avgMode && hasField && standings.length === 0;
  // You're signed in but short of the games needed to join the avg board.
  const youUnranked =
    avgMode && hasField && !you && !!email && youConfig.games <= MIN_GAMES_FOR_AVG;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Hero */}
      <div className="relative shrink-0 overflow-hidden bg-grass px-5 pb-6 pt-9 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(#fff 1.5px, transparent 1.6px)",
            backgroundSize: "18px 18px",
          }}
        />
        <button
          onClick={() => navigate("/settings")}
          aria-label="Settings"
          className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border-2 border-ink bg-white text-ink shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <span className="text-xl leading-none">⚙️</span>
        </button>
        <motion.div
          initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: -3, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="relative inline-block"
        >
          <h1
            aria-label="score26"
            className="flex items-center font-display text-6xl tracking-tight text-sun text-stroke-ink drop-shadow-[3px_3px_0_var(--color-ink)]"
          >
            <span>SC</span>
            <motion.span
              aria-hidden
              animate={{ rotate: 360 }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
              className="mx-[2px] inline-flex drop-shadow-[3px_3px_0_var(--color-ink)]"
            >
              <TriondaBall size={46} />
            </motion.span>
            <span>RE</span>
            <span className="text-white">26</span>
          </h1>
        </motion.div>
        <p className="relative mt-1 flex max-w-[17rem] items-center gap-1 font-display text-lg leading-tight text-white/90">
          <span>
            Call the goals. Beat your friends. Rule the World&nbsp;Cup.
          </span>
        </p>
      </div>

      {/* Leaderboard */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col px-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-3xl border-[3px] border-ink bg-white shadow-pop-lg">
          <div className="px-4 pt-3">
            <h2 className="font-display text-xl">Leaderboard</h2>
            <div className="mt-2 grid grid-cols-3 rounded-full border-2 border-ink bg-cream p-0.5 text-sm font-bold">
              {TAB_ORDER.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    tab === t ? "bg-ink text-cream" : "text-ink/60"
                  }`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Points-per-game switch — not shown on the per-match board. */}
            {tab !== "match" && (
              <AvgSwitch on={avg} onToggle={() => setAvg((v) => !v)} />
            )}
          </div>

          {/* Match picker — only played matches have a leaderboard */}
          {tab === "match" && playedMatches.length > 0 && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-3 pb-1">
              {playedMatches.map((m) => {
                const active = m.id === activeMatchId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMatchId(m.id)}
                    className={`flex shrink-0 items-center gap-1 rounded-full border-2 border-ink px-2.5 py-1 text-sm font-bold transition-colors ${
                      active ? "bg-coral text-white" : "bg-white text-ink/70"
                    }`}
                  >
                    <span>{m.home.flag}</span>
                    <span className="text-xs">v</span>
                    <span>{m.away.flag}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* fills the card; scroll to your highlighted row — everyone below included */}
          <ul className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto">
            {!hasField ? (
              <li className="px-4 py-10 text-center text-sm font-bold text-ink/40">
                {emptyMsg}
              </li>
            ) : avgEmpty ? (
              <li className="px-4 py-10 text-center text-sm font-bold text-ink/40">
                No one has played more than {MIN_GAMES_FOR_AVG} games yet.
              </li>
            ) : (
              visible.map((e, i) => (
                <LeaderRow
                  key={`${tab}-${activeMatchId}-${avgMode}-${e.id}`}
                  e={e}
                  i={i}
                  medal={i < medalCount ? MEDALS[i] : null}
                  highlight={e.id === "me"}
                  avgMode={avgMode}
                  showMovement={showMovement}
                />
              ))
            )}
          </ul>

          {/* Your standing — always visible once you're on the board */}
          {you && (
            <div className="flex items-center gap-3 rounded-b-[1.4rem] border-t-2 border-ink bg-sky/30 px-3 py-2">
              <span className="grid w-7 place-items-center font-display">
                {you.rank}
              </span>
              <Avatar seed={you.seed} size={36} />
              <p className="flex-1 font-display">You</p>
              <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 font-display text-sm">
                {avgMode ? ppg(you).toFixed(1) : you.points}
              </span>
            </div>
          )}
          {/* You haven't logged enough games to join the average board. */}
          {youUnranked && (
            <div className="rounded-b-[1.4rem] border-t-2 border-ink bg-sky/30 px-3 py-2 text-center text-xs font-bold text-ink/55">
              Play more than {MIN_GAMES_FOR_AVG} games to join the average ranking
              {youConfig.games > 0 ? ` — you're at ${youConfig.games}.` : "."}
            </div>
          )}
        </div>
      </div>

      {/* CTA — gently pulses to invite a tap */}
      <div className="shrink-0 px-4 pb-4 pt-3">
        <motion.div
          animate={{ scale: [1, 1.035, 1], y: [0, -4, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <PopButton
            variant="coral"
            full
            className="text-2xl"
            onClick={startPredicting}
          >
            ⚡ Start Predicting
          </PopButton>
        </motion.div>
        <button
          onClick={() => setHowTo(true)}
          className="mx-auto mt-2 block text-xs font-bold text-ink/50 underline-offset-2 hover:underline"
        >
          ℹ️ How it works · ~3 min
        </button>
      </div>

      <HowToPlayModal
        open={howTo}
        onContinue={continueFromHowTo}
        onClose={closeHowTo}
      />
    </div>
  );
}
