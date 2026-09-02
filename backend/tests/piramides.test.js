// Pruebas de la normalización de series de routes/piramides.js.
//
// No necesita Postgres: se llama directamente al helper puro que el router
// expone, igual que el resto de la suite.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { normalizarSeries } = require('../routes/piramides');

describe('normalizarSeries', () => {
  it('acepta una pirámide normal y la deja en orden', () => {
    const { series, error } = normalizarSeries([
      { peso: 40, reps: 12 },
      { peso: 50, reps: 10 },
      { peso: 60, reps: 8 }
    ]);
    expect(error).toBeUndefined();
    expect(series).toEqual([
      { peso: 40, reps: 12 },
      { peso: 50, reps: 10 },
      { peso: 60, reps: 8 }
    ]);
  });

  it('convierte los números que llegan como texto desde el formulario', () => {
    const { series } = normalizarSeries([{ peso: '42.5', reps: '8' }]);
    expect(series).toEqual([{ peso: 42.5, reps: 8 }]);
  });

  it('conserva las series vacías en su posición', () => {
    // La posición ES el número de serie: si se filtraran las vacías, dejar la
    // serie 2 en blanco convertiría la 3 en la 2.
    const { series } = normalizarSeries([
      { peso: 40, reps: 12 },
      { peso: '', reps: null },
      { peso: 60, reps: 8 }
    ]);
    expect(series).toHaveLength(3);
    expect(series[1]).toEqual({ peso: null, reps: null });
    expect(series[2]).toEqual({ peso: 60, reps: 8 });
  });

  it('rechaza lo que no es una lista', () => {
    expect(normalizarSeries('40kg').error).toBeTruthy();
    expect(normalizarSeries(null).error).toBeTruthy();
    expect(normalizarSeries({ peso: 40 }).error).toBeTruthy();
  });

  it('rechaza valores fuera de rango o que no son números', () => {
    expect(normalizarSeries([{ peso: -1 }]).error).toBeTruthy();
    expect(normalizarSeries([{ peso: 1001 }]).error).toBeTruthy();
    expect(normalizarSeries([{ reps: 'muchas' }]).error).toBeTruthy();
    expect(normalizarSeries([{ peso: Infinity }]).error).toBeTruthy();
  });

  it('pone un techo a la cantidad de series', () => {
    expect(normalizarSeries(new Array(12).fill({ peso: 10 })).error).toBeUndefined();
    expect(normalizarSeries(new Array(13).fill({ peso: 10 })).error).toBeTruthy();
  });

  it('acepta una lista vacía, que es borrar todas las series', () => {
    const { series, error } = normalizarSeries([]);
    expect(error).toBeUndefined();
    expect(series).toEqual([]);
  });
});
