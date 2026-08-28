type AuthenticationMethodReference = {
  method?: unknown;
  timestamp?: unknown;
};

type JwtPayload = {
  amr?: unknown;
};

const decodeJwtPayload = (accessToken: string): JwtPayload | null => {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || !parts[1]) return null;

    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

/**
 * Returns true only when the current Supabase session was established through OTP.
 *
 * Supabase may add token_refresh to the AMR list when a session is refreshed, so the
 * decisive method is the newest non-refresh method. This intentionally rejects
 * password, OAuth, recovery, magic-link, signup, invite, SSO and anonymous sessions
 * for FabricTrad administration even when the email and database role are otherwise
 * valid.
 *
 * The caller must verify the user with supabase.auth.getUser() before trusting this
 * result. This helper decodes AMR only; it does not validate the JWT signature itself.
 */
export const isOtpAuthenticatedAccessToken = (accessToken?: string | null) => {
  if (!accessToken) return false;
  const payload = decodeJwtPayload(accessToken);
  if (!payload || !Array.isArray(payload.amr)) return false;

  const methods = (payload.amr as AuthenticationMethodReference[])
    .map((entry) => (typeof entry?.method === 'string' ? entry.method.trim().toLowerCase() : ''))
    .filter(Boolean);

  const decisiveMethod = methods.find((method) => method !== 'token_refresh');
  return decisiveMethod === 'otp';
};
