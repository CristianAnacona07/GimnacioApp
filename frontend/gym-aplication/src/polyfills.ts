/**
 * Rellenos para WebViews de Android antiguos.
 *
 * El compilador adapta la SINTAXIS moderna al navegador objetivo, pero no añade
 * los MÉTODOS nuevos del lenguaje: si el WebView no trae `Object.hasOwn`, nadie
 * lo pone por él. Angular lo usa internamente al resolver sus componentes, así
 * que en un teléfono con WebView anterior a Chrome 93 la app no arranca y queda
 * la pantalla en blanco.
 *
 * Pasa sobre todo en teléfonos sin servicios de Google (Huawei y similares):
 * ahí el WebView no se actualiza desde Play Store y puede quedarse años atrás.
 *
 * Cada relleno solo se instala si falta, así que en un teléfono al día no hace
 * nada. Este archivo se carga ANTES que Angular (ver angular.json).
 */

// Object.hasOwn — Chrome 93. Lo usa Angular para leer las definiciones de sus
// componentes recorriendo la cadena de prototipos.
if (!(Object as any).hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: function (objeto: any, propiedad: PropertyKey) {
      if (objeto == null) throw new TypeError('No se puede consultar una propiedad de null o undefined');
      return Object.prototype.hasOwnProperty.call(Object(objeto), propiedad);
    },
    configurable: true,
    writable: true
  });
}

// Array.prototype.at y String.prototype.at — Chrome 92.
function alIndice(this: any, indice: number) {
  const largo = this.length;
  const i = Math.trunc(indice) || 0;
  const real = i < 0 ? largo + i : i;
  return real < 0 || real >= largo ? undefined : this[real];
}
for (const prototipo of [Array.prototype, String.prototype]) {
  if (!(prototipo as any).at) {
    Object.defineProperty(prototipo, 'at', { value: alIndice, configurable: true, writable: true });
  }
}

// findLast y findLastIndex — Chrome 97.
if (!(Array.prototype as any).findLast) {
  Object.defineProperty(Array.prototype, 'findLast', {
    value: function (predicado: any, esteArg?: any) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicado.call(esteArg, this[i], i, this)) return this[i];
      }
      return undefined;
    },
    configurable: true, writable: true
  });
}
if (!(Array.prototype as any).findLastIndex) {
  Object.defineProperty(Array.prototype, 'findLastIndex', {
    value: function (predicado: any, esteArg?: any) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicado.call(esteArg, this[i], i, this)) return i;
      }
      return -1;
    },
    configurable: true, writable: true
  });
}

// structuredClone — Chrome 98. La copia por JSON no cubre fechas ni Map, pero
// alcanza para lo que la app clona (objetos de datos planos).
if (typeof (globalThis as any).structuredClone !== 'function') {
  (globalThis as any).structuredClone = (valor: any) =>
    valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));
}
