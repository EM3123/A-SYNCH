/**
 * Trust Layer settings. Change numbers here, not in the checks.
 */
import type { SourceType } from "@/lib/contracts";

/**
 * The demo is scripted for Nov 7, 2026. Freshness is measured against this
 * moment so the demo behaves the same on any day. Set ASYNCH_NOW to another
 * ISO time, or to "live" to use the real clock.
 */
export const DEMO_NOW = "2026-11-07T14:30:00-05:00";

export function trustNow(): Date {
  const value = process.env.ASYNCH_NOW;
  if (value === "live") return new Date();
  return new Date(value || DEMO_NOW);
}

/** How many hours a source stays fresh, by system. */
export const FRESHNESS_HOURS: Record<SourceType, number> = {
  github: 72,
  jira: 168,
  slack: 48,
  meeting: 336, // stated principles from meetings last two weeks
  note: 72,
};

/**
 * Share of a claim's key words that must appear in the sources it cites.
 * Guidance ("supported") may paraphrase more loosely than a stated fact.
 */
export const MIN_SUPPORT = { confirmed: 0.4, supported: 0.3 } as const;

/** Share of a restricted record's words that, if found in an answer, counts as a leak. */
export const LEAK_OVERLAP = 0.7;
