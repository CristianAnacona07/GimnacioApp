/**
 * Permisos por sección para las cuentas que no son admin.
 *
 * Hasta ahora lo que podía ver cada quien estaba fijo en el código: el rol y,
 * en los empleados, el cargo. Eso alcanzaba mientras "entrenador" quisiera
 * decir lo mismo en todos los gimnasios, pero no cuando uno quiere que su
 * entrenador arme rutinas y otro no.
 *
 * El admin y el superadmin no pasan por acá: mandan sobre todo su gimnasio y
 * comprobarles permisos sería una consulta al pedo en cada petición.
 *
 * Las funciones son puras a propósito, para poder probarlas sin base de datos
 * (misma idea que las de prisma/extensions/softDelete.js).
 */

// Secciones que el admin puede repartir. Son las de la barra lateral, no las
// rutas: a una persona se le da "socios", no doce endpoints sueltos.
const SECCIONES = [
    'noticias',
    'socios',
    'rutinas',
    'planes',
    'pagos',
    'empleados',
    'recepcion',
];

// Escalonados: cada nivel incluye al anterior.
//   ninguno  — la sección ni aparece en el menú
//   lectura  — la ve, no la toca
//   edicion  — ve, crea y modifica
//
// Borrar queda deliberadamente fuera: es lo único que no se deshace, así que
// se reserva al admin. Si algún día hace falta repartirlo, va como un cuarto
// nivel encima de 'edicion', no como una excepción dentro.
const NIVELES = ['ninguno', 'lectura', 'edicion'];

const RANGO = { ninguno: 0, lectura: 1, edicion: 2 };

const NADA = Object.freeze(
    SECCIONES.reduce((acc, s) => ({ ...acc, [s]: 'ninguno' }), {})
);

// Lo que trae cada cuenta mientras el admin no cambie nada. Reproduce lo que
// el código hacía fijo antes de esta pantalla, así que ningún gimnasio se
// entera del cambio hasta que decide tocarlo.
const POR_DEFECTO = {
    entrenador: {
        ...NADA,
        noticias: 'lectura',
        socios: 'lectura',
        rutinas: 'edicion',
        planes: 'lectura',
        pagos: 'lectura',
        empleados: 'lectura',
    },
    // Los empleados dependen del cargo, no del rol: ver permisosPorDefecto.
    recepcionista: { ...NADA, recepcion: 'edicion', socios: 'lectura' },
};

/**
 * Permisos de fábrica de una cuenta. Los cargos sin pantallas propias
 * (limpieza, nutricionista) arrancan sin nada: entran, pero el admin decide
 * qué les habilita.
 */
function permisosPorDefecto(role, cargo) {
    if (role === 'entrenador') return { ...POR_DEFECTO.entrenador };
    if (role === 'empleado' && cargo === 'recepcionista') return { ...POR_DEFECTO.recepcionista };
    return { ...NADA };
}

/**
 * Lo guardado encima de lo de fábrica. Se mezcla en vez de reemplazar para
 * que una sección nueva del sistema no quede invisible en las cuentas que ya
 * tenían permisos guardados de antes.
 */
function permisosEfectivos(usuario) {
    const base = permisosPorDefecto(usuario?.role, usuario?.cargo);
    const guardados = usuario?.permisos;
    if (!guardados || typeof guardados !== 'object') return base;

    const mezcla = { ...base };
    for (const seccion of SECCIONES) {
        if (NIVELES.includes(guardados[seccion])) mezcla[seccion] = guardados[seccion];
    }
    return mezcla;
}

/** ¿Llega `permisos` al nivel pedido en esa sección? */
function puede(permisos, seccion, nivel = 'lectura') {
    return (RANGO[permisos?.[seccion]] ?? 0) >= (RANGO[nivel] ?? 0);
}

/**
 * Deja sólo secciones y niveles conocidos. Lo que llega del formulario es
 * texto del cliente: sin esto, un nivel inventado se guardaría tal cual y
 * `puede()` lo trataría como 'ninguno' sin que nadie entienda por qué.
 */
function sanearPermisos(entrada) {
    if (!entrada || typeof entrada !== 'object') return null;
    const limpio = {};
    for (const seccion of SECCIONES) {
        if (NIVELES.includes(entrada[seccion])) limpio[seccion] = entrada[seccion];
    }
    return Object.keys(limpio).length ? limpio : null;
}

module.exports = {
    SECCIONES,
    NIVELES,
    permisosPorDefecto,
    permisosEfectivos,
    puede,
    sanearPermisos,
};
