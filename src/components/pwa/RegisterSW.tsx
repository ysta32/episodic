"use client";

import { useEffect, useState } from "react";

export default function RegisterSW() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    const showUpdate = () => {
      if (
        !disposed &&
        registration?.waiting &&
        navigator.serviceWorker.controller
      ) {
        setWaiting(registration.waiting);
      }
    };
    const stateChanged = () => {
      if (installing?.state === "installed") showUpdate();
    };
    const updateFound = () => {
      installing?.removeEventListener("statechange", stateChanged);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", stateChanged);
    };
    const controllerChanged = () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
      hadController = true;
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChanged,
    );
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(
        (result) => {
          if (disposed) return;
          registration = result;
          showUpdate();
          updateFound();
          registration.addEventListener("updatefound", updateFound);
        },
        (error: unknown) => {
          console.warn("Episodic offline support could not start.", error);
        },
      );

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
      registration?.removeEventListener("updatefound", updateFound);
      installing?.removeEventListener("statechange", stateChanged);
    };
  }, []);

  if (!waiting) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-[#262633] bg-[#15151d] p-4 text-[#ececf1] shadow-xl md:bottom-6"
    >
      <p className="font-semibold">An Episodic update is ready.</p>
      <p className="mt-1 text-sm text-[#9a9aad]">
        Reload to get the latest version.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}
          className="rounded-xl bg-[#ff5d73] px-4 py-2 font-semibold text-[#0b0b10] disabled:opacity-60"
        >
          {updating ? "Updating…" : "Update now"}
        </button>
        <button
          type="button"
          onClick={() => setWaiting(null)}
          className="rounded-xl px-4 py-2"
        >
          Later
        </button>
      </div>
    </aside>
  );
}
