import type { ReactNode } from "react";
import { CtaPair } from "./Buttons";
import { Reveal } from "./Reveal";

export function ArticleHero({ eyebrow, title, lead, meta }: { eyebrow: string; title: string; lead: string; meta?: string }) {
  return (
    <header className="k-grain k-keylight border-b border-line">
      <Reveal />
      <div className="mx-auto max-w-(--k-content-max) px-(--k-gutter) pb-16 pt-16 sm:pb-20 sm:pt-24">
        <p className="k-slate k-rise text-accent-ink">{eyebrow}</p>
        <h1 className="mt-5 max-w-[18ch] text-balance font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.025em] sm:text-[clamp(2.75rem,1.6rem+4vw,4.5rem)]">
          <span className="k-title-line">
            <span style={{ ["--k-delay" as string]: "60ms" }}>{title}</span>
          </span>
        </h1>
        <p className="k-rise mt-6 max-w-[56ch] text-k-md leading-relaxed text-text-2" style={{ ["--k-delay" as string]: "220ms" }}>
          {lead}
        </p>
        <div className="k-rise mt-8" style={{ ["--k-delay" as string]: "320ms" }}>
          <CtaPair />
        </div>
        {meta && <p className="k-slate mt-10 text-text-3">{meta}</p>}
      </div>
    </header>
  );
}

/** Long-form reading column. Body copy in the text face; headings in the display serif. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        "mx-auto max-w-[44rem] space-y-5 px-(--k-gutter) py-16 text-k-md leading-[1.7] text-text",
        "[&_h2]:mt-16 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-k-2xl [&_h2]:font-medium [&_h2]:leading-tight [&_h2]:tracking-[-0.02em]",
        "[&_h3]:mt-8 [&_h3]:text-k-md [&_h3]:font-semibold",
        "[&_p]:text-text-2 [&_li]:text-text-2 [&_strong]:text-text [&_strong]:font-semibold",
        "[&_a]:text-info [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-[3px] hover:[&_a]:decoration-2",
        "[&_ul]:list-none [&_ul]:space-y-3 [&_ul]:pl-0 [&_ul>li]:relative [&_ul>li]:pl-6",
        "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.8em] [&_ul>li]:before:h-px [&_ul>li]:before:w-3 [&_ul>li]:before:bg-accent",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function Steps({ items }: { items: ReadonlyArray<{ name: string; text: string }> }) {
  return (
    <ol className="!mt-8 divide-y divide-line border-y border-line">
      {items.map((s, i) => (
        <li key={s.name} data-reveal className="grid grid-cols-[3rem_1fr] gap-x-4 py-6" style={{ ["--k-delay" as string]: `${i * 40}ms` }}>
          <span aria-hidden className="font-display text-k-2xl font-medium italic leading-none text-accent-ink">
            {i + 1}
          </span>
          <div>
            <h3 className="!mt-0 text-k-md font-semibold">{s.name}</h3>
            <p className="mt-1.5">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ClosingCta({ title, body }: { title: string; body?: string }) {
  return (
    <section aria-label="Get started" className="k-grain border-t border-line bg-surface">
      <div data-reveal className="mx-auto flex max-w-(--k-content-max) flex-col items-start gap-8 px-(--k-gutter) py-20 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="max-w-[20ch] font-display text-k-3xl font-medium leading-[1.05] tracking-[-0.02em]">{title}</h2>
          {body && <p className="mt-4 max-w-[52ch] text-k-md text-text-2">{body}</p>}
        </div>
        <CtaPair className="shrink-0" />
      </div>
    </section>
  );
}
