import { Router } from 'express';
import { login, logout, me, refresh, register } from '#controllers';
import { validateBody } from '#middleware';
import { loginSchema, registerSchema } from '#schemas'; // TODO: use the schemas for validation

const authRoutes = Router();

authRoutes.post('/register', validateBody(registerSchema), register);

authRoutes.post('/login', validateBody(loginSchema), login);

authRoutes.post('/refresh', refresh);

authRoutes.delete('/logout', logout);

authRoutes.get('/me', me);

export default authRoutes;
