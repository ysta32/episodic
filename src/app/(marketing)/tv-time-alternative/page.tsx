import type { Metadata } from "next";
import Link from "next/link";
import { ArticleHero, ClosingCta, Prose } from "@/components/marketing/Article";
import { Comparison } from "@/components/marketing/Comparison";
import { JsonLd } from "@/components/marketing/JsonLd";
import { REPO_URL, SITE_URL } from "@/components/marketing/site";

const TITLE = "The best TV Time alternative in 2026: free, open source, with import";
const DESC =
  "TV Time shut down on July 15, 2026. Compare Episodic, Trakt and Simkl honestly and move your watch history over with one-click import.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/tv-time-alternative" },
  openGraph: { type: "article", url: "/tv-time-alternative", title: TITLE, description: DESC },
};

export default function Page() {
  return (
    <article>
      <ArticleHero
        eyebrow="TV Time alternative"
        title="Looking for a TV Time alternative? Start here."
        lead="TV Time closed on July 15, 2026 and left more than 25 million people without their tracker. Here is an honest look at where to go next."
      />
      <Prose>
        <h2>What happened to TV Time</h2>
        <p>
          For years TV Time was the friendliest way to track what you watched: tick off an episode, react with a GIF or emoji, see what the world thought. Then the service closed, and a huge community had to find a new home at once. The good news is that your history can survive, because you have a legal right to your data. The bad news is that the obvious alternatives each come with trade-offs.
        </p>

        <h2>What to look for in a replacement</h2>
        <ul>
          <li><strong>Safety from another shutdown.</strong> Open source and local-first designs mean your data is not hostage to one company.</li>
          <li><strong>A real free tier.</strong> Tracking shows should not need a subscription.</li>
          <li><strong>Import.</strong> Retyping ten years of history is not an option.</li>
          <li><strong>The social bits.</strong> Many TV Time fans stayed for the per-episode reactions.</li>
        </ul>
        <div className="!my-10"><Comparison /></div>

        <h2>Trakt</h2>
        <p>
          Trakt is the veteran of the category, with a large database and an ecosystem of apps and media center plugins. Its free tier has become more restrictive over time, with caps on list sizes and several features reserved for VIP members. It is also a closed service, so you depend on the company for continuity. If you rely on media center scrobbling, Trakt remains a strong choice.
        </p>

        <h2>Simkl</h2>
        <p>
          Simkl covers TV, anime and movies and offers a polished calendar and a generous import list. Since the TV Time shutdown it has taken on a flood of new users, and many report slow pages and delayed imports. Some features are paid, and as with Trakt, it is a closed platform.
        </p>

        <h2>Episodic</h2>
        <p>
          Episodic was built for exactly this moment. It is free, <a href={REPO_URL}>open source</a> and local-first, which means your library lives on your own device and keeps working offline. It reads a TV Time export directly in your browser (watch history, ratings, watchlists and lists), imports from Trakt, Simkl, Letterboxd and IMDb, and has its own per-episode reactions. Your old TV Time reactions and comments don&apos;t come across, but the habit can carry on. You can install it as a PWA and export all your data whenever you like.
        </p>
        <p>
          To be fair, Episodic is new. Its catalog and community are smaller than Trakt&apos;s, and it has no media center plugin ecosystem yet. If that matters to you, you can import to Episodic now and still keep a Trakt account.
        </p>

        <h2>How to move over</h2>
        <p>
          Request your data from TV Time, download the zip and drop it into Episodic. Our <Link href="/import-tv-time-data">step-by-step guide to exporting your TV Time data</Link> covers every click, including what to write in the request. Once you have the file, the import itself runs in your browser in seconds.
        </p>

        <h2>What it costs</h2>
        <p>
          The core app is free forever. An optional Supporter plan covers sync and extras and funds development; see <Link href="/pricing">pricing</Link> for the details. Nothing you need to track, import or export is behind it.
        </p>
      </Prose>
      <ClosingCta title="Bring your shows home." />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESC,
          mainEntityOfPage: `${SITE_URL}/tv-time-alternative`,
        }}
      />
    </article>
  );
}
