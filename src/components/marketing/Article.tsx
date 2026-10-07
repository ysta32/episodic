import type { ReactNode } from "react";
import { CtaPair } from "./Buttons";

export function ArticleHero({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <header className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="pointer-events-none absolute -top-32 right-0 size-96 rounded-full bg-accent2/25 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{lead}</p>
        <div className="mt-8"><CtaPair /></div>
      </div>
    </header>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-12 text-[1.0625rem] leading-relaxed text-text/90 sm:px-6 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-text [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
      {children}
    </div>
  );
}

export function Steps({ items }: { items: ReadonlyArray<{ name: string; text: string }> }) {
  return (
    <ol className="space-y-4">
      {items.map((s, i) => (
        <li key={s.name} className="flex gap-4 rounded-2xl border border-border bg-surface p-5">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-ink">
            {i + 1}
          </span>
          <div>
            <h3 className="!mt-0 font-semibold">{s.name}</h3>
            <p className="mt-1 text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ClosingCta({ title }: { title: string }) {
  return (
    <section aria-label="Get started" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-accent2/20 p-8 text-center">
        <h2 className="text-2xl font-bold">{title}</h2>
        <div className="mt-6 flex justify-center"><CtaPair /></div>
      </div>
    </section>
  );
}
