/**
 * Igual que rutinaMapper.js, pero para RutinaPlantilla — que es una SEMANA
 * (plantilla -> días -> ejercicios), no una sola lista, y sin `completado`
 * (no hay ningún entrenamiento en curso que marcar en una plantilla).
 */

const { ObjectId } = require('bson');

// Para ordenar los días como en un calendario y no como los devuelva la base.
const ORDEN_DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

function conPlantilla(p) {
  if (!p) return p;
  const { id, dias, ...rest } = p;
  return {
    ...rest,
    _id: id,
    dias: (dias || [])
      .slice()
      .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia))
      .map((d) => ({
        _id: d.id,
        dia: d.dia,
        enfoque: d.enfoque,
        ejercicios: (d.ejercicios || [])
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((e) => ({
            _id: e.id,
            nombre: e.nombre,
            series: e.series,
            repeticiones: e.repeticiones,
            instrucciones: e.instrucciones,
            imagenUrl: e.imagenUrl,
          })),
      })),
  };
}

// Días del body -> filas listas para un `create` anidado de dos niveles.
// La extensión objectId sólo intercepta operaciones de nivel superior, así
// que el id de cada fila hija se genera acá a mano (mismo motivo que en
// rutinaMapper.js). Un día sin ejercicios se descarta: no aporta nada y
// ensuciaría la vista del socio con una rutina vacía al aplicar la plantilla.
function diasParaCrear(dias) {
  if (!Array.isArray(dias)) return [];
  return dias
    .filter((d) => d && d.dia && Array.isArray(d.ejercicios) && d.ejercicios.length)
    .map((d) => ({
      id: new ObjectId().toHexString(),
      dia: d.dia,
      enfoque: d.enfoque || null,
      ejercicios: {
        create: d.ejercicios.map((e, idx) => ({
          id: new ObjectId().toHexString(),
          nombre: e.nombre,
          series: e.series ?? 0,
          repeticiones: e.repeticiones !== undefined && e.repeticiones !== null ? String(e.repeticiones) : '0',
          instrucciones: e.instrucciones,
          imagenUrl: e.imagenUrl,
          orden: idx,
        })),
      },
    }));
}

module.exports = { conPlantilla, diasParaCrear, ORDEN_DIAS };
