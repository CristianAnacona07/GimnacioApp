// Punto de entrada para ejecución en CONTENEDOR / servidor tradicional.
//
// index.js exporta la app de Express y solo llama a app.listen() cuando
// NODE_ENV !== 'production' (pensado para Vercel serverless, que importa la app
// sin escuchar). En un contenedor SÍ tenemos que escuchar un puerto, y como la
// imagen corre con NODE_ENV=production, index.js no abre el puerto → lo hace este
// archivo. Así no hay doble listen ni conflictos con el despliegue en Vercel.
const http = require('http');
const app = require('./index');
const tiempoReal = require('./helpers/tiempoReal');

const PORT = process.env.PORT || 10000;

// El canal en tiempo real necesita el servidor HTTP, no solo la app de Express:
// comparte el mismo puerto y actualiza la conexión a WebSocket cuando el cliente
// lo pide. Por eso aquí se crea el servidor a mano en vez de usar app.listen().
const servidor = http.createServer(app);
tiempoReal.iniciar(servidor);

servidor.listen(PORT, () => {
  console.log(`🚀 API Kodiak escuchando en el puerto ${PORT}`);
});
