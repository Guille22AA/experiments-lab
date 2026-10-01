// /api/auth — create the password, log in and out, change the password.
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { changePassword, isPasswordSet, isValidSession, login, logout, MIN_PASSWORD_LENGTH, setupPassword } from '../domain/auth.js';
import {
  checkLoginAllowed,
  clearLoginFailures,
  clearSessionCookie,
  readCookie,
  recordLoginFailure,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
} from '../lib/security.js';
import { validate } from '../lib/validate.js';

export const authRoutes = Router();

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  .max(200);

// What the app should show: create the password, log in, or nothing (already in).
authRoutes.get('/status', (req, res) => {
  res.json({
    required: config.auth.required,
    passwordSet: isPasswordSet(),
    authenticated: !config.auth.required || isValidSession(readCookie(req, SESSION_COOKIE)),
  });
});

authRoutes.post('/setup', async (req, res) => {
  const { password } = validate(z.object({ password: newPassword }), req.body);
  setSessionCookie(res, await setupPassword(password, req.headers['user-agent']));
  res.status(201).json({ authenticated: true });
});

authRoutes.post('/login', async (req, res) => {
  const { password } = validate(z.object({ password: z.string().min(1).max(200) }), req.body);
  checkLoginAllowed(req.ip);
  try {
    setSessionCookie(res, await login(password, req.headers['user-agent']));
  } catch (error) {
    if (error.status === 401) recordLoginFailure(req.ip);
    throw error;
  }
  clearLoginFailures(req.ip);
  res.json({ authenticated: true });
});

authRoutes.post('/logout', (req, res) => {
  logout(readCookie(req, SESSION_COOKIE));
  clearSessionCookie(res);
  res.status(204).end();
});

authRoutes.post('/password', requireAuth, async (req, res) => {
  const body = validate(z.object({ currentPassword: z.string().min(1).max(200), newPassword }), req.body);
  await changePassword(readCookie(req, SESSION_COOKIE), body.currentPassword, body.newPassword);
  res.json({ changed: true });
});
