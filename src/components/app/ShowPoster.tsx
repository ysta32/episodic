import { cx } from "@/components/ui";
import { Icon } from "@/components/ui";

/** 2:3 poster box with a quiet fallback. Fixed aspect ratio means zero layout shift. */
export function ShowPoster({ src, title, className }: { src?: string; title: string; className?: string }) {
  return (
    <span className={cx("relative block aspect-[2/3] overflow-hidden rounded-k-sm bg-surface-3", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-text-3" role="img" aria-label={`No poster for ${title}`}>
          <Icon name="tv" size={22} />
        </span>
      )}
    </span>
  );
}
