import { ImageResponse } from "next/og";

export const alt = "Episodic: your shows survived TV Time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background:
            "radial-gradient(circle at 85% 10%, #3a2a8f 0%, #0b0b10 55%)",
          color: "#ececf1",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, color: "#ff5d73", fontWeight: 700 }}>
          Episodic
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>
          Your shows survived TV Time.
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.05, color: "#ff5d73" }}>
          Your history should too.
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#9a9aad", marginTop: 36 }}>
          Free. Local-first. Open source. One-click TV Time import.
        </div>
      </div>
    ),
    size,
  );
}
