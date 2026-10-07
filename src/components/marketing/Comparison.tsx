import { PRICE_MONTHLY } from "./site";

const COLS = ["Episodic", "Trakt", "Simkl", "TV Time"] as const;
const ROWS: ReadonlyArray<{ feature: string; cells: readonly [string, string, string, string] }> = [
  { feature: "Status", cells: ["Active", "Active", "Active, strained by new sign-ups", "Shut down July 15, 2026"] },
  { feature: "Free tier", cells: ["Full tracker, no ads", "Yes, with limits", "Yes, with ads and limits", "n/a"] },
  { feature: "Open source", cells: ["Yes", "No", "No", "No"] },
  { feature: "Where your data lives", cells: ["Your device", "Their servers", "Their servers", "Gone"] },
  { feature: "Works offline", cells: ["Yes", "No", "No", "n/a"] },
  { feature: "Reads a TV Time export", cells: ["Yes, in your browser", "Via third-party tools", "Yes", "n/a"] },
  { feature: "Per-episode reactions", cells: ["Yes", "Comments only", "No", "Yes"] },
  { feature: "Export your data", cells: ["Anytime, JSON + CSV", "Check current plan", "Check current plan", "By request"] },
  { feature: "Paid plan", cells: [`Optional, from ${PRICE_MONTHLY}/mo`, "VIP", "Pro", "n/a"] },
];

export function Comparison() {
  return (
    <div className="overflow-x-auto rounded-k-md border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-k-sm">
        <caption className="sr-only">Episodic compared with Trakt, Simkl and TV Time</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="k-slate p-4 font-normal text-text-3">
              Feature
            </th>
            {COLS.map((c) => (
              <th
                key={c}
                scope="col"
                className={c === "Episodic" ? "bg-accent-wash/50 p-4 font-display text-k-md font-medium italic" : "p-4 font-semibold text-text-2"}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.feature} className="border-b border-line last:border-0">
              <th scope="row" className="p-4 font-medium">
                {r.feature}
              </th>
              {r.cells.map((c, i) => (
                <td key={i} className={i === 0 ? "bg-accent-wash/50 p-4 font-medium" : "p-4 text-text-2"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line p-4 text-k-xs text-text-3">
        Based on publicly listed plans when this was written. Other services change their plans, so check their sites for current limits.
      </p>
    </div>
  );
}
