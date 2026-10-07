import { OG_SIZE, renderOg } from "@/components/marketing/og";

export const alt = "Episodic: TV Time is gone. Your history doesn't have to be.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOg({
    slate: "Signal lost · 07.15.2026",
    title: "TV Time is gone.",
    accent: "Your history doesn't have to be.",
    sub: "Free, local-first, open source TV tracker. Import your TV Time export.",
  });
}
