import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Kinescope OG card: ink stock, tungsten key light, broadcast slate, title-card headline. */
export function renderOg({ slate, title, accent, sub }: { slate: string; title: string; accent?: string; sub: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(ellipse 70% 70% at 88% -10%, rgba(240,170,60,0.28) 0%, #100f0d 62%)",
          color: "#f2ede3",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 18, height: 18, borderRadius: 3, background: "#f0aa3c" }} />
            <div style={{ fontSize: 40, fontStyle: "italic", letterSpacing: "-0.02em" }}>Episodic</div>
          </div>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 20, letterSpacing: "0.08em", color: "#aba393" }}>
            {slate.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 84, lineHeight: 1.02, letterSpacing: "-0.03em" }}>{title}</div>
          {accent && (
            <div style={{ display: "flex", fontSize: 84, lineHeight: 1.02, letterSpacing: "-0.03em", fontStyle: "italic", color: "#f5b95a" }}>
              {accent}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", height: 8, gap: 14 }}>
            {Array.from({ length: 34 }, (_, i) => (
              <div key={i} style={{ width: 18, height: 8, background: "#3d382f" }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#aba393", fontFamily: "sans-serif" }}>{sub}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
