const COLS = ["Episodic", "Trakt", "Simkl", "TV Time"] as const;
const ROWS: ReadonlyArray<{ feature: string; cells: readonly [string, string, string, string] }> = [
  { feature: "Status", cells: ["Active", "Active", "Active, often slow under load", "Shut down July 15, 2026"] },
  { feature: "Free tier", cells: ["Full core, forever", "Limited (list and feature caps)", "Free with ads and limits", "n/a"] },
  { feature: "Open source", cells: ["Yes", "No", "No", "No"] },
  { feature: "Local-first / offline", cells: ["Yes", "No", "No", "No"] },
  { feature: "TV Time import", cells: ["One click", "Via third-party tools", "Partial", "n/a"] },
  { feature: "Per-episode reactions", cells: ["Yes", "Comments only", "No", "Yes"] },
  { feature: "Export your data", cells: ["Anytime, free", "Paid for full export", "Limited", "n/a"] },
  { feature: "Paid plan", cells: ["Optional, $2/mo", "VIP, paid", "Pro, paid", "n/a"] },
];

export function Comparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">Episodic compared with Trakt, Simkl and TV Time</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="p-4 font-medium text-muted">Feature</th>
            {COLS.map((c) => (
              <th key={c} scope="col" className={`p-4 font-semibold ${c === "Episodic" ? "text-accent" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.feature} className="border-b border-border last:border-0">
              <th scope="row" className="p-4 font-medium">{r.feature}</th>
              {r.cells.map((c, i) => (
                <td key={i} className={`p-4 ${i === 0 ? "bg-accent/5 font-medium" : "text-muted"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border p-4 text-xs text-muted">
        Based on publicly listed plans at the time of writing. Competitor plans change, so check their sites for current limits.
      </p>
    </div>
  );
}
