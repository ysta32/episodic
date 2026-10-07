import type { Metadata } from "next";
import Link from "next/link";
import { ArticleHero, ClosingCta, Prose, Steps } from "@/components/marketing/Article";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL } from "@/components/marketing/site";

const TITLE = "How to export your TV Time data and import it into Episodic";
const DESC =
  "Step-by-step guide to requesting your TV Time GDPR data export, unpacking the zip file and importing your shows and watched episodes into Episodic.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/import-tv-time-data" },
  openGraph: { type: "article", url: "/import-tv-time-data", title: TITLE, description: DESC },
};

const STEPS = [
  { name: "Send a data access request to TV Time", text: "Use the privacy or data request option in TV Time's help pages, or email their support or privacy contact. State that you are exercising your GDPR right of access (Article 15) and the right to data portability (Article 20), and ask for a machine-readable copy of all your data." },
  { name: "Confirm your identity", text: "Reply from the email address tied to your TV Time account and include your username. They may ask for extra verification before releasing anything." },
  { name: "Wait for the download link", text: "Companies have up to one month to respond. When it arrives you will get a link or attachment containing a zip file." },
  { name: "Download the zip and leave it intact", text: "Save the zip somewhere easy to find. There is no need to unzip it or edit any files, since Episodic reads the archive directly." },
  { name: "Open the Episodic import screen", text: "Go to Episodic, choose Import, and pick TV Time. You can also use the Import from TV Time button on this page." },
  { name: "Upload the file and review the matches", text: "Drop the zip onto the page. Episodic matches each show to its catalog entry, restores watched episodes with dates and shows a summary. Fix any unmatched titles by hand, then confirm." },
];

export default function Page() {
  return (
    <article>
      <ArticleHero
        eyebrow="Guide"
        title="Export your TV Time data and import it into Episodic"
        lead="TV Time is gone, but your watch history does not have to be. Here is exactly how to request your data export and bring every show and episode with you."
      />
      <Prose>
        <h2>Why you still have a way to get your data</h2>
        <p>
          When TV Time shut down on July 15, 2026, millions of people worried that years of viewing history had vanished. In most cases it has not. Under the European GDPR and similar laws in the UK, California and elsewhere, a company that holds personal data about you must hand it over when you ask. That includes every show you followed and every episode you marked as watched, with dates and ratings.
        </p>
        <p>
          The result arrives as a zip file of structured data. Episodic is built to read that file, so you never have to copy a list by hand.
        </p>

        <h2>Before you start</h2>
        <ul>
          <li>Find the email address you used to sign up for TV Time. Requests from any other address will be rejected.</li>
          <li>Remember your username, which helps support locate the account quickly.</li>
          <li>Be patient. Since the shutdown, support teams can be slow, so send the request as soon as you can.</li>
        </ul>

        <h2>Step by step: request and import</h2>
        <Steps items={STEPS} />

        <h2>What to write in your request</h2>
        <p>
          Keep the message short and specific. Something like the following works well: &ldquo;I am requesting a copy of all personal data you hold about my account (username, email), including my followed shows, watched episodes, ratings and comments, in a structured, commonly used, machine-readable format, under GDPR Articles 15 and 20.&rdquo; Mentioning both articles makes it clear you want a portable file, not a screenshot or a summary.
        </p>

        <h2>What gets imported</h2>
        <p>
          Episodic restores the things that make a tracker useful: your watch history with dates, ratings where the file includes them, the shows you follow and your watchlist, favorites, and lists. Because Episodic is local-first, the import runs in your browser. Your archive is not uploaded to a server for processing, and the data lands in your own library on your device.
        </p>
        <p>
          What doesn&apos;t come across: your TV Time reactions and comments. Episodic has its own per-episode reactions and threads, so you can keep reacting from here on, but those start fresh.
        </p>

        <h2>Troubleshooting</h2>
        <h3>The request is taking a long time</h3>
        <p>
          The legal deadline is one month, extendable in complex cases. If you hear nothing, send a polite follow-up that quotes your original request date. You may also contact your national data protection authority if a company ignores a valid request.
        </p>
        <h3>Some shows did not match</h3>
        <p>
          Obscure or renamed titles occasionally need a manual match. The review screen lets you search the catalog and pick the right entry, and you can always add a missing show later.
        </p>
        <h3>I only have a partial export</h3>
        <p>
          Import what you have. You can run another import later, and Episodic merges rather than duplicates, so nothing already in your library is overwritten.
        </p>
        <h3>I used Trakt, Simkl, Letterboxd or IMDb as well</h3>
        <p>
          Those exports are supported too. Bring everything into one place, then keep a copy by exporting from Episodic whenever you like.
        </p>

        <h2>After the import</h2>
        <p>
          Open Up Next to see the next unwatched episode for every show, check the calendar for upcoming air dates and install Episodic to your home screen as a PWA. Looking at other options first? Read our <Link href="/tv-time-alternative">comparison of TV Time alternatives</Link> or see the <Link href="/pricing">pricing</Link>: the core app is free forever.
        </p>
      </Prose>
      <ClosingCta title="Got your file? Import it now." />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: TITLE,
          description: DESC,
          url: `${SITE_URL}/import-tv-time-data`,
          totalTime: "P30D",
          step: STEPS.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }}
      />
    </article>
  );
}
