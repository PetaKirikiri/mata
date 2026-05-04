import { ecosystemSameOriginLinks, isLikelyInAppWebView } from '@/lib/ecosystemShell';

type Props = { currentWordmark: string };

/** Top-right pill: jump between Akomanga shell satellites on the same origin. */
export function EcosystemAppSwitcher({ currentWordmark }: Props) {
  if (typeof navigator !== 'undefined' && isLikelyInAppWebView()) {
    return null;
  }

  const links = ecosystemSameOriginLinks();

  return (
    <details className="relative shrink-0">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-portal-border bg-portal-surface px-3 py-1.5 text-sm font-medium text-portal-ink shadow-sm hover:bg-portal-bg [&::-webkit-details-marker]:hidden"
        aria-label="Switch ecosystem app"
      >
        <span>{currentWordmark}</span>
        <span className="text-portal-muted" aria-hidden>
          ▾
        </span>
      </summary>
      <ul className="absolute right-0 top-full z-[100] mt-1 min-w-[12rem] rounded-lg border border-portal-border bg-portal-surface py-1 shadow-md">
        {links.map((item) => (
          <li key={item.key}>
            <a href={item.href} className="block px-3 py-2 text-sm text-portal-ink hover:bg-portal-bg">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
