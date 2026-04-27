import type { Request, Response, NextFunction, CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AdminTokenPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

const COOKIE_NAME = 'admin_token';

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    logger.error('[Auth] JWT_SECRET env variable is not set — admin routes are unprotected!');
    throw new Error('JWT_SECRET is required');
  }
  return s;
}

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, getSecret(), { expiresIn: '8h' });
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/**
 * Returns the cookie options for the current environment.
 *
 * Production (NODE_ENV=production):
 *   - secure: true      → HTTPS only (mandatory for SameSite=None)
 *   - sameSite: 'none'  → allows the cookie to be sent in cross-site XHR
 *                         (Vercel frontend ↔ Render backend are different TLD+1s)
 *
 * Development:
 *   - secure: false     → plain HTTP on localhost is fine
 *   - sameSite: 'lax'   → blocks cross-site POSTs (CSRF) while still working
 *                         through the Vite proxy
 *
 * IMPORTANT: clearAuthCookie MUST use the same sameSite/secure values,
 * otherwise some browsers refuse to clear a previously-set cookie.
 */
function cookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   8 * 60 * 60 * 1000, // 8 h — matches JWT expiry
    path:     '/',
  };
}

/**
 * Sets the admin JWT as an httpOnly cookie — invisible to JavaScript,
 * preventing XSS-based token theft.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

/** Clears the auth cookie on logout or session expiry. */
export function clearAuthCookie(res: Response): void {
  // Must mirror the same sameSite/secure flags used when setting the cookie,
  // otherwise browsers may silently refuse to clear it.
  const { maxAge: _drop, ...clearOpts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, clearOpts);
}

/**
 * Express middleware — reads JWT from httpOnly cookie.
 * Rejects requests without a valid, unexpired admin token.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.cookies as Record<string, string | undefined>)?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Yetkisiz: Oturum açmanız gerekiyor.' });
    return;
  }
  try {
    const payload = jwt.verify(token, getSecret()) as AdminTokenPayload;
    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Yetkisiz: admin rolü gerekli.' });
      return;
    }
    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    clearAuthCookie(res);
    res.status(401).json({
      error: isExpired
        ? 'Oturum süresi doldu. Lütfen tekrar giriş yapın.'
        : 'Geçersiz oturum. Lütfen tekrar giriş yapın.',
    });
  }
}
