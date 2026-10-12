import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { ACCESS_JWT_SECRET } from '#config';

// Checks WHO you are: valid access token -> req.user is set, otherwise 401.
const accessHandler: RequestHandler = (req, _res, next) => {
  const authHeader = req.header('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!accessToken) {
    return next(new Error('Access token is required.', { cause: { status: 401 } }));
  }

  try {
    const decoded = jwt.verify(accessToken, ACCESS_JWT_SECRET) as jwt.JwtPayload;
    if (!decoded.sub) {
      return next(new Error('Invalid access token.', { cause: { status: 401 } }));
    }
    req.user = { id: decoded.sub, roles: decoded.roles ?? [] };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // the client's fetchInterceptor reacts to this and refreshes the token
      return next(new Error('Expired access token', { cause: { status: 401, code: 'ACCESS_TOKEN_EXPIRED' } }));
    }
    next(new Error('Invalid access token.', { cause: { status: 401 } }));
  }
};

export default accessHandler;
