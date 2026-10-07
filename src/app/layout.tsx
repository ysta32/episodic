import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Episodic: free TV tracker, built for TV Time refugees",
    template: "%s | Episodic",
  },
  description:
    "Episodic is a free, local-first, open source TV and movie tracker. Import your TV Time history in one click and keep every episode reaction.",
  applicationName: "Episodic",
  openGraph: {
    type: "website",
    siteName: "Episodic",
    url: siteUrl,
    title: "Episodic: your shows survived TV Time",
    description:
      "Free, local-first, open source TV tracker with one-click TV Time import.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0b0b10" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
