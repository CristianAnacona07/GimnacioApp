import { describe, it, expect } from 'vitest';
import {
    SECCIONES,
    NIVELES,
    permisosPorDefecto,
    permisosEfectivos,
    puede,
    sanearPermisos,
} from '../lib/permisos.js';

// Las funciones son puras: se prueban sin base de datos, igual que las de la
// extensión de soft-delete.
describe('permisosPorDefecto', () => {
    it('le da al entrenador lectura general y edición sólo en rutinas', () => {
        const p = permisosPorDefecto('entrenador');
        expect(p.socios).toBe('lectura');
        expect(p.noticias).toBe('lectura');
        expect(p.planes).toBe('lectura');
        expect(p.pagos).toBe('lectura');
        expect(p.empleados).toBe('lectura');
        expect(p.rutinas).toBe('edicion');
    });

    it('no le da recepción al entrenador', () => {
        expect(permisosPorDefecto('entrenador').recepcion).toBe('ninguno');
    });

    it('reproduce lo que el recepcionista ya podía hacer', () => {
        const p = permisosPorDefecto('empleado', 'recepcionista');
        expect(p.recepcion).toBe('edicion');
        expect(p.socios).toBe('lectura');
    });

    it('deja sin nada a los cargos que no tienen pantallas propias', () => {
        for (const cargo of ['limpieza', 'nutricionista']) {
            const p = permisosPorDefecto('empleado', cargo);
            expect(Object.values(p).every(v => v === 'ninguno')).toBe(true);
        }
    });

    it('cubre todas las secciones declaradas', () => {
        expect(Object.keys(permisosPorDefecto('entrenador')).sort()).toEqual([...SECCIONES].sort());
    });
});

describe('permisosEfectivos', () => {
    it('usa los de fábrica cuando la cuenta no tiene nada guardado', () => {
        expect(permisosEfectivos({ role: 'entrenador', permisos: null }).rutinas).toBe('edicion');
    });

    it('lo guardado pisa lo de fábrica', () => {
        const p = permisosEfectivos({ role: 'entrenador', permisos: { rutinas: 'lectura' } });
        expect(p.rutinas).toBe('lectura');
    });

    it('una sección guardada no borra las demás', () => {
        // Si mezclara mal, quitarle rutinas le quitaría también socios.
        const p = permisosEfectivos({ role: 'entrenador', permisos: { rutinas: 'ninguno' } });
        expect(p.rutinas).toBe('ninguno');
        expect(p.socios).toBe('lectura');
    });

    it('ignora secciones y niveles que no existen', () => {
        const p = permisosEfectivos({ role: 'entrenador', permisos: { inventada: 'edicion', socios: 'total' } });
        expect(p.inventada).toBeUndefined();
        expect(p.socios).toBe('lectura');
    });

    it('aguanta un permisos que no sea un objeto', () => {
        for (const basura of ['si', 42, [], undefined]) {
            expect(permisosEfectivos({ role: 'entrenador', permisos: basura }).rutinas).toBe('edicion');
        }
    });
});

describe('puede', () => {
    const permisos = permisosPorDefecto('entrenador');

    it('lectura alcanza para leer', () => {
        expect(puede(permisos, 'socios', 'lectura')).toBe(true);
    });

    it('lectura no alcanza para editar', () => {
        expect(puede(permisos, 'socios', 'edicion')).toBe(false);
    });

    it('edición incluye lectura', () => {
        expect(puede(permisos, 'rutinas', 'lectura')).toBe(true);
        expect(puede(permisos, 'rutinas', 'edicion')).toBe(true);
    });

    it('ninguno no alcanza ni para leer', () => {
        expect(puede(permisos, 'recepcion', 'lectura')).toBe(false);
    });

    it('sin permisos o con una sección desconocida, dice que no', () => {
        expect(puede(null, 'socios')).toBe(false);
        expect(puede(permisos, 'inventada')).toBe(false);
    });
});

describe('sanearPermisos', () => {
    it('conserva lo válido y descarta lo demás', () => {
        const limpio = sanearPermisos({ socios: 'edicion', inventada: 'edicion', rutinas: 'total' });
        expect(limpio).toEqual({ socios: 'edicion' });
    });

    it('devuelve null cuando no queda nada aprovechable', () => {
        expect(sanearPermisos({ inventada: 'edicion' })).toBeNull();
        expect(sanearPermisos(null)).toBeNull();
        expect(sanearPermisos('edicion')).toBeNull();
    });

    it('acepta los tres niveles declarados', () => {
        for (const nivel of NIVELES) {
            expect(sanearPermisos({ socios: nivel })).toEqual({ socios: nivel });
        }
    });
});
