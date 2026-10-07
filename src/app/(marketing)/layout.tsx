import type { ReactNode } from "react";
import { SiteFooter, SiteHeader, SkipLink } from "@/components/marketing/Chrome";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
