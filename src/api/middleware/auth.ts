import type { Request, Response, NextFunction } from 'express';

/**
 * Simple API key auth. Enable by setting API_AUTH_ENABLED=true and API_KEY.
 * Skips auth when disabled or in tests.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const isAuthEnabled = process.env.API_AUTH_ENABLED === 'true';
  if (!isAuthEnabled) {
    return next();
  }

  const expectedKey = process.env.API_KEY;
  if (!expectedKey) {
    // Misconfiguration: require API_KEY when auth is enabled
    return res.status(500).json({ success: false, error: 'Server misconfigured: API_KEY missing' });
  }

  const providedKey = req.header('x-api-key');
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}



