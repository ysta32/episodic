export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic-app.vercel.app";
export const REPO_URL = "https://github.com/ysta32/episodic";
export const IMPORT_HREF = "/app/import?source=tvtime";
export const APP_HREF = "/app";

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: readonly FaqItem[] = [
  {
    q: "Is Episodic really free?",
    a: "Yes. Tracking, importing, exporting, reactions and the PWA are free forever. An optional Supporter plan ($2/month or $18/year) funds development and adds cloud sync and extras.",
  },
  {
    q: "What happened to TV Time?",
    a: "TV Time shut down on July 15, 2026, leaving more than 25 million users looking for a new home. If you requested your data export, you can bring it with you.",
  },
  {
    q: "How do I move my TV Time history over?",
    a: "Request your personal data from TV Time under GDPR, download the zip file they send, then drop it on the Episodic import screen. Shows, watched episodes and dates are matched automatically. Our step-by-step guide covers every click.",
  },
  {
    q: "Where is my data stored?",
    a: "Locally in your browser first, so Episodic works offline and your history is yours. You can export everything as files at any time, and the code is open source.",
  },
  {
    q: "Can I also import from Trakt, Simkl, Letterboxd or IMDb?",
    a: "Yes. Episodic imports Trakt and Simkl exports as well as Letterboxd and IMDb CSV files.",
  },
  {
    q: "Does it work on my phone?",
    a: "Episodic is a progressive web app. Install it from your browser to the home screen and it behaves like a native app, including offline use.",
  },
];
