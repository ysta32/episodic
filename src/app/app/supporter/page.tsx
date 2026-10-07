"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import {
  billingEnabled,
  SUPPORTER_PERKS,
  SUPPORTER_PRICE,
} from "@/lib/billing/flags";
import { getSettings, updateSettings } from "@/lib/lists";

export default function SupporterPage() {
  const settings = useLiveQuery(() => getSettings());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const billing = billingEnabled();

  async function joinWaitlist() {
    setBusy(true);
    setError("");
    try {
      await updateSettings({ supporterWaitlist: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save your interest. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-bg p-4 text-text sm:p-8">
      <header className="space-y-3">
        <p className="text-accent">Episodic Supporter</p>
        <h1 className="text-3xl font-semibold">
          Help keep your watch history yours.
        </h1>
        <p className="text-muted">
          The core stays free forever. Optional supporter subscriptions are how
          we plan to pay for hosting, maintenance, and continued development.
        </p>
      </header>
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold">
          A tracker needs a sustainable business
        </h2>
        <p className="text-muted">
          If you are moving from TV Time, you deserve a home for your history
          that you can trust. We cannot speak to another company’s finances.
          Free services still cost money to run, and when a service disappears,
          years of tracking can go with it.
        </p>
        <p className="text-muted">
          Our approach is to keep your data on your device, let you export it,
          and fund the work through optional paid extras. Your core tracking
          stays free.
        </p>
      </section>
      <section
        className="space-y-4 rounded-2xl border border-border bg-surface p-5"
        aria-labelledby="perks-heading"
      >
        <h2 id="perks-heading" className="text-xl font-semibold">
          Planned supporter perks
        </h2>
        <p className="text-2xl font-semibold">
          ${SUPPORTER_PRICE.monthly}/mo{" "}
          <span className="text-base font-normal text-muted">
            or ${SUPPORTER_PRICE.yearly}/yr ({SUPPORTER_PRICE.currency})
          </span>
        </p>
        <ul className="list-disc space-y-2 pl-5 text-muted">
          {SUPPORTER_PERKS.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          These perks are coming soon. No payment is collected on this page.
        </p>
        {!settings ? (
          <p role="status">Loading preferences…</p>
        ) : settings.supporterWaitlist ? (
          <p role="status">
            Thanks for your interest! Your waitlist preference is saved on this
            device. Check back here for launch news; we have not collected
            contact details.
          </p>
        ) : !billing ? (
          <>
            <button
              onClick={() => void joinWaitlist()}
              disabled={busy}
              className="min-h-11 rounded-xl bg-accent px-5 py-2 font-semibold text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Join waitlist"}
            </button>
            <p className="text-sm text-muted">
              This saves your interest locally. It does not create an account or
              subscribe you to a mailing list.
            </p>
          </>
        ) : (
          <p role="status" className="text-muted">
            Checkout is not available yet. Please check back for launch news.
          </p>
        )}
        {error && (
          <p role="alert" className="text-accent">
            {error}
          </p>
        )}
      </section>
      <Link
        href="/app/profile"
        className="inline-flex min-h-11 items-center rounded-xl text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Back to profile
      </Link>
    </main>
  );
}
