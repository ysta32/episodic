import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/Nav";
import RegisterSW from "@/components/pwa/RegisterSW";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    // Toasts render as a direct <section> child of this wrapper; below md, lift them above the bottom tab bar.
    <div className="[--toast-offset:0px] max-md:[--toast-offset:calc(4rem+env(safe-area-inset-bottom))] [&>section[aria-label=Notifications]]:bottom-(--toast-offset)">
      <ToastProvider>
        <AppShell>{children}</AppShell>
        <RegisterSW />
      </ToastProvider>
    </div>
  );
}
