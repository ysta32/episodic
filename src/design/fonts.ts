import { Martian_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";

/**
 * Kinescope type pairing (see docs/DESIGN.md §4.1).
 * Apply `fontVariables` to <html> or <body>; tokens.css maps these into --k-font-*.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-newsreader",
});

export const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted",
});

export const martian = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-martian",
});

export const fontVariables = `${newsreader.variable} ${schibsted.variable} ${martian.variable}`;
