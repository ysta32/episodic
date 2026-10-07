import Link from "next/link";
import { buttonClasses, type ButtonVariant } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { APP_HREF, IMPORT_HREF } from "./site";

export function ImportButton({ label = "Import from TV Time", variant = "primary" }: { label?: string; variant?: ButtonVariant }) {
  return (
    <Link href={IMPORT_HREF} className={cx(buttonClasses(variant, "lg"), "group")}>
      <Icon name="import" />
      {label}
    </Link>
  );
}

export function OpenAppButton({ variant = "secondary" }: { variant?: ButtonVariant }) {
  return (
    <Link href={APP_HREF} className={cx(buttonClasses(variant, "lg"), "group")}>
      Open the app
      <Icon name="chevron-right" className="transition-transform duration-(--k-dur-2) ease-k-out group-hover:translate-x-0.5" />
    </Link>
  );
}

export function CtaPair({ className }: { className?: string }) {
  return (
    <div className={cx("flex flex-col gap-3 min-[420px]:flex-row", className)}>
      <ImportButton />
      <OpenAppButton />
    </div>
  );
}
