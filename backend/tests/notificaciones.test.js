// Pruebas de la campanita (routes/notificaciones.js).
//
// Se cubren los bordes del cálculo de vencimiento, que es donde un error de un
// día le dice a un socio al corriente que su membresía venció (o al revés, se
// calla el día que sí venció). Los conteos del admin necesitan Mongo y quedan
// fuera; aquí solo lo puro, siguiendo el patrón de tests/csv.test.js.

import { describe, it, expect, beforeAll } from 'vitest';

let notificaciones;
beforeAll(async () => {
  const mod = await import('../routes/notificaciones.js');
  notificaciones = mod.default;
});

const DIA = 24 * 60 * 60 * 1000;
/** Fecha a N días de hoy a las 00:00 (N negativo = pasado). */
const enDias = (n) => new Date(notificaciones.inicioDeHoy().getTime() + n * DIA);

describe('inicioDeHoy', () => {
  it('devuelve hoy a medianoche, no la hora actual', () => {
    const hoy = notificaciones.inicioDeHoy();
    expect(hoy.getHours()).toBe(0);
    expect(hoy.getMinutes()).toBe(0);
    expect(hoy.getSeconds()).toBe(0);
  });
});

describe('avisoMembresia', () => {
  const hoy = () => notificaciones.inicioDeHoy();

  it('calla cuando el socio no tiene membresía', () => {
    expect(notificaciones.avisoMembresia(null, hoy())).toBeNull();
  });

  it('calla cuando aún faltan más de siete días', () => {
    expect(notificaciones.avisoMembresia(enDias(8), hoy())).toBeNull();
    expect(notificaciones.avisoMembresia(enDias(30), hoy())).toBeNull();
  });

  it('avisa justo a los siete días, no a los ocho', () => {
    const siete = notificaciones.avisoMembresia(enDias(7), hoy());
    expect(siete).not.toBeNull();
    expect(siete.titulo).toBe('Tu membresía vence en 7 días');
    expect(siete.nivel).toBe('media');
  });

  it('dice "vence hoy" el mismo día, sin llamarlo vencida', () => {
    const aviso = notificaciones.avisoMembresia(enDias(0), hoy());

    expect(aviso.titulo).toBe('Tu membresía vence hoy');
    expect(aviso.nivel).toBe('media');
  });

  it('marca como vencida a partir del día siguiente', () => {
    const aviso = notificaciones.avisoMembresia(enDias(-1), hoy());

    expect(aviso.titulo).toBe('Tu membresía venció');
    expect(aviso.nivel).toBe('alta');
    expect(aviso.detalle).toContain('Hace 1 día');
  });

  it('usa singular y plural donde corresponde', () => {
    expect(notificaciones.avisoMembresia(enDias(1), hoy()).titulo).toBe('Tu membresía vence en 1 día');
    expect(notificaciones.avisoMembresia(enDias(2), hoy()).titulo).toBe('Tu membresía vence en 2 días');
    expect(notificaciones.avisoMembresia(enDias(-3), hoy()).detalle).toContain('Hace 3 días');
  });

  it('una membresía que vence esta misma tarde todavía no cuenta como vencida', () => {
    // El bug clásico: comparar contra `new Date()` en vez de contra medianoche
    // haría que a las 18:00 apareciera "venció" para alguien que aún puede
    // entrenar hasta la noche.
    const estaTarde = new Date(hoy().getTime() + 18 * 60 * 60 * 1000);
    const aviso = notificaciones.avisoMembresia(estaTarde, hoy());

    expect(aviso.titulo).toBe('Tu membresía vence hoy');
  });

  it('siempre lleva al lugar donde se renueva', () => {
    expect(notificaciones.avisoMembresia(enDias(-1), hoy()).ruta).toBe('/socio/planes');
    expect(notificaciones.avisoMembresia(enDias(3), hoy()).ruta).toBe('/socio/planes');
  });

  it('la firma cambia con los días, para que el aviso vuelva a sonar cada día', () => {
    const a = notificaciones.avisoMembresia(enDias(3), hoy()).firma;
    const b = notificaciones.avisoMembresia(enDias(2), hoy()).firma;

    expect(a).not.toBe(b);
  });
});
