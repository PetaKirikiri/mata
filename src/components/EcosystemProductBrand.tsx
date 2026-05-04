import { ecosystemSameOriginLinks, isLikelyInAppWebView } from '@/lib/ecosystemShell';

type Props = { wordmark: string };

/** Same-origin jumps to Akomanga shell satellites; plain wordmark in embedded WebViews. */
export function EcosystemProductBrand({ wordmark }: Props) {
  if (isLikelyInAppWebView()) {
    return <span className="text-lg font-semibold tracking-tight text-portal-ink">{wordmark}</span>;
  }

  const links = ecosystemSameOriginLinks();

  return (
    <details className="relative min-w-0">
      <summary className="flex cursor-pointer list-none items-center gap-0.5 text-portal-ink [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold tracking-tight">{wordmark}</span>
        <span className="text-sm text-portal-muted" aria-hidden>
          ▾
        </span>
      </summary>
      <ul className="absolute left-0 top-full z-[100] mt-1 min-w-[12rem] rounded-lg border border-portal-border bg-portal-surface py-1 shadow-md">
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
