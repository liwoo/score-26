import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Avatar } from "../components/Avatar";
import { Flag } from "../components/Flag";
import { PopButton } from "../components/PopButton";
import { TriondaBall } from "../components/TriondaBall";
import {
  ALLTIME_LEADERS,
  DAY_LEADERS,
  getMatchLeaders,
  getStandings,
} from "../data/leaderboard";
import { getMatches } from "../data/matches";
import type { LeaderboardEntry } from "../data/types";

type Tab = "all" | "day" | "match";
const TAB_LABELS: Record<Tab, string> = {
  all: "All-Time",
  day: "Today",
  match: "Match",
};

const MEDALS = ["🥇", "🥈", "🥉"];

function LeaderRow({
  e,
  i,
  highlight = false,
}: {
  e: LeaderboardEntry;
  i: number;
  highlight?: boolean;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.04 }}
      className={`flex items-center gap-3 border-b-2 border-ink/5 px-3 py-2 last:border-0 ${
        highlight ? "bg-sky/25" : ""
      }`}
    >
      <span className="grid w-7 shrink-0 place-items-center font-display text-lg">
        {MEDALS[e.rank - 1] ?? e.rank}
      </span>
      <Avatar seed={e.seed} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base leading-tight">
          {highlight ? "You" : e.username}
        </p>
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink/50">
          <Flag iso={e.country} size={15} shadow={false} />· {e.hits} correct
        </p>
      </div>
      <span className="rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 font-display text-sm shadow-pop">
        {e.points}
      </span>
    </motion.li>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const matches = getMatches();
  const [tab, setTab] = useState<Tab>("all");
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");

  const top =
    tab === "all"
      ? ALLTIME_LEADERS
      : tab === "day"
      ? DAY_LEADERS
      : getMatchLeaders(matchId);
  const standings = getStandings(top);
  const you = standings.find((e) => e.id === "me");

  return (
    <div className="flex h-full flex-col">
      {/* Hero */}
      <div className="relative overflow-hidden bg-grass px-5 pb-8 pt-10 text-white">
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
              {(["all", "day", "match"] as const).map((t) => (
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
          </div>

          {/* Match picker — only for the Match tab */}
          {tab === "match" && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-3 pb-1">
              {matches.map((m) => {
                const active = m.id === matchId;
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

          {/* fills the card; scroll down to your rank and 10 places past it */}
          <ul className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto">
            {standings.map((e, i) => (
              <LeaderRow
                key={`${tab}-${matchId}-${e.id}`}
                e={e}
                i={i}
                highlight={e.id === "me"}
              />
            ))}
          </ul>

          {/* Your standing — always visible */}
          {you && (
            <div className="flex items-center gap-3 rounded-b-[1.4rem] border-t-2 border-ink bg-sky/30 px-3 py-2">
              <span className="grid w-7 place-items-center font-display">
                {you.rank}
              </span>
              <Avatar seed={you.seed} size={36} />
              <p className="flex-1 font-display">You</p>
              <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 font-display text-sm">
                {you.points}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CTA — gently pulses to invite a tap */}
      <div className="px-4 pb-5 pt-4">
        <motion.div
          animate={{ scale: [1, 1.035, 1], y: [0, -4, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <PopButton
            variant="coral"
            full
            className="text-2xl"
            onClick={() => navigate("/matches")}
          >
            ⚡ Start Predicting
          </PopButton>
        </motion.div>
      </div>
    </div>
  );
}
