import { FAQS } from "./site";
import { JsonLd } from "./JsonLd";

export function Faq() {
  return (
    <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 id="faq" className="text-3xl font-bold tracking-tight">Questions, answered</h2>
      <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-surface">
        {FAQS.map((f) => (
          <details key={f.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <span aria-hidden className="text-accent transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
    </section>
  );
}
