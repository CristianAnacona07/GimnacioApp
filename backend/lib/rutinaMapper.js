/**
 * El frontend espera `rutina.ejercicios` como un array anidado en el orden en
 * que se creó (igual que el array embebido de Mongoose). Postgres los guarda
 * en `rutina_ejercicios`, una tabla hija con una columna `orden` explícita
 * que reemplaza la posición implícita del array.
 */

const { ObjectId } = require('bson');

function conRutina(r) {
  if (!r) return r;
  const { id, ejercicios, ...rest } = r;
  return {
    ...rest,
    _id: id,
    ejercicios: (ejercicios || [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((e) => ({
        _id: e.id,
        nombre: e.nombre,
        series: e.series,
        repeticiones: e.repeticiones,
        instrucciones: e.instrucciones,
        imagenUrl: e.imagenUrl,
        completado: e.completado,
      })),
  };
}

// Array de ejercicios del body (posiblemente vacío/ausente) -> filas listas
// para un `create` anidado, con `orden` = posición en el array recibido.
//
// La extensión objectId sólo intercepta operaciones de nivel superior
// (p.ej. `rutina.create`), no los `create` anidados dentro de una relación,
// así que aquí hay que generar el id a mano.
function ejerciciosParaCrear(ejercicios) {
  if (!Array.isArray(ejercicios)) return [];
  return ejercicios.map((e, idx) => ({
    id: new ObjectId().toHexString(),
    nombre: e.nombre,
    series: e.series ?? 0,
    repeticiones: e.repeticiones !== undefined && e.repeticiones !== null ? String(e.repeticiones) : '0',
    instrucciones: e.instrucciones,
    imagenUrl: e.imagenUrl,
    completado: !!e.completado,
    orden: idx,
  }));
}

module.exports = { conRutina, ejerciciosParaCrear };
