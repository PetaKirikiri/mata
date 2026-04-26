import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import placeholderLogo from '@/assets/placeholder-logo.png';

export function MataLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, appUser, signOut } = useAuth();
  const firstName = appUser?.display_name?.trim().split(/\s+/)[0] ?? user?.email?.split('@')[0] ?? 'User';

  return (
    <div className="flex min-h-screen flex-col bg-portal-bg text-portal-ink antialiased">
      <div className="group fixed inset-x-0 top-0 z-20 h-2 overflow-hidden transition-[height] duration-200 hover:h-14 focus-within:h-14">
        <header className="flex h-14 items-center justify-between border-b border-portal-border bg-portal-surface px-4 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="flex items-center gap-2">
            <img src={placeholderLogo} alt="" aria-hidden className="h-7 w-7 rounded-sm object-cover" />
            <span className="text-lg font-semibold tracking-tight">mata</span>
          </div>
          <div className="flex items-center gap-3">
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
      </div>
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
