import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SiteFooter, SiteHeader, SkipLink } from "@/components/marketing/Chrome";
import { CtaPair, ImportButton, OpenAppButton } from "@/components/marketing/Buttons";
import { Faq } from "@/components/marketing/Faq";
import { ImportDemo } from "@/components/marketing/ImportDemo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { EpisodeListPreview, ReactionPreview, UpNextPreview } from "@/components/marketing/Previews";
import { Reveal } from "@/components/marketing/Reveal";
import { MIGRATES, REPO_URL, SITE_URL } from "@/components/marketing/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const delay = (ms: number): CSSProperties => ({ ["--k-delay" as string]: `${ms}ms` });

function Eyebrow({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="k-slate flex items-center gap-3 text-accent-ink">
      <span className="text-text-3">{n}</span>
      <span aria-hidden className="h-px w-8 bg-current opacity-50" />
      {children}
    </p>
  );
}

const PROOF: { icon: IconName; title: string; body: ReactNode }[] = [
  {
    icon: "external",
    title: "Open source, MIT licensed",
    body: (
      <>
        Every line is public. Read how import and storage work, or run your own copy.{" "}
        <a href={REPO_URL} rel="noopener" className="text-info underline underline-offset-[3px]">
          View the source
        </a>
      </>
    ),
  },
  { icon: "offline", title: "Works offline", body: "Your library is in IndexedDB on this device, so it opens on a plane and in a tunnel." },
  { icon: "user", title: "No account needed", body: "Open the app and start. There's no sign-up wall between you and your own history." },
  { icon: "export", title: "Export in one click", body: "A full JSON backup or a CSV of everything you've watched. Any time, free, no waiting." },
];

const FEATURES: { name: string; body: string; slate: string; status?: string }[] = [
  {
    name: "Import from anywhere",
    body: "TV Time, Trakt, Simkl, Letterboxd and IMDb exports, plus plain CSV. Run as many as you like; repeats merge instead of doubling up.",
    slate: "6 formats",
  },
  {
    name: "Rewind",
    body: "Your whole viewing life as a timeline: years, months and the weekends you binged a season in two nights. Computed on your device.",
    slate: "Timeline",
  },
  {
    name: "Spoiler Shield",
    body: "Episodic knows where you are in every show. Titles, synopses and thread posts past that point stay redacted until you choose to look.",
    slate: "Per show",
  },
  {
    name: "Episode Pulse",
    body: "A small curve of when people reacted during an episode, so you can see where the room gasped. Hidden until you've watched it.",
    slate: "Per episode",
  },
  {
    name: "Calendar",
    body: "What airs this week for the shows you follow, next to what's already waiting in Up Next.",
    slate: "Weekly",
  },
  {
    name: "Stats",
    body: "Episodes, hours and streaks, worked out from your own history rather than an estimate.",
    slate: "Yours only",
  },
  {
    name: "Browser extension",
    body: "Mark episodes watched from the streaming site you're already on.",
    slate: "Extension",
    status: "Coming",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <Reveal />
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* HOOK ------------------------------------------------------------ */}
        <section aria-labelledby="hook" className="k-grain k-keylight relative overflow-hidden border-b border-line">
          <div className="mx-auto flex min-h-[min(88svh,56rem)] max-w-(--k-content-max) flex-col justify-between px-(--k-gutter) pb-10 pt-14 sm:pt-20">
            <p className="k-slate k-rise flex items-center gap-2 text-text-2">
              <span aria-hidden className="size-1.5 rounded-full bg-danger" />
              Signal lost · July 15, 2026
            </p>
            <div className="py-12">
              <h1
                id="hook"
                className="font-display text-k-hero font-medium leading-[0.95] tracking-[-0.035em] [font-variation-settings:'opsz'_72]"
              >
                <span className="k-title-line">
                  <span style={delay(80)}>TV Time is gone.</span>
                </span>
                <span className="k-title-line">
                  <span style={delay(220)} className="italic text-accent-ink">
                    Your history doesn&apos;t
                  </span>
                </span>
                <span className="k-title-line">
                  <span style={delay(340)} className="italic text-accent-ink">
                    have to be.
                  </span>
                </span>
              </h1>
              <p className="k-rise mt-8 max-w-[46ch] text-k-md leading-relaxed text-text-2 sm:text-k-lg" style={delay(520)}>
                Episodic is a free, open source tracker for TV and film. Bring your TV Time export and it stays on your device, where no shutdown can reach it.
              </p>
              <div className="k-rise mt-10" style={delay(640)}>
                <CtaPair />
              </div>
            </div>
            <ul className="k-rise k-slate flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-text-3" style={delay(760)}>
              <li>Free, no ads</li>
              <li>Local-first</li>
              <li>Open source (MIT)</li>
              <li>No account needed</li>
              <li>Works offline</li>
            </ul>
          </div>
        </section>

        {/* PROBLEM --------------------------------------------------------- */}
        <section aria-labelledby="problem" className="k-ink k-grain relative overflow-hidden">
          <div className="mx-auto grid max-w-(--k-content-max) gap-12 px-(--k-gutter) py-24 sm:py-32 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <div data-reveal>
              <Eyebrow n="01">The shutdown</Eyebrow>
              <p
                aria-hidden
                className="k-tabular mt-8 font-display text-[clamp(4.5rem,2rem+12vw,11rem)] font-medium leading-[0.85] tracking-[-0.04em] text-text"
              >
                07<span className="text-text-3">.</span>15
                <span className="block text-text-3">2026</span>
              </p>
            </div>
            <div data-reveal style={delay(120)}>
              <h2 id="problem" className="font-display text-k-2xl font-medium leading-tight tracking-[-0.02em]">
                One day it worked. The next, about 25 million people&apos;s watch histories were locked behind a closed door.
              </h2>
              <div className="mt-6 space-y-4 text-k-md leading-relaxed text-text-2">
                <p>
                  TV Time shut down on July 15, 2026. Years of ticked-off episodes lived on its servers, and the only way out was a data request most people had never heard of.
                </p>
                <p>
                  Everyone went looking for somewhere else at once. The obvious alternatives hit rate limits, queued imports and slowed down under the load.
                </p>
              </div>
              <p className="mt-8 border-l-2 border-accent pl-4 text-k-lg font-medium text-text">
                A tracker shouldn&apos;t be able to take your history with it when it goes.
              </p>
            </div>
          </div>
          <div aria-hidden className="k-sprockets" />
        </section>

        {/* PRODUCT --------------------------------------------------------- */}
        <section aria-labelledby="product" className="mx-auto max-w-(--k-content-max) px-(--k-gutter) py-24 sm:py-32">
          <div data-reveal className="max-w-[40rem]">
            <Eyebrow n="02">The tracker</Eyebrow>
            <h2 id="product" className="mt-5 font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.025em]">
              Pick up <i>exactly</i> where you left off.
            </h2>
            <p className="mt-5 text-k-md leading-relaxed text-text-2">
              Up Next knows the next episode of everything you watch. Mark it with one key. Anything past where you are stays redacted.
            </p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-12 lg:gap-8">
            <figure data-reveal="cut" className="lg:col-span-7">
              <EpisodeListPreview />
              <figcaption className="mt-4 flex gap-3 text-k-sm text-text-2">
                <span className="k-slate text-accent-ink">Spoiler Shield</span>
                <span>Episode 5 is past your progress, so its title and synopsis are hidden. Press Reveal to peek.</span>
              </figcaption>
            </figure>
            <div className="grid gap-6 lg:col-span-5 lg:gap-8">
              <figure data-reveal="cut" style={delay(120)}>
                <UpNextPreview />
                <figcaption className="mt-4 flex gap-3 text-k-sm text-text-2">
                  <span className="k-slate text-accent-ink">Up next</span>
                  <span>One card per show, always on the right episode.</span>
                </figcaption>
              </figure>
              <figure data-reveal="cut" style={delay(220)}>
                <ReactionPreview />
                <figcaption className="mt-4 flex gap-3 text-k-sm text-text-2">
                  <span className="k-slate text-accent-ink">Reactions</span>
                  <span>React to each episode, then see the moments that landed.</span>
                </figcaption>
              </figure>
            </div>
          </div>
          <p className="k-slate mt-10 text-text-3">
            Previews use the app&apos;s real components. Show and episode names are from Severance (Apple TV+) for illustration.
          </p>
        </section>

        {/* PRODUCT: import demo -------------------------------------------- */}
        <section aria-labelledby="demo" className="k-grain border-y border-line bg-surface-2/50">
          <div className="mx-auto max-w-(--k-content-max) px-(--k-gutter) py-24 sm:py-32">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
              <div data-reveal>
                <Eyebrow n="03">The import</Eyebrow>
                <h2 id="demo" className="mt-5 font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.025em]">
                  See what comes back, before you commit.
                </h2>
                <p className="mt-5 text-k-md leading-relaxed text-text-2">
                  This box runs the real TV Time importer in your browser. Drop your export and you&apos;ll see your shows, episodes and dates. Nothing is saved or sent.
                </p>
                <div className="mt-8">
                  <p className="k-slate text-text-3">Comes across</p>
                  <ul className="mt-3 space-y-2">
                    {MIGRATES.map((m) => (
                      <li key={m} className="flex items-center gap-2.5 text-k-base">
                        <Icon name="check" size={16} className="text-success" strokeWidth={2.25} />
                        {m}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 max-w-[40ch] text-k-sm leading-relaxed text-text-3">
                    TV Time reactions and comments aren&apos;t part of what moves over. Your Episodic reactions start fresh.
                  </p>
                  <Link href="/import-tv-time-data" className="mt-6 inline-flex items-center gap-1.5 text-k-sm font-semibold text-accent-ink hover:underline">
                    Don&apos;t have your export yet? Here&apos;s how to get it
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </div>
              </div>
              <div data-reveal style={delay(120)}>
                <ImportDemo />
              </div>
            </div>
          </div>
        </section>

        {/* PROOF ----------------------------------------------------------- */}
        <section aria-labelledby="proof" className="mx-auto max-w-(--k-content-max) px-(--k-gutter) py-24 sm:py-32">
          <div data-reveal className="max-w-[44rem]">
            <Eyebrow n="04">Where your data goes</Eyebrow>
            <h2 id="proof" className="mt-5 font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.025em]">
              Nowhere you didn&apos;t send it.
            </h2>
            <p className="mt-5 text-k-md leading-relaxed text-text-2">
              Don&apos;t take that on trust. Here is the whole path, and the code is there to check it against.
            </p>
          </div>

          <DataFlow />

          <dl className="mt-16 grid gap-x-10 gap-y-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {PROOF.map((p, i) => (
              <div key={p.title} data-reveal style={delay(i * 70)}>
                <dt className="flex items-center gap-2.5 text-k-md font-semibold">
                  <Icon name={p.icon} size={18} className="text-accent-ink" />
                  {p.title}
                </dt>
                <dd className="mt-2 text-k-sm leading-relaxed text-text-2">{p.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* DEPTH ----------------------------------------------------------- */}
        <section aria-labelledby="depth" className="border-t border-line">
          <div className="mx-auto grid max-w-(--k-content-max) gap-12 px-(--k-gutter) py-24 sm:py-32 lg:grid-cols-[1fr_2fr]">
            <div data-reveal className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow n="05">Everything else</Eyebrow>
              <h2 id="depth" className="mt-5 font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.025em]">
                Built for people who watch a lot of television.
              </h2>
              <p className="mt-5 text-k-md leading-relaxed text-text-2">
                The table stakes, done properly, and a few things no other tracker does.
              </p>
            </div>
            <ol className="border-t border-line">
              {FEATURES.map((f, i) => (
                <li
                  key={f.name}
                  data-reveal
                  style={delay((i % 3) * 60)}
                  className="group grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-line py-7 sm:grid-cols-[3.5rem_1fr_auto]"
                >
                  <span aria-hidden className="k-slate k-tabular pt-2 text-text-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-k-xl font-medium italic tracking-[-0.01em] transition-transform duration-(--k-dur-2) ease-k-out group-hover:translate-x-1">
                      {f.name}
                      {f.status && (
                        <span className="k-slate ml-3 rounded-k-xs border border-line-strong px-1.5 py-0.5 align-middle not-italic text-text-2">
                          {f.status}
                        </span>
                      )}
                    </h3>
                    <p className="mt-2 max-w-[56ch] text-k-base leading-relaxed text-text-2">{f.body}</p>
                  </div>
                  <span className="k-slate col-start-2 mt-3 text-text-3 sm:col-start-3 sm:mt-2.5">{f.slate}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="border-t border-line">
          <Faq />
        </div>

        {/* ACTION ---------------------------------------------------------- */}
        <section aria-labelledby="action" className="k-ink k-grain relative overflow-hidden">
          <div aria-hidden className="k-sprockets" />
          <div className="k-keylight">
            <div className="mx-auto max-w-(--k-content-max) px-(--k-gutter) py-28 sm:py-36">
              <div data-reveal>
                <p className="k-slate text-accent-ink">Roll credits</p>
                <h2 id="action" className="mt-6 max-w-[14ch] font-display text-k-hero font-medium leading-[0.95] tracking-[-0.035em]">
                  Bring your history <i className="text-accent-ink">home.</i>
                </h2>
                <div className="mt-12 flex flex-col gap-3 min-[420px]:flex-row">
                  <ImportButton />
                  <OpenAppButton />
                </div>
                <p className="mt-6 text-k-sm text-text-3">Free. No account. Your data stays on your device.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Episodic",
          applicationCategory: "EntertainmentApplication",
          operatingSystem: "Web",
          url: SITE_URL,
          codeRepository: REPO_URL,
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
    </div>
  );
}

/** The path a TV Time export takes. Server hops are drawn as dashed and labelled with exactly what crosses them. */
function DataFlow() {
  const node = "rounded-k-md border bg-surface p-5 shadow-[inset_0_1px_0_var(--k-highlight)]";
  return (
    <figure className="mt-14">
      <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.3fr_auto_1fr]">
        <div data-reveal className={`${node} border-line`}>
          <p className="k-slate text-text-3">Input</p>
          <p className="mt-2 font-display text-k-lg font-medium">Your TV Time zip</p>
          <p className="mt-1 text-k-sm text-text-2">Or Trakt, Simkl, Letterboxd, IMDb, CSV</p>
        </div>
        <Arrow />
        <div data-reveal style={delay(120)} className={`${node} border-accent ring-4 ring-accent-wash`}>
          <p className="k-slate text-accent-ink">This browser tab</p>
          <p className="mt-2 font-display text-k-lg font-medium">Unzip, parse, merge</p>
          <p className="mt-1 text-k-sm text-text-2">Then saved to IndexedDB on this device. The file itself is never uploaded.</p>
        </div>
        <Arrow />
        <div data-reveal style={delay(240)} className={`${node} border-line`}>
          <p className="k-slate text-text-3">Output, any time</p>
          <p className="mt-2 font-display text-k-lg font-medium">JSON + CSV export</p>
          <p className="mt-1 text-k-sm text-text-2">Open formats you can take anywhere.</p>
        </div>
      </div>
      <div data-reveal style={delay(320)} className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-k-md border border-dashed border-line-strong p-5">
          <p className="k-slate text-text-3">Leaves the device: show lookups</p>
          <p className="mt-2 text-k-sm leading-relaxed text-text-2">
            To fetch posters, episode lists and air dates, the app asks TVmaze and TMDB through our proxy using a show&apos;s title or ID. Your history and ratings aren&apos;t part of that request.
          </p>
        </div>
        <div className="rounded-k-md border border-dashed border-line-strong p-5">
          <p className="k-slate text-text-3">Leaves the device: only if you post</p>
          <p className="mt-2 text-k-sm leading-relaxed text-text-2">
            Reactions and episode threads are shared by design, so what you post goes to the server. Opt-in Supporter sync is the only thing that would copy your library, and only once you turn it on.
          </p>
        </div>
      </div>
      <figcaption className="sr-only">
        Your export is read in the browser, stored in IndexedDB on your device and can be exported as JSON or CSV. Only show lookups, posted reactions and opt-in sync reach a server.
      </figcaption>
    </figure>
  );
}

function Arrow() {
  return (
    <div aria-hidden className="flex items-center justify-center text-text-3 md:px-1">
      <Icon name="chevron-right" size={20} className="rotate-90 md:rotate-0" />
    </div>
  );
}
