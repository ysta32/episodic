import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { billingEnabled, SUPPORTER_PERKS, SUPPORTER_PRICE } from "@/lib/billing/flags";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ClosingCta } from "@/components/marketing/Article";
import { OpenAppButton } from "@/components/marketing/Buttons";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Reveal } from "@/components/marketing/Reveal";
import { formatPrice, PRICE_MONTHLY, PRICE_YEARLY, REPO_URL, SITE_URL } from "@/components/marketing/site";

const DESC = `Episodic's tracker is free, with no ads. Supporter is ${PRICE_MONTHLY}/month or ${PRICE_YEARLY}/year and pays for the parts that need a server.`;

export const metadata: Metadata = {
  title: "Pricing: free tracker, optional Supporter plan",
  description: DESC,
  alternates: { canonical: "/pricing" },
  openGraph: { url: "/pricing", title: "Episodic pricing", description: DESC },
};

const delay = (ms: number): CSSProperties => ({ ["--k-delay" as string]: `${ms}ms` });

const FREE = [
  "Unlimited shows, films and lists",
  "Import from TV Time, Trakt, Simkl, Letterboxd, IMDb and CSV",
  "Up Next, calendar, progress and ratings",
  "Spoiler Shield and per-episode reactions",
  "Installable app that works offline",
  "Full JSON and CSV export, any time",
] as const;

/** Where the money goes, by kind of cost. No figures are quoted that we can't show. */
const COSTS = [
  {
    what: "Show information",
    why: "Posters, episode lists and air dates come from TVmaze and TMDB through a cached proxy. Caching keeps those calls, and their cost, low.",
    who: "Everyone",
  },
  {
    what: "Reactions and threads",
    why: "Shared by nature, so they need a server, a database and moderation.",
    who: "Everyone",
  },
  {
    what: "Cloud sync",
    why: "Keeping a library in step across devices means storing a copy of it. That's real storage per person, which is why it's the Supporter perk.",
    who: "Supporters",
  },
  {
    what: "Your library",
    why: "Lives on your device. It costs us nothing to store, and nothing has to keep running for it to stay yours.",
    who: "Free",
  },
] as const;

export default function PricingPage() {
  const yearlySaving = SUPPORTER_PRICE.monthly * 12 - SUPPORTER_PRICE.yearly;
  const checkoutOpen = billingEnabled();
  return (
    <>
      <Reveal />
      <header className="k-grain k-keylight border-b border-line">
        <div className="mx-auto max-w-(--k-content-max) px-(--k-gutter) pb-16 pt-16 sm:pb-20 sm:pt-24">
          <p className="k-slate k-rise text-accent-ink">Pricing</p>
          <h1 className="mt-5 max-w-[16ch] font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.025em] sm:text-[clamp(2.75rem,1.6rem+4vw,4.5rem)]">
            <span className="k-title-line">
              <span style={delay(60)}>The tracker is free.</span>
            </span>
            <span className="k-title-line">
              <span style={delay(180)} className="italic text-accent-ink">
                The servers aren&apos;t.
              </span>
            </span>
          </h1>
          <p className="k-rise mt-6 max-w-[56ch] text-k-md leading-relaxed text-text-2" style={delay(300)}>
            Everything you need to track, import and export is free, with no ads and nothing sold. A Supporter plan pays for the few parts that need a server.
          </p>
        </div>
      </header>

      {/* Plans: free is the default, so it leads */}
      <section aria-label="Plans" className="mx-auto max-w-(--k-content-max) px-(--k-gutter) py-20">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <section data-reveal aria-labelledby="free" className="rounded-k-lg border border-line bg-surface p-8 shadow-[inset_0_1px_0_var(--k-highlight)] sm:p-10">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="free" className="font-display text-k-2xl font-medium italic">
                Free
              </h2>
              <span className="k-slate text-text-3">For everyone, for good</span>
            </div>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="k-tabular font-display text-[clamp(3rem,2rem+4vw,4.5rem)] font-medium leading-none tracking-[-0.03em]">
                {formatPrice(0)}
              </span>
              <span className="text-k-base text-text-2">no card, no account</span>
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2.5 text-k-base">
                  <Icon name="check" size={18} strokeWidth={2.25} className="mt-0.5 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <OpenAppButton variant="primary" />
            </div>
          </section>

          <section
            data-reveal
            style={delay(100)}
            aria-labelledby="supporter"
            className="k-ink k-grain relative overflow-hidden rounded-k-lg border border-line p-8 sm:p-10"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="supporter" className="font-display text-k-2xl font-medium italic">
                Supporter
              </h2>
              <span className="k-slate text-accent-ink">Optional</span>
            </div>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="k-tabular font-display text-[clamp(3rem,2rem+4vw,4.5rem)] font-medium leading-none tracking-[-0.03em]">
                {PRICE_MONTHLY}
              </span>
              <span className="text-k-base text-text-2">a month</span>
            </p>
            <p className="k-tabular mt-2 text-k-sm text-text-2">
              or {PRICE_YEARLY} a year{yearlySaving > 0 ? `, which saves ${formatPrice(yearlySaving)}` : ""} ({SUPPORTER_PRICE.currency})
            </p>
            <ul className="mt-8 space-y-3">
              <li className="flex gap-2.5 text-k-base text-text-2">
                <Icon name="check" size={18} strokeWidth={2.25} className="mt-0.5 text-accent" />
                Everything in Free
              </li>
              {SUPPORTER_PERKS.map((p) => (
                <li key={p} className="flex gap-2.5 text-k-base">
                  <Icon name="check" size={18} strokeWidth={2.25} className="mt-0.5 text-accent" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              {checkoutOpen ? (
                <Link href="/app/supporter" className={buttonClasses("primary", "lg")}>
                  Become a Supporter
                </Link>
              ) : (
                <p className="border-l-2 border-accent pl-4 text-k-sm leading-relaxed text-text-2">
                  Checkout isn&apos;t open yet. When it is, it&apos;ll appear in the app under Supporter. Nothing in Free will move behind it.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>

      {/* The economics */}
      <section aria-labelledby="why" className="border-t border-line">
        <div className="mx-auto grid max-w-(--k-content-max) gap-12 px-(--k-gutter) py-24 lg:grid-cols-[1fr_1.6fr]">
          <div data-reveal>
            <p className="k-slate text-accent-ink">Why it costs anything</p>
            <h2 id="why" className="mt-5 font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.025em]">
              Free apps still get a bill.
            </h2>
          </div>
          <div data-reveal style={delay(100)} className="space-y-5 text-k-md leading-relaxed text-text-2">
            <p>
              A tracker that keeps everyone&apos;s history on its own servers pays for that storage every month, for every user, forever. That money has to come from somewhere: ads, selling data, or a subscription. And whatever the reason a service closes, the result for its users is the same: the histories go with it. TV Time users found that out on July 15, 2026.
            </p>
            <p>
              Episodic is built so that equation doesn&apos;t apply to the part you care about. Your library lives on your device, so it doesn&apos;t cost us anything to keep, and it doesn&apos;t depend on us staying in business. The code is{" "}
              <a href={REPO_URL} rel="noopener" className="text-info underline underline-offset-[3px]">
                open source
              </a>
              , so even the app can outlive the project.
            </p>
            <p className="text-text">What&apos;s left is small, and Supporters pay for it:</p>
          </div>
        </div>

        <div className="mx-auto max-w-(--k-content-max) px-(--k-gutter) pb-24">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">What runs on a server, why, and who it serves</caption>
              <thead>
                <tr className="border-b border-line-strong">
                  <th scope="col" className="k-slate py-3 pr-6 font-normal text-text-3">
                    What
                  </th>
                  <th scope="col" className="k-slate py-3 pr-6 font-normal text-text-3">
                    Why it costs money
                  </th>
                  <th scope="col" className="k-slate py-3 font-normal text-text-3">
                    For
                  </th>
                </tr>
              </thead>
              <tbody>
                {COSTS.map((c, i) => (
                  <tr key={c.what} data-reveal style={delay(i * 60)} className="border-b border-line align-top">
                    <th scope="row" className="py-5 pr-6 font-display text-k-lg font-medium">
                      {c.what}
                    </th>
                    <td className="max-w-[56ch] py-5 pr-6 text-k-base leading-relaxed text-text-2">{c.why}</td>
                    <td className="py-5">
                      <span className="k-slate whitespace-nowrap text-text-2">{c.who}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-[64ch] text-k-sm leading-relaxed text-text-3">
            We don&apos;t publish a cost figure here because we&apos;d rather show real bills than estimates. The code is in the repository, so you can see exactly what runs on a server and what doesn&apos;t.
          </p>
        </div>
      </section>

      {/* Promises */}
      <section aria-labelledby="promises" className="border-t border-line bg-surface-2/50">
        <div className="mx-auto max-w-(--k-content-max) px-(--k-gutter) py-24">
          <h2 id="promises" data-reveal className="max-w-[22ch] font-display text-k-2xl font-medium leading-tight tracking-[-0.02em]">
            What we won&apos;t do, whatever the bill says.
          </h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["No ads", "Not in the free tier, not anywhere."],
              ["No selling data", "We don't hold your library, and we wouldn't sell it if we did."],
              ["No paywalled export", "JSON and CSV export stay free, always."],
              ["No moving the goalposts", "Features in Free stay in Free."],
            ].map(([t, d], i) => (
              <li key={t} data-reveal style={delay(i * 60)} className="border-t border-line-strong pt-4">
                <p className="text-k-md font-semibold">{t}</p>
                <p className="mt-1.5 text-k-sm leading-relaxed text-text-2">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingCta title="Start free. Decide about the rest later." body="Import your history first. Supporter will still be here if you want sync." />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Episodic",
          url: `${SITE_URL}/pricing`,
          offers: [
            { "@type": "Offer", name: "Free", price: "0", priceCurrency: SUPPORTER_PRICE.currency },
            { "@type": "Offer", name: "Supporter (monthly)", price: String(SUPPORTER_PRICE.monthly), priceCurrency: SUPPORTER_PRICE.currency },
            { "@type": "Offer", name: "Supporter (yearly)", price: String(SUPPORTER_PRICE.yearly), priceCurrency: SUPPORTER_PRICE.currency },
          ],
        }}
      />
    </>
  );
}
