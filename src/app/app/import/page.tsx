import ImportWizard from "@/components/app/ImportWizard";
import ExportPanel from "@/components/app/ExportPanel";
import { IMPORTERS } from "@/lib/import";
import type { ImportSource } from "@/lib/types";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>;
}) {
  const { source } = await searchParams;
  const selected =
    typeof source === "string" && Object.hasOwn(IMPORTERS, source)
      ? (source as ImportSource)
      : "tvtime";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-12 bg-bg px-4 py-8 text-text sm:px-6 lg:px-8">
      <ImportWizard key={selected} initialSource={selected} />
      <ExportPanel />
    </main>
  );
}
