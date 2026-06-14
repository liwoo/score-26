import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

/** The invite a player fires off to their friends / group chats. */
const SHARE_TEXT =
  "⚽ I'm calling every goal at the 2026 World Cup on Score26 — predict the matches, climb the leaderboard, and prove you know ball. Think you can beat me? 🏆"

function ShareIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l5 5L20 6" />
    </svg>
  )
}

/**
 * Round toolbar button that opens the device's native share sheet (Web Share
 * API), falling back to copying the invite link when sharing isn't available
 * (e.g. desktop browsers). Styled to match the cartoon toolbar buttons.
 */
export function ShareButton({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.origin
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Score26', text: SHARE_TEXT, url })
        return
      } catch (err) {
        // User dismissed the share sheet — not an error worth handling.
        if ((err as DOMException)?.name === 'AbortError') return
        // Anything else: fall through to the clipboard fallback.
      }
    }
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked — nothing more we can do gracefully.
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={share}
        aria-label="Invite friends"
        className="grid size-10 place-items-center rounded-full border-2 border-ink bg-white text-ink shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        {copied ? <CheckIcon /> : <ShareIcon />}
      </button>
      <AnimatePresence>
        {copied && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-full border-2 border-ink bg-sun px-2.5 py-1 text-xs font-extrabold shadow-pop"
          >
            Link copied! 🔗
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
