/** @type {import('tailwindcss').Config} */

// Tailwind v3, no v4, a propósito. La v4 compila sus utilidades dentro de
// `@layer` y define sus colores con `oklch()`: lo primero existe desde Chrome 99
// y lo segundo desde Chrome 111. El WebView de un celular sin actualizar (medido
// en el Huawei de prueba: Chrome 92) no entiende `@layer`, y al toparse con un
// at-rule desconocido descarta el bloque entero — o sea, TODAS las utilidades.
// El síntoma era una imagen con `w-20 h-20` dibujándose en sus 1024px naturales.
//
// La v3 emite CSS plano, con colores en hex, que funciona igual en un navegador
// viejo y en uno nuevo. Antes de volver a la v4, comprobar qué WebView tienen
// los celulares de los socios.
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      // `rounded-4xl` lo trae la v4 de fábrica, la v3 llega hasta `3xl`. Se
      // repone con el mismo valor que tenía en v4 para que la tarjeta del
      // perfil del socio conserve su curva, en vez de bajarla a `rounded-3xl`
      // y cambiar el diseño de refilón.
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
