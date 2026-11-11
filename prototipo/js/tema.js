// Aplica el tema guardado antes del primer pintado, para que la página no parpadee con el tema por defecto.
// Va en un archivo aparte (no en línea) para que la política de seguridad de contenido pueda prohibir los scripts
// en línea (docker/Caddyfile, SEGURIDAD.md).
try {
  var t = localStorage.getItem('fs-tema');
  if (t === 'deportivo' || t === 'oscuro' || t === 'clasico') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
