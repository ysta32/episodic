import { Icon } from "@/components/ui/Icon";
import { FAQS } from "./site";
import { JsonLd } from "./JsonLd";

export function Faq({ id = "faq", title = "Questions, answered" }: { id?: string; title?: string }) {
  return (
    <section aria-labelledby={id} className="mx-auto grid max-w-(--k-content-max) gap-10 px-(--k-gutter) py-24 lg:grid-cols-[1fr_2fr]">
      <div data-reveal>
        <p className="k-slate text-accent-ink">FAQ</p>
        <h2 id={id} className="mt-3 font-display text-k-3xl font-medium leading-[1.05] tracking-[-0.02em]">
          {title}
        </h2>
      </div>
      <div data-reveal style={{ ["--k-delay" as string]: "80ms" }} className="divide-y divide-line border-y border-line">
        {FAQS.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-k-md font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}
              <Icon name="plus" size={18} className="text-accent-ink transition-transform duration-(--k-dur-2) ease-k-out group-open:rotate-45" />
            </summary>
            <p className="max-w-(--k-measure) pb-5 leading-relaxed text-text-2">{f.a}</p>
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
