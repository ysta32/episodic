import { OG_SIZE, renderOg } from "@/components/marketing/og";

export const alt = "The TV Time alternative that can't take your history with it.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOg({
    slate: "TV Time alternatives",
    title: "Looking for a TV Time",
    accent: "alternative? Start here.",
    sub: "An honest comparison of Episodic, Trakt and Simkl.",
  });
}
