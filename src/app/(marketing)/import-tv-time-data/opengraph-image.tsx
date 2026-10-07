import { OG_SIZE, renderOg } from "@/components/marketing/og";

export const alt = "How to export your TV Time data and import it into Episodic.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOg({
    slate: "Guide",
    title: "Get your TV Time data",
    accent: "back. Step by step.",
    sub: "Request the export, keep the zip, drop it into Episodic.",
  });
}
