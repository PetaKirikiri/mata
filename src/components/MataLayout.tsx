import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import placeholderLogo from '@/assets/placeholder-logo.png';
import { EcosystemAppSwitcher } from '@/components/EcosystemAppSwitcher';
import { EcosystemProductBrand } from '@/components/EcosystemProductBrand';
import { profileName } from '@/utils/names';

export function MataLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, appUser, signOut } = useAuth();
  const firstName = profileName(appUser ?? { email: user?.email ?? null }).split(/\s+/)[0];

  return (
    <div className="flex min-h-screen flex-col bg-portal-bg text-portal-ink antialiased">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-portal-border bg-portal-surface px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <img src={placeholderLogo} alt="" aria-hidden className="h-7 w-7 shrink-0 rounded-sm object-cover" />
          <EcosystemProductBrand wordmark="mata" />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <EcosystemAppSwitcher currentWordmark="mata" />
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-xs font-semibold">{firstName}</p>
            <p className="text-[10px] text-portal-muted">{appUser?.role ?? 'classroom'}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate('/login'))}
            className="rounded-lg border border-portal-border bg-portal-surface px-3 py-1.5 text-sm shadow-sm hover:bg-portal-bg"
          >
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}

export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={`border border-portal-border bg-portal-surface shadow-sm ${className ?? ''}`}>
      {children}
    </section>
  );
}
