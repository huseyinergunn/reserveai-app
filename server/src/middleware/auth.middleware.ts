import type { Request, Response, NextFunction } from 'express';
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

/**
 * Sets the admin JWT as an httpOnly cookie — invisible to JavaScript,
 * preventing XSS-based token theft.
 */
export function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    // Secure flag only in production (HTTPS). In dev, browsers allow Secure
    // cookies on localhost, but to avoid any edge-case mismatch we keep it
    // off for HTTP dev servers.
    secure:   isProd,
    // 'strict' is ideal for prod but can silently break Vite's proxy in dev
    // because Set-Cookie domain resolution differs from direct HTTPS.
    // 'lax' is safe: it blocks CSRF while allowing same-site XHR cookies.
    sameSite: isProd ? 'strict' : 'lax',
    maxAge:   8 * 60 * 60 * 1000, // 8 hours — matches JWT expiry
    path:     '/',
  });
}

/** Clears the auth cookie on logout or session expiry. */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
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
