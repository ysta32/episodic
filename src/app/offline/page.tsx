import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline · Episodic",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0b0b10] px-6 text-[#ececf1]">
      <section className="w-full max-w-md rounded-2xl border border-[#262633] bg-[#15151d] p-8">
        <p className="text-sm font-semibold tracking-widest text-[#ff5d73]">
          EPISODIC
        </p>
        <h1 className="mt-4 text-3xl font-semibold">You’re offline</h1>
        <p className="mt-4 text-[#9a9aad]">
          This page isn’t available offline yet. Your library and watch history
          are still saved on this device. Reconnect to load new pages and
          metadata.
        </p>
        <a
          href="/app"
          className="mt-6 inline-flex rounded-xl bg-[#ff5d73] px-5 py-3 font-semibold text-[#0b0b10]"
        >
          Try Up Next
        </a>
      </section>
    </main>
  );
}
