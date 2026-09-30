import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

const COLLAPSED = 48; // px: 14px padding + 20px icon + 14px padding

// Auto "peek": the button opens by itself, holds, then closes, as a gentle reminder
const FIRST_PEEK_AFTER_LOGIN_MS = 5000;
const PEEK_HOLD_MS = 3000;
const RANDOM_PEEK_MIN_MS = 45000;
const RANDOM_PEEK_MAX_MS = 120000;

const randomDelay = () => RANDOM_PEEK_MIN_MS + Math.random() * (RANDOM_PEEK_MAX_MS - RANDOM_PEEK_MIN_MS);

const readFlag = (key) => {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (key) => {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* storage unavailable: the login peek may simply repeat on refresh */
  }
};

/**
 * Round sparkle button that expands left-to-right into "Ask TaskFlow AI" on hover / keyboard focus,
 * and also "peeks" on its own: 5s after login, then at random intervals.
 *
 * The width animates between two measured pixel values (48px ↔ exact label width), which every
 * browser interpolates smoothly. Visual effects live in index.css (.ai-launcher).
 *
 * @param {string} greetedKey - sessionStorage key marking that the post-login peek already ran
 *                              (cleared on logout together with the rest of the AI panel state)
 */
const AiLauncher = ({ onClick, greetedKey }) => {
  const textRef = useRef(null);
  const [fullWidth, setFullWidth] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [peeking, setPeeking] = useState(false);

  // Timers read the latest hover state without re-scheduling
  const interactingRef = useRef(false);
  interactingRef.current = hovered || keyboardFocus;

  const expanded = hovered || keyboardFocus || peeking;

  // Measure the expanded width once the label (and its web font) has rendered
  useLayoutEffect(() => {
    const measure = () => {
      if (textRef.current) setFullWidth(COLLAPSED + Math.ceil(textRef.current.scrollWidth));
    };
    measure();
    document.fonts?.ready?.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Auto-peek schedule: once 5s after login, then at random intervals
  useEffect(() => {
    let nextTimer;
    let holdTimer;

    // Don't draw attention when it would interrupt or nobody can see it
    const shouldSkip = () => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      return document.hidden || interactingRef.current || typing;
    };

    const peek = () => {
      if (!shouldSkip()) {
        setPeeking(true);
        holdTimer = setTimeout(() => setPeeking(false), PEEK_HOLD_MS);
      }
      nextTimer = setTimeout(peek, randomDelay());
    };

    const firstPeekDue = greetedKey && !readFlag(greetedKey);
    nextTimer = setTimeout(
      () => {
        if (firstPeekDue) writeFlag(greetedKey);
        peek();
      },
      firstPeekDue ? FIRST_PEEK_AFTER_LOGIN_MS : randomDelay()
    );

    return () => {
      clearTimeout(nextTimer);
      clearTimeout(holdTimer);
    };
  }, [greetedKey]);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Expand for keyboard users only (a mouse click also focuses the button)
      onFocus={(e) => setKeyboardFocus(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setKeyboardFocus(false)}
      data-expanded={expanded}
      style={{ width: expanded && fullWidth ? fullWidth : COLLAPSED }}
      className="ai-launcher bottom-5 left-5 z-40 h-12 flex items-center justify-start pl-3.5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white text-xs font-semibold"
      aria-label="Open TaskFlow AI assistant"
      title="Ask TaskFlow AI"
    >
      <Sparkles className="w-5 h-5 flex-shrink-0 ai-launcher-icon" />
      <span ref={textRef} className="ai-launcher-text" aria-hidden="true">
        Ask TaskFlow AI
      </span>
    </button>
  );
};

export default AiLauncher;
