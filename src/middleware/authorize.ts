import type { RequestHandler } from 'express';

// Checks WHAT you may do: the user needs at least one of the allowed roles.
// Must run after accessHandler. Usage: authorize('patient') or authorize('patient', 'psychologist')
const authorize =
  (...allowedRoles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new Error('Authentication required.', { cause: { status: 401 } }));
    }
    const allowed = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!allowed) {
      return next(new Error('You are not allowed to do this.', { cause: { status: 403 } }));
    }
    next();
  };

export default authorize;
