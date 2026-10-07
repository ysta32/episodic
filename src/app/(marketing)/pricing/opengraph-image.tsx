import { OG_SIZE, renderOg } from "@/components/marketing/og";
import { PRICE_MONTHLY, PRICE_YEARLY } from "@/components/marketing/site";

export const alt = "Episodic pricing: the tracker is free, Supporter is optional.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOg({
    slate: "Pricing",
    title: "The tracker is free.",
    accent: "The servers aren't.",
    sub: `Free, no ads. Optional Supporter: ${PRICE_MONTHLY}/month or ${PRICE_YEARLY}/year.`,
  });
}
