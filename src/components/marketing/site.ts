import { SUPPORTER_PRICE } from "@/lib/billing/flags";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic-app.vercel.app";
export const REPO_URL = "https://github.com/ysta32/episodic";
export const IMPORT_HREF = "/app/import?source=tvtime";
export const APP_HREF = "/app";

/** Formats a SUPPORTER_PRICE amount. The only place marketing pages turn a price into text. */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: SUPPORTER_PRICE.currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export const PRICE_MONTHLY = formatPrice(SUPPORTER_PRICE.monthly);
export const PRICE_YEARLY = formatPrice(SUPPORTER_PRICE.yearly);

/** What a TV Time export can bring across. Reactions and comments are not part of it. */
export const MIGRATES = ["Watch history with dates", "Episode and show ratings", "Followed shows and watchlist", "Lists"] as const;

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: readonly FaqItem[] = [
  {
    q: "Is Episodic really free?",
    a: `Yes. Tracking, importing, exporting and the installable app are free, with no ads. An optional Supporter plan (${PRICE_MONTHLY} a month or ${PRICE_YEARLY} a year) pays for the parts that need a server, like cloud sync.`,
  },
  {
    q: "What happened to TV Time?",
    a: "TV Time shut down on July 15, 2026, and its roughly 25 million users had to find somewhere else to go. If you requested your data export, you can bring your history with you.",
  },
  {
    q: "What comes across from TV Time?",
    a: "Your watch history with dates, your ratings, the shows you followed and your watchlist, and your lists. TV Time reactions and comments do not come across. Episodic has its own per-episode reactions, and they start fresh.",
  },
  {
    q: "How do I move my TV Time history over?",
    a: "Request your personal data from TV Time, download the zip file they send, then drop it on the Episodic import screen. The file is read in your browser and never uploaded. Our step-by-step guide covers every click.",
  },
  {
    q: "Where is my data stored?",
    a: "In your browser, on your device. Episodic works offline, and you can export everything as JSON or CSV at any time. The code is open source, so you can check this yourself.",
  },
  {
    q: "Can I also import from Trakt, Simkl, Letterboxd or IMDb?",
    a: "Yes. Episodic reads Trakt and Simkl exports, Letterboxd and IMDb CSV files, and a generic CSV.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Episodic is a progressive web app. Install it from your browser to the home screen and it opens like an app, including offline.",
  },
];
