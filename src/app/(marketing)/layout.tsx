import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/marketing/Chrome";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:bg-accent focus:p-3 focus:text-accent-ink">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
