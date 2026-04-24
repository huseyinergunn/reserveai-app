import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AdminTokenPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

/** Reads JWT_SECRET from env — crashes loudly if missing so misconfiguration is obvious. */
function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    logger.error('[Auth] JWT_SECRET env variable is not set — admin routes are unprotected!');
    throw new Error('JWT_SECRET is required');
  }
  return s;
}

/**
 * Generates a signed JWT for the admin role.
 * Expiry: 8 hours — one full work day, must re-login next day.
 */
export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, getSecret(), { expiresIn: '8h' });
}

/**
 * Express middleware — rejects requests without a valid Bearer token.
 * Attach to any route that requires admin access.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yetkisiz: Bearer token gerekli.' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getSecret()) as AdminTokenPayload;
    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Yetkisiz: admin rolü gerekli.' });
      return;
    }
    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      error: isExpired
        ? 'Oturum süresi doldu. Lütfen tekrar giriş yapın.'
        : 'Geçersiz token. Lütfen tekrar giriş yapın.',
    });
  }
}
