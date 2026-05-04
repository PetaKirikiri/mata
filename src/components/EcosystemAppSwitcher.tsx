import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ecosystemCurrentProductKey,
  ecosystemSameOriginLinks,
  isLikelyInAppWebView,
} from '@/lib/ecosystemShell';

/** Matches Akomanga `EcosystemAppSwitcher` (portal tokens); full document navigation only. */
const SUMMARY_CLASS =
  'inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-portal-border bg-portal-surface px-3 py-1.5 text-sm font-semibold tracking-tight text-portal-ink shadow-sm hover:bg-portal-bg [&::-webkit-details-marker]:hidden';

const MENU_CLASS =
  'absolute right-0 top-full z-[100] mt-1.5 min-w-[12rem] rounded-lg border border-portal-border bg-portal-surface py-1 shadow-lg';

const ROW_CLASS =
  'block w-full px-3 py-2 text-left text-sm text-portal-ink hover:bg-portal-bg';

const ROW_CURRENT_CLASS = `${ROW_CLASS} cursor-default bg-portal-bg/80 font-semibold text-portal-ink`;

function isModifiedClick(e: React.MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export function EcosystemAppSwitcher() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();

  if (typeof navigator !== 'undefined' && isLikelyInAppWebView()) {
    return null;
  }

  const links = ecosystemSameOriginLinks();
  const current = ecosystemCurrentProductKey(pathname);

  const follow = (href: string, e: React.MouseEvent) => {
    if (isModifiedClick(e)) return;
    e.preventDefault();
    detailsRef.current?.removeAttribute('open');
    window.location.assign(href);
  };

  return (
    <details ref={detailsRef} className="relative shrink-0">
      <summary className={SUMMARY_CLASS} aria-label="Products menu" aria-haspopup="menu">
        <span>Products</span>
        <span className="text-portal-muted" aria-hidden>
          ▾
        </span>
      </summary>
      <ul className={MENU_CLASS} role="menu">
        {links.map((item) => {
          const active = item.key === current;
          return (
            <li key={item.key} role="none">
              {active ? (
                <span className={ROW_CURRENT_CLASS} aria-current="page" role="menuitem">
                  {item.label}
                  <span className="sr-only"> (current product)</span>
                </span>
              ) : (
                <a href={item.href} role="menuitem" className={ROW_CLASS} onClick={(e) => follow(item.href, e)}>
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
