import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// El backend es CommonJS: el router se trae con require, como el resto.
const requerir = createRequire(import.meta.url);
const { enlaceSeguro } = requerir('../routes/pagos');

describe('enlaceSeguro', () => {
  it('deja pasar http y https tal cual', () => {
    expect(enlaceSeguro('https://recibe.nequi.com/abc123')).toBe('https://recibe.nequi.com/abc123');
    expect(enlaceSeguro('http://pagos.gimnasio.co/plan')).toBe('http://pagos.gimnasio.co/plan');
  });

  it('recorta los espacios de un pegado descuidado', () => {
    expect(enlaceSeguro('  https://checkout.wompi.co/l/abc  ')).toBe('https://checkout.wompi.co/l/abc');
  });

  it('rechaza javascript:, que es el que importa', () => {
    // Lo escribe el gimnasio y lo toca el socio: esto correría en su navegador.
    expect(enlaceSeguro('javascript:alert(document.cookie)')).toBeNull();
    expect(enlaceSeguro('JavaScript:alert(1)')).toBeNull();
  });

  it('rechaza otros esquemas que no son para navegar', () => {
    expect(enlaceSeguro('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(enlaceSeguro('file:///etc/passwd')).toBeNull();
  });

  it('rechaza lo que no es una dirección', () => {
    expect(enlaceSeguro('nequi 3003257528')).toBeNull();
    expect(enlaceSeguro('www.nequi.com')).toBeNull(); // sin esquema no es una URL
  });

  it('vacío, espacios, null y undefined dan null: así se borra el enlace', () => {
    expect(enlaceSeguro('')).toBeNull();
    expect(enlaceSeguro('   ')).toBeNull();
    expect(enlaceSeguro(null)).toBeNull();
    expect(enlaceSeguro(undefined)).toBeNull();
  });
});
