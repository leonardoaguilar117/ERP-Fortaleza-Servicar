// Diagrama de daños: cinco vistas SVG por tipo de carrocería. Una zona puede aparecer en varias vistas
// (cofre en la superior; defensas y luces en frente y atrás) y comparte el mismo id, así que marcar una
// la marca en todas. Cada daño lleva color y letra: el estado nunca depende solo del color.
(() => {
  const TIPOS = {
    rayon: { l: 'R', nombre: 'Rayón' },
    golpe: { l: 'G', nombre: 'Golpe o abolladura' },
    estrellado: { l: 'E', nombre: 'Estrellado o roto' },
    faltante: { l: 'F', nombre: 'Faltante' },
  };
  const MAPA = { SEDAN: 'sedan', COUPE: 'sedan', CONVERTIBLE: 'sedan', HATCHBACK: 'hatch', WAGON: 'suv', SUV: 'suv', PICKUP: 'pickup', VAN: 'van', MINIVAN: 'van' };

  // Perfil lateral con el frente a la izquierda; y = 120 es el suelo.
  //   pts: contorno · bandas: cortes en x de salpicadera | puerta del. | puerta tras. | costado
  //   cint: línea de cintura · top: cortes en x de la vista superior (cofre | parabrisas | techo | medallón | cajuela)
  //   cab: altura del techo en frente y atrás
  const PERFIL = {
    sedan: {
      pts: [[18, 104], [18, 88], [28, 81], [112, 75], [156, 43], [246, 43], [300, 74], [382, 79], [382, 104]],
      bandas: [18, 120, 205, 292, 382], cint: 74, ruedas: [68, 330], r: 20, atras: 'Cajuela', costado: 'Costado tras.',
      vidrios: [[[124, 73], [158, 48], [200, 48], [200, 73]], [[208, 73], [208, 48], [244, 48], [286, 73]]],
      top: [20, 130, 164, 250, 282, 380], cab: 28,
    },
    hatch: {
      pts: [[18, 104], [18, 88], [28, 81], [108, 75], [150, 43], [272, 43], [374, 76], [382, 80], [382, 104]],
      bandas: [18, 116, 198, 276, 382], cint: 75, ruedas: [66, 318], r: 20, atras: 'Portón', costado: 'Costado tras.',
      vidrios: [[[120, 73], [152, 48], [194, 48], [194, 73]], [[202, 73], [202, 48], [266, 48], [276, 73]]],
      top: [20, 126, 160, 276, 306, 380], cab: 26,
    },
    suv: {
      pts: [[18, 104], [18, 86], [28, 78], [108, 72], [148, 36], [296, 36], [378, 44], [382, 50], [382, 104]],
      bandas: [18, 112, 200, 290, 382], cint: 71, ruedas: [68, 326], r: 22, atras: 'Portón', costado: 'Costado tras.',
      vidrios: [[[120, 70], [150, 41], [196, 41], [196, 70]], [[204, 70], [204, 41], [286, 41], [286, 70]]],
      top: [20, 122, 154, 298, 326, 380], cab: 18,
    },
    pickup: {
      pts: [[18, 104], [18, 86], [28, 78], [116, 74], [152, 40], [220, 40], [228, 66], [382, 66], [382, 104]],
      bandas: [18, 120, 228, 228, 382], cint: 73, ruedas: [70, 330], r: 23, atras: 'Caja', costado: 'Costado de caja',
      vidrios: [[[124, 72], [154, 45], [216, 45], [222, 72]]],
      top: [20, 130, 160, 222, 236, 380], cab: 24,
    },
    van: {
      pts: [[18, 104], [18, 84], [26, 70], [64, 60], [88, 30], [380, 30], [382, 34], [382, 104]],
      bandas: [18, 84, 176, 300, 382], cint: 58, ruedas: [58, 328], r: 21, atras: 'Puertas traseras', costado: 'Costado tras.',
      vidrios: [[[96, 57], [110, 35], [168, 35], [168, 57]], [[184, 57], [184, 35], [290, 35], [290, 57]], [[308, 57], [308, 35], [372, 35], [372, 57]]],
      top: [20, 70, 104, 322, 346, 380], cab: 8,
    },
  };

  const f = (n) => +n.toFixed(1);
  // estira lo que está sobre el umbral (y = 104) para que la silueta tenga proporción de auto y no de cupé bajo
  const Y = (y) => (y >= 104 ? y : f(104 - (104 - y) * 1.15));
  // polígono con esquinas redondeadas
  const redondo = (pts, r = 6) => pts.map((b, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], c = pts[(i + 1) % pts.length];
    const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k1 = Math.min(r, d1 / 2) / d1, k2 = Math.min(r, d2 / 2) / d2;
    return `${i ? 'L' : 'M'}${f(b[0] + (a[0] - b[0]) * k1)},${f(b[1] + (a[1] - b[1]) * k1)}Q${b[0]},${b[1]} ${f(b[0] + (c[0] - b[0]) * k2)},${f(b[1] + (c[1] - b[1]) * k2)}`;
  }).join('') + 'Z';

  const ETIQ = new Map();
  const etiqueta = (id) => ETIQ.get(id) || id;

  function zona(id, label, forma, cx, cy, danos, rad = 9) {
    ETIQ.set(id, label);
    const d = danos.get(id);
    return `<g class="zg${d ? ` on t-${d}` : ''}" data-zone="${id}" role="button" tabindex="0" aria-pressed="${!!d}" aria-label="${label}${d ? `: ${TIPOS[d].nombre}` : ''}">${forma}${d ? `<circle class="bd" cx="${f(cx)}" cy="${f(cy)}" r="${rad}"/><text class="bt" style="font-size:${rad + 2}px" x="${f(cx)}" y="${f(cy)}">${TIPOS[d].l}</text>` : ''}</g>`;
  }

  function lateral(P, lado, danos) {
    const der = lado === 'der', X = (x) => (der ? 400 - x : x), cp = `cp-${lado}`, sfx = der ? 'der.' : 'izq.';
    const d = redondo(P.pts.map(([x, y]) => [X(x), Y(y)]), 7);
    const nombres = [['fender', 'Salpicadera del.'], ['puerta-del', 'Puerta del.'], ['puerta-tras', 'Puerta tras.'], ['costado', P.costado]];
    let z = '', lineas = '';
    nombres.forEach(([k, n], i) => {
      const a = P.bandas[i], b = P.bandas[i + 1];
      if (b - a < 4) return;
      z += zona(`${lado}-${k}`, `${n} ${sfx}`, `<rect class="z" x="${Math.min(X(a), X(b))}" y="0" width="${Math.abs(X(b) - X(a))}" height="125" clip-path="url(#${cp})"/>`, X((a + b) / 2), 92, danos, 12);
      if (i) lineas += `<path class="ln" d="M${X(a)},${Y(P.cint)}V104"/>`;
    });
    const vidrios = P.vidrios.map((v) => `<path class="gl" d="${redondo(v.map(([x, y]) => [X(x), Y(y)]), 3)}"/>`).join('');
    let ruedas = '', hits = '';
    [['del.', P.ruedas[0]], ['tras.', P.ruedas[1]]].forEach(([n, wx], i) => {
      const cx = X(wx), cy = 120 - P.r;
      ruedas += `<circle class="arch" cx="${cx}" cy="${cy}" r="${P.r + 5}"/><circle class="tire" cx="${cx}" cy="${cy}" r="${P.r}"/><circle class="rim" cx="${cx}" cy="${cy}" r="${f(P.r * 0.5)}"/>`;
      hits += zona(`${lado}-rueda-${i ? 'tras' : 'del'}`, `Rueda ${n} ${sfx}`, `<circle class="z" cx="${cx}" cy="${cy}" r="${P.r + 6}"/>`, cx, cy, danos, 12);
    });
    return `<svg viewBox="0 10 400 116" role="group" aria-label="Lado ${der ? 'derecho' : 'izquierdo'}: toca una zona para marcar un daño">
      <defs><clipPath id="${cp}"><path d="${d}"/></clipPath></defs>
      <line class="ground" x1="6" x2="394" y1="120" y2="120"/>
      <path class="vh" d="${d}"/>${z}${vidrios}${lineas}${ruedas}${hits}</svg>`;
  }

  function superior(P, danos, tipo) {
    const [a, b, c, d, e, g] = P.top;
    const bandas = [['cofre', 'Cofre', a, b, 0], ['parabrisas', 'Parabrisas', b, c, 1], ['techo', tipo === 'CONVERTIBLE' ? 'Capota' : 'Techo', c, d, 0], ['medallon', 'Medallón', d, e, 1], ['cajuela', P.atras, e, g, 0]];
    let z = '', lineas = '';
    bandas.forEach(([id, n, x0, x1, vidrio], i) => {
      const w = x1 - x0;
      if (vidrio) lineas += `<rect class="gl" x="${x0 + 3}" y="34" width="${Math.max(2, w - 6)}" height="92" rx="4" clip-path="url(#cp-top)"/>`;
      z += zona(id, n, `<rect class="z" x="${x0}" y="18" width="${w}" height="124" clip-path="url(#cp-top)"/>`, x0 + w / 2, 80, danos);
      if (i) lineas += `<path class="ln" d="M${x0},24V136"/>`;
    });
    const llantas = P.ruedas.map((wx) => `<rect class="tire" x="${wx - 18}" y="9" width="36" height="11" rx="4"/><rect class="tire" x="${wx - 18}" y="140" width="36" height="11" rx="4"/>`).join('');
    return `<svg viewBox="0 0 400 160" role="group" aria-label="Vista superior: toca una zona para marcar un daño">
      <defs><clipPath id="cp-top"><rect x="20" y="18" width="360" height="124" rx="46"/></clipPath></defs>
      ${llantas}<rect class="vh" x="20" y="18" width="360" height="124" rx="46"/>${z}${lineas}</svg>`;
  }

  // frente (atras = false) o parte trasera (atras = true); desde atrás, la izquierda del vehículo queda a la izquierda
  function extremo(P, danos, atras) {
    const ct = P.cab, cuerpo = redondo([[20, 98], [20, 58], [32, 50], [168, 50], [180, 58], [180, 98]], 8);
    const cabina = redondo([[44, ct], [156, ct], [170, 52], [30, 52]], 8);
    const defensa = atras ? 'def-tras' : 'def-del', nDef = atras ? 'Defensa tras.' : 'Defensa del.';
    const luz = atras ? 'calavera' : 'faro', nLuz = atras ? 'Calavera' : 'Faro';
    const [izqX, derX] = atras ? [30, 128] : [128, 30]; // en el frente, la izquierda del vehículo queda a la derecha de la imagen
    const centro = atras
      ? zona('cajuela', P.atras, '<rect class="z" x="78" y="54" width="44" height="22" rx="5"/>', 100, 65, danos)
      : '<rect class="ln" x="82" y="58" width="36" height="14" rx="3"/>';
    return `<svg viewBox="0 0 200 114" role="group" aria-label="${atras ? 'Parte trasera' : 'Frente'}: toca una zona para marcar un daño">
      <path class="vh" d="${cabina}"/><path class="gl" d="${redondo([[52, ct + 6], [148, ct + 6], [160, 46], [40, 46]], 5)}"/>
      <rect class="tire" x="28" y="92" width="24" height="18" rx="4"/><rect class="tire" x="148" y="92" width="24" height="18" rx="4"/>
      <path class="vh" d="${cuerpo}"/>
      <rect class="lamp" x="${izqX}" y="54" width="42" height="22" rx="6"/><rect class="lamp" x="${derX}" y="54" width="42" height="22" rx="6"/>${atras ? '<rect class="lamp" x="78" y="54" width="44" height="22" rx="5"/>' : ''}<rect class="lamp" x="26" y="78" width="148" height="20" rx="8"/>
      ${zona(`${luz}-izq`, `${nLuz} izq.`, `<rect class="z" x="${izqX}" y="54" width="42" height="22" rx="6"/>`, izqX + 21, 65, danos)}
      ${zona(`${luz}-der`, `${nLuz} der.`, `<rect class="z" x="${derX}" y="54" width="42" height="22" rx="6"/>`, derX + 21, 65, danos)}
      ${centro}
      ${zona(defensa, nDef, '<rect class="z" x="26" y="78" width="148" height="20" rx="8"/>', 100, 88, danos)}</svg>`;
  }

  function vistas(tipo, danos) {
    const P = PERFIL[MAPA[tipo] || 'sedan'];
    const card = (t, svg, ancho) => `<section class="view-card${ancho ? ' wide' : ''}"><h3>${t}</h3>${svg}</section>`;
    return `<div class="views">${card('Lado izquierdo', lateral(P, 'izq', danos))}${card('Lado derecho', lateral(P, 'der', danos))}${card('Vista superior', superior(P, danos, tipo), true)}${card('Frente', extremo(P, danos, false))}${card('Atrás', extremo(P, danos, true))}</div>`;
  }

  // Silueta lateral pequeña para tarjetas (tablero). tipo = carrocería del catálogo; si no se conoce, ilustración genérica.
  const GENERICO = { pts: [[22, 104], [22, 86], [44, 76], [120, 70], [170, 44], [250, 44], [310, 70], [378, 78], [378, 104]], ruedas: [76, 318], r: 20, vidrios: [] };
  function silueta(tipo) {
    const k = MAPA[tipo], P = k ? PERFIL[k] : GENERICO;
    const vid = P.vidrios.map((v) => `<path class="sl-gl" d="${redondo(v.map(([x, y]) => [x, Y(y)]), 3)}"/>`).join('');
    const ru = P.ruedas.map((wx) => `<circle class="sl-tire" cx="${wx}" cy="${120 - P.r}" r="${P.r}"/><circle class="sl-rim" cx="${wx}" cy="${120 - P.r}" r="${f(P.r * 0.45)}"/>`).join('');
    return `<svg class="silueta${k ? '' : ' gen'}" viewBox="0 18 400 106" aria-hidden="true"><path class="sl-body" d="${redondo(P.pts.map(([x, y]) => [x, Y(y)]), 8)}"/>${vid}${ru}</svg>`;
  }

  window.Diagrama = { TIPOS, vistas, etiqueta, silueta };
})();
