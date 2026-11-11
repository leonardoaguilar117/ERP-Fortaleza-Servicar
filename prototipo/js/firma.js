// Firma del técnico que recibe el vehículo (especificación §3.3).
//
// La firma no se guarda como imagen: se guardan los puntos de cada trazo como enteros (el primero absoluto y los
// demás como diferencia con el anterior) y un sello SHA-256 de los trazos, el folio, el técnico y la hora. Al mostrarla
// se dibuja como SVG. Si alguien altera los trazos o cambia de folio la firma, el sello deja de coincidir.
//
// Formato: trazos separados por ";", cada uno "x,y,dx,dy,dx,dy…" sobre un lienzo lógico de 600 × 200.
(() => {
  const ANCHO = 600,
    ALTO = 200,
    MIN_PUNTOS = 8, // menos que esto es un toque accidental, no una firma
    FORMATO = /^-?\d+(,-?\d+)+(;-?\d+(,-?\d+)+)*$/;

  const valida = (t) => typeof t === 'string' && t.length <= 12000 && FORMATO.test(t);
  const puntos = (t) => (valida(t) ? t.split(/[;,]/).length / 2 : 0);

  // Los trazos ya son coordenadas relativas: pasan casi directo al atributo `d` de un <path>.
  function svg(trazos, titulo = 'Firma') {
    if (!valida(trazos)) return '';
    const d = trazos
      .split(';')
      .map((t) => {
        const n = t.split(',');
        return `M${n[0]} ${n[1]}l${n.slice(2).join(' ') || '0 0'}`;
      })
      .join('');
    return `<svg class="firma-svg" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${titulo}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  }

  // Sello de integridad. `crypto.subtle` solo existe en contexto seguro (https o localhost); sin él no hay sello.
  async function sellar(trazos, folio, tecnico, hora) {
    if (!globalThis.crypto?.subtle) return null;
    const datos = new TextEncoder().encode([trazos, folio, tecnico, hora].join('|'));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Monta el lienzo de firma dentro de `host`. Devuelve { trazos(), firmada(), limpiar() }.
  function montar(host, alCambiar = () => {}) {
    host.innerHTML = `<canvas class="firma-pad" width="${ANCHO}" height="${ALTO}" aria-label="Lienzo para firmar con el dedo o el ratón"></canvas>`;
    const cv = host.querySelector('canvas'),
      ctx = cv.getContext('2d');
    let lista = [], // trazos terminados: arreglos de [x, y]
      actual = null;

    const punto = (e) => {
      const r = cv.getBoundingClientRect();
      return [
        Math.round(Math.min(ANCHO, Math.max(0, ((e.clientX - r.left) / r.width) * ANCHO))),
        Math.round(Math.min(ALTO, Math.max(0, ((e.clientY - r.top) / r.height) * ALTO))),
      ];
    };
    const pintar = () => {
      ctx.clearRect(0, 0, ANCHO, ALTO);
      ctx.strokeStyle = getComputedStyle(cv).color; // la tinta sale del tema, no de un color fijo
      ctx.lineWidth = 3;
      ctx.lineCap = ctx.lineJoin = 'round';
      [...lista, ...(actual ? [actual] : [])].forEach((t) => {
        ctx.beginPath();
        t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (t.length === 1) ctx.lineTo(t[0][0] + 0.1, t[0][1]);
        ctx.stroke();
      });
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      actual = [punto(e)];
      pintar();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!actual) return;
      const p = punto(e),
        [x, y] = actual[actual.length - 1];
      if (Math.abs(p[0] - x) + Math.abs(p[1] - y) < 3) return; // se descartan puntos casi repetidos
      actual.push(p);
      pintar();
    });
    const soltar = () => {
      if (!actual) return;
      lista.push(actual);
      actual = null;
      alCambiar();
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);

    const trazos = () =>
      lista
        .filter((t) => t.length > 1)
        .map((t) => t.flatMap(([x, y], i) => (i ? [x - t[i - 1][0], y - t[i - 1][1]] : [x, y])).join(','))
        .join(';');
    return {
      trazos,
      firmada: () => puntos(trazos()) >= MIN_PUNTOS,
      limpiar() {
        lista = [];
        actual = null;
        pintar();
        alCambiar();
      },
    };
  }

  // ---------- comprobaciones al cargar ----------
  console.assert(valida('10,10,5,-3;40,40,1,1'), 'formato de trazos');
  console.assert(!valida('10,10,5,-3"><script>'), 'los trazos no admiten nada que no sea números');

  window.FS = window.FS || {};
  window.FS.Firma = { montar, svg, sellar, valida, puntos };
})();
