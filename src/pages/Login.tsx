import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import placeholderLogo from '@/assets/placeholder-logo.png';

type LoginLocationState = {
  from?: string;
};

function readRedirectTarget(state: unknown): string {
  const from = (state as LoginLocationState | null)?.from;
  return from?.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/classroom';
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const redirectTarget = readRedirectTarget(location.state);

  if (!loading && user) {
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-portal-bg px-4 text-portal-ink">
      <form
        className="w-full max-w-sm rounded-2xl border border-portal-border bg-portal-surface p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          void signIn(email, password).then(({ error: signInError }) => {
            if (signInError) {
              setError(signInError.message);
              return;
            }
            navigate(redirectTarget, { replace: true });
          });
        }}
      >
        <div className="flex items-center gap-2">
          <img src={placeholderLogo} alt="" aria-hidden className="h-8 w-8 rounded-sm object-cover" />
          <h1 className="text-xl font-semibold">mata</h1>
        </div>
        <p className="mt-2 text-sm text-portal-muted">Use your akomanga Supabase account.</p>
        <label className="mt-6 block text-sm">
          <span className="text-portal-muted">Email</span>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-portal-border px-3 py-2 outline-none focus:border-portal-accent focus:ring-2 focus:ring-portal-ring/20"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-portal-muted">Password</span>
          <input
            type="password"
            required
            className="mt-1 w-full rounded-lg border border-portal-border px-3 py-2 outline-none focus:border-portal-accent focus:ring-2 focus:ring-portal-ring/20"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="mt-3 text-sm text-portal-danger">{error}</p> : null}
        <button
          type="submit"
          className="mt-5 w-full rounded-lg bg-portal-accent px-4 py-2 text-sm font-medium text-white hover:bg-portal-accent-muted"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
