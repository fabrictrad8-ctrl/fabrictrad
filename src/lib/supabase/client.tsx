import { createBrowserClient } from '@supabase/ssr';

const PFX = 'sb_';
const LOCAL_AUDIT_ROLE_COOKIE = 'fabrictrad_demo_role';

type LocalAuditRole = 'buyer' | 'seller' | 'admin';

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
const isSecureContextForCookies = () =>
  typeof window !== 'undefined' && window.location.protocol === 'https:';

let _canUseCookiesCache: boolean | null = null;

const canUseCookies = (): boolean => {
  if (!isBrowser()) return false;
  if (_canUseCookiesCache !== null) return _canUseCookiesCache;
  const k = '__sb_test__';
  document.cookie = `${k}=1; Path=/; SameSite=Lax${isSecureContextForCookies() ? '; Secure' : ''}`;
  _canUseCookiesCache = document.cookie.includes(k);
  document.cookie = `${k}=; Path=/; Max-Age=0; SameSite=Lax${isSecureContextForCookies() ? '; Secure' : ''}`;
  return _canUseCookiesCache;
};

const fromCookies = () =>
  !isBrowser()
    ? []
    : document.cookie
        .split(';')
        .filter(Boolean)
        .map((c) => {
          const parts = c.trim().split('=');
          const name = parts[0];
          const rest = parts.slice(1);
          return { name: name.trim(), value: decodeURIComponent(rest.join('=')) };
        })
        .filter((c) => c.name);

const fromStorage = () => {
  if (!isBrowser()) return [];
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PFX))
      .map((k) => ({ name: k.slice(PFX.length), value: localStorage.getItem(k) || '' }));
  } catch {
    return [];
  }
};

type CookieOptions = {
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: string | number | Date;
};

const setCookie = (name: string, value: string, options?: CookieOptions) => {
  if (typeof document === 'undefined') return;
  let s = `${name}=${encodeURIComponent(value)}; Path=${options?.path || '/'}; SameSite=Lax`;
  if (isSecureContextForCookies()) s += '; Secure';
  if (options?.maxAge) s += `; Max-Age=${options.maxAge}`;
  if (options?.domain) s += `; Domain=${options.domain}`;
  if (options?.expires) s += `; Expires=${new Date(options.expires).toUTCString()}`;
  document.cookie = s;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${isSecureContextForCookies() ? '; Secure' : ''}`;
};

const getLocalAuditRole = (): LocalAuditRole | null => {
  if (!isBrowser()) return null;
  const hostname = window.location.hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return null;
  const role = fromCookies().find((cookie) => cookie.name === LOCAL_AUDIT_ROLE_COOKIE)?.value;
  return role === 'buyer' || role === 'seller' || role === 'admin' ? role : null;
};

const installLocalAuditAuth = <T extends ReturnType<typeof createBrowserClient>>(client: T): T => {
  const auditRole = getLocalAuditRole();
  if (!auditRole) return client;

  // Browser QA runs against a production build with intentionally inert Supabase
  // credentials. Keep the test identity strictly localhost-only and cookie-gated;
  // production hosts can never enter this branch.
  const accountRole = auditRole === 'admin' ? 'admin_staff' : auditRole;
  const now = new Date().toISOString();
  const auditUser = {
    id: `00000000-0000-4000-8000-${auditRole === 'buyer' ? '000000000001' : auditRole === 'seller' ? '000000000002' : '000000000003'}`,
    aud: 'authenticated',
    role: 'authenticated',
    email: `qa-${auditRole}@localhost.invalid`,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'], role: accountRole },
    user_metadata: { full_name: `QA ${auditRole}`, role: accountRole },
    identities: [],
    created_at: now,
    updated_at: now,
  };
  const auditSession = {
    access_token: `local-audit-${auditRole}`,
    refresh_token: `local-audit-refresh-${auditRole}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: auditUser,
  };

  const auth = client.auth as any;
  auth.getSession = async () => ({ data: { session: auditSession }, error: null });
  auth.getUser = async () => ({ data: { user: auditUser }, error: null });
  auth.onAuthStateChange = (callback: (event: string, session: typeof auditSession) => void) => {
    queueMicrotask(() => callback('INITIAL_SESSION', auditSession));
    return {
      data: {
        subscription: {
          id: `local-audit-${auditRole}`,
          callback,
          unsubscribe: () => undefined,
        },
      },
    };
  };

  return client;
};

const buildClient = () => {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          if (!isBrowser()) return [];
          return canUseCookies() ? fromCookies() : fromStorage();
        },
        setAll(cookiesToSet) {
          if (!isBrowser()) return;
          if (canUseCookies()) {
            cookiesToSet.forEach(({ name, value, options }) =>
              value ? setCookie(name, value, options) : deleteCookie(name)
            );
          } else {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                if (value) {
                  localStorage.setItem(`${PFX}${name}`, value);
                } else {
                  localStorage.removeItem(`${PFX}${name}`);
                }
              } catch {
                return;
              }
              if (value) setCookie(name, value, options);
            });
          }
        },
      },
    }
  );

  return installLocalAuditAuth(client);
};

type BrowserClient = ReturnType<typeof buildClient>;
let _browserClient: BrowserClient | null = null;

export function createClient(): BrowserClient {
  // React components and hooks frequently import this helper independently.
  // Reusing one browser auth client avoids duplicate auth subscriptions and
  // repeated session refresh/profile bootstrap work during route transitions.
  if (isBrowser()) {
    if (!_browserClient) _browserClient = buildClient();
    return _browserClient;
  }

  // Never share a browser-style client across server requests.
  return buildClient();
}
