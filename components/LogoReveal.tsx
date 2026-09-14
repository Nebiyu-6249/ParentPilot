"use client";

import { useCallback, useEffect, useState } from "react";

import CompassDraw from "@/components/CompassDraw";
import { copy } from "@/lib/copy";

/**
 * The one-time intro.
 *
 * Star draws, square draws around it, tail appears, wordmark fades in. 1.2
 * seconds on a paper field, skippable on any tap or keypress.
 *
 * It is an overlay, never a gate: the page underneath has already rendered
 * and is interactive the moment the overlay lifts. It is also mounted only
 * after the first client render, so a returning visitor who has `pp_seen_intro`
 * set never sees a flash of it, and a visitor with localStorage unavailable
 * simply gets the page with no intro rather than an error.
 */

const STORAGE_KEY = "pp_seen_intro";

/**
 * The whole reveal, in one number.
 *
 * The star draw, the container and the wordmark are all derived from this, so
 * retuning the intro means editing one constant rather than hunting four
 * timings that have to stay in proportion.
 */
export const REVEAL_TOTAL_MS = 2600;

const LIFT_MS = 320;

/** Beats, as fractions of the total. The star draw is slowed rather than a
 *  pause being added, so the mark is being drawn for most of the duration. */
const STAR_DRAW_MS = Math.round(REVEAL_TOTAL_MS * 0.54);
const SQUARE_AT_MS = STAR_DRAW_MS;
const TAIL_AT_MS = Math.round(REVEAL_TOTAL_MS * 0.74);
const WORDMARK_AT_MS = Math.round(REVEAL_TOTAL_MS * 0.82);

export default function LogoReveal() {
  const [visible, setVisible] = useState(false);
  const [lifting, setLifting] = useState(false);

  const dismiss = useCallback(() => {
    setLifting(true);
    window.setTimeout(() => setVisible(false), LIFT_MS);
  }, []);

  useEffect(() => {
    /* Skipped entirely, not merely un-animated.

       The stylesheet zeroes animation durations under reduced motion, which
       at 1.2 seconds was barely noticeable. At 2.6 it would leave a static
       overlay sitting over the page for two and a half seconds, which is a
       worse experience than the animation it was meant to spare them. */
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // Nothing to do.
      }
      return;
    }

    let seen = true;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private browsing, or storage disabled. Skip the intro rather than
      // showing it on every single visit.
      seen = true;
    }
    if (seen) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do. Worst case it plays again next time.
    }

    setVisible(true);
    const timer = window.setTimeout(() => {
      setLifting(true);
      window.setTimeout(() => setVisible(false), LIFT_MS);
    }, REVEAL_TOTAL_MS);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const skip = (): void => dismiss();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "var(--paper)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: lifting ? 0 : 1,
        transition: `opacity ${LIFT_MS}ms ease-out`,
        pointerEvents: lifting ? "none" : "auto",
      }}
    >
      <CompassDraw
        mode="draw"
        size={120}
        durationMs={STAR_DRAW_MS}
        delayMs={0}
        squareDelayMs={SQUARE_AT_MS}
        tailDelayMs={TAIL_AT_MS}
      />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 30,
          color: "var(--teal)",
          letterSpacing: "-0.015em",
          opacity: 0,
          animation: `pp-fade-in 300ms ease-out ${WORDMARK_AT_MS}ms 1 forwards`,
        }}
      >
        {copy.brand.name}
      </span>
    </div>
  );
}
