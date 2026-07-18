import { createBrowserClient } from '@supabase/ssr';

const PFX = 'sb_';

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

export function createClient() {
  return createBrowserClient(
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
}
