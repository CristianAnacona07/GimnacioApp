// Pruebas del middleware de autenticación/autorización.
// Usa el 'jsonwebtoken' real con un JWT_SECRET de prueba y stubs de req/res/next.
// Cubre: verificarToken (válido/inválido/ausente/expirado), extracción de
// gymId/role, soloAdmin, soloSuperAdmin, esAdmin, resolverUsuarioId, filtroPropiedad.

import { describe, it, expect, vi, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

let auth;
const SECRET = 'test-secret-para-suite-de-pruebas';

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  auth = await import('../middleware/auth.js');
});

// Fabrica de req/res/next simulados.
function mkRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  return res;
}
function mkReq(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}
const sign = (payload, opts) => jwt.sign(payload, SECRET, opts);

describe('verificarToken', () => {
  it('acepta un token válido y extrae id/role/gymId', () => {
    const token = sign({ id: 'u1', role: 'admin', gymId: 'gymA' });
    const req = mkReq(token);
    const res = mkRes();
    const next = vi.fn();

    auth.verificarToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.userId).toBe('u1');
    expect(req.userRole).toBe('admin');
    expect(req.gymId).toBe('gymA');
  });

  it('pone gymId en null cuando el token no lo incluye', () => {
    const token = sign({ id: 'u2', role: 'socio' });
    const req = mkReq(token);
    const res = mkRes();
    const next = vi.fn();

    auth.verificarToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.gymId).toBeNull();
    expect(req.userRole).toBe('socio');
  });

  it('rechaza (401) cuando falta el token', () => {
    const req = mkReq(null);
    const res = mkRes();
    const next = vi.fn();

    auth.verificarToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.mensaje).toMatch(/no proporcionado/i);
  });

  it('rechaza (401) un token con firma inválida', () => {
    const token = jwt.sign({ id: 'x', role: 'admin' }, 'otro-secreto-distinto');
    const req = mkReq(token);
    const res = mkRes();
    const next = vi.fn();

    auth.verificarToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.mensaje).toMatch(/inválido|invalido|expirado/i);
  });

  it('rechaza (401) un token expirado', () => {
    // expiresIn negativo => ya expirado.
    const token = sign({ id: 'u3', role: 'admin' }, { expiresIn: -10 });
    const req = mkReq(token);
    const res = mkRes();
    const next = vi.fn();

    auth.verificarToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rechaza (401) un token con formato basura', () => {
    const req = mkReq('esto-no-es-un-jwt');
    const res = mkRes();
    const next = vi.fn();

    auth.verificarToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('soloAdmin', () => {
  it.each(['admin', 'superadmin'])('permite el rol %s', (role) => {
    const req = { userRole: role };
    const res = mkRes();
    const next = vi.fn();
    auth.soloAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(['socio', 'entrenador', undefined, null, ''])('deniega (403) el rol %s', (role) => {
    const req = { userRole: role };
    const res = mkRes();
    const next = vi.fn();
    auth.soloAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('soloSuperAdmin', () => {
  it('permite superadmin', () => {
    const req = { userRole: 'superadmin' };
    const res = mkRes();
    const next = vi.fn();
    auth.soloSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(['admin', 'socio', 'entrenador', undefined])('deniega (403) el rol %s', (role) => {
    const req = { userRole: role };
    const res = mkRes();
    const next = vi.fn();
    auth.soloSuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('esAdmin', () => {
  it('es true para admin y superadmin', () => {
    expect(auth.esAdmin({ userRole: 'admin' })).toBe(true);
    expect(auth.esAdmin({ userRole: 'superadmin' })).toBe(true);
  });
  it('es false para el resto', () => {
    expect(auth.esAdmin({ userRole: 'socio' })).toBe(false);
    expect(auth.esAdmin({ userRole: 'entrenador' })).toBe(false);
    expect(auth.esAdmin({})).toBe(false);
  });
});

describe('resolverUsuarioId', () => {
  it('admin: usa el solicitado si se indica', () => {
    const req = { userRole: 'admin', userId: 'self' };
    expect(auth.resolverUsuarioId(req, 'otro')).toBe('otro');
  });
  it('admin: cae al propio si no se indica', () => {
    const req = { userRole: 'admin', userId: 'self' };
    expect(auth.resolverUsuarioId(req, undefined)).toBe('self');
  });
  it('socio: ignora lo solicitado y devuelve el propio (aislamiento)', () => {
    const req = { userRole: 'socio', userId: 'self' };
    expect(auth.resolverUsuarioId(req, 'victima')).toBe('self');
  });
});

describe('filtroPropiedad', () => {
  it('admin: filtro vacío (alcance de gym)', () => {
    expect(auth.filtroPropiedad({ userRole: 'admin', userId: 'a' })).toEqual({});
  });
  it('socio: restringe a sus propios documentos', () => {
    expect(auth.filtroPropiedad({ userRole: 'socio', userId: 'a' })).toEqual({ usuarioId: 'a' });
  });
});
