import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/design/fonts";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Episodic: the TV tracker that outlives TV Time",
    template: "%s | Episodic",
  },
  description:
    "Episodic is a free, local-first, open source TV and movie tracker. Bring your TV Time history, ratings and watchlists. It stays on your device.",
  applicationName: "Episodic",
  openGraph: {
    type: "website",
    siteName: "Episodic",
    url: siteUrl,
    title: "Episodic: TV Time is gone. Your history doesn't have to be.",
    description: "Free, local-first, open source TV tracker. Import your TV Time export in the browser.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#100f0d" },
  ],
};

/**
 * Runs before first paint so an explicit theme or motion preference never flashes.
 * Keys are shared with the app's settings: "episodic:theme" = light|dark|system, "episodic:motion" = reduce|system.
 */
const THEME_INIT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("episodic:theme");if(t==="light"||t==="dark")d.dataset.theme=t;if(localStorage.getItem("episodic:motion")==="reduce")d.dataset.motion="reduce"}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
