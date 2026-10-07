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
    <ToastProvider>
      <AppShell>{children}</AppShell>
      <RegisterSW />
    </ToastProvider>
  );
}
