// Gráficas del dashboard: SVG propio con la paleta del taller (variables --c-*), entrada animada y magnificación al
// pasar o tocar. Con prefers-reduced-motion se dibujan de una vez.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodo = (tag, attrs = {}, padre) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (padre) padre.append(n); return n; };
  const bonito = (max) => { if (max <= 0) return 1; const p = 10 ** Math.floor(Math.log10(max)), f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  // curva suave que pasa por los puntos (Catmull-Rom convertida a Bézier)
  const curva = (pts, base, t = pts.length > 14 ? 0.1 : 0.18) => pts.map((p, i) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const a = pts[i - 2] || pts[i - 1], b = pts[i - 1], d = pts[i + 1] || p;
    const y1 = Math.min(base, b[1] + (p[1] - a[1]) * t), y2 = Math.min(base, p[1] - (d[1] - b[1]) * t);
    return `C${b[0] + (p[0] - a[0]) * t},${y1} ${p[0] - (d[0] - b[0]) * t},${y2} ${p[0]},${p[1]}`;
  }).join('');
  const revelar = (g, ms = 900) => { if (!calmo()) g.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: ms, easing: EASE }); };
  const res = (c) => (c.startsWith('var(') ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() : c);
  // rotula solo lo que cabe: una etiqueta cada `step`, y siempre la última
  const visible = (i, n, iw) => { const step = Math.ceil(n / Math.max(2, Math.floor(iw / 56))); return i === n - 1 || (i % step === 0 && n - 1 - i >= step * 0.6); };
  let uid = 0;

  // Área con eje izquierdo (series[0]) y línea punteada opcional con eje derecho (series[1]).
  function area(host, { labels, tips = labels, series, height = 220 }) {
    series = series.map((s) => ({ ...s, color: res(s.color) }));
    const id = ++uid;
    host.classList.add('g-host');
    const dibujar = (anima) => {
      host.querySelectorAll('svg, .g-legend, .g-tip').forEach((n) => n.remove());
      const W = Math.max(280, host.clientWidth), H = height, L = 48, R = series[1] ? 36 : 14, T = 12, B = 26;
      const iw = W - L - R, ih = H - T - B, n = labels.length, base = T + ih;
      const x = (i) => L + (n === 1 ? iw / 2 : iw * i / (n - 1));
      const ymax = series.map((s) => bonito(Math.max(...s.values, 0)));
      const y = (k, v) => base - ih * v / ymax[k];
      const svg = nodo('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `${series.map((s) => s.label).join(' y ')} por semana` });
      const defs = nodo('defs', {}, svg), gr = nodo('linearGradient', { id: `ga${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      nodo('stop', { offset: '0%', 'stop-color': series[0].color, 'stop-opacity': 0.38 }, gr);
      nodo('stop', { offset: '100%', 'stop-color': series[0].color, 'stop-opacity': 0.02 }, gr);
      for (let i = 0; i <= 4; i++) {
        const gy = base - ih * i / 4;
        nodo('line', { class: 'g-grid', x1: L, x2: W - R, y1: gy, y2: gy }, svg);
        const t = nodo('text', { class: 'g-t', x: L - 8, y: gy + 4, 'text-anchor': 'end' }, svg); t.textContent = series[0].tick(ymax[0] * i / 4);
        if (series[1]) { const t2 = nodo('text', { class: 'g-t', x: W - R + 8, y: gy + 4 }, svg); t2.textContent = series[1].tick(ymax[1] * i / 4); }
      }
      labels.forEach((l, i) => { if (!visible(i, n, iw)) return; const t = nodo('text', { class: 'g-t', x: x(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, svg); t.textContent = l; });
      const capa = nodo('g', {}, svg);
      const pts = series.map((s, k) => s.values.map((v, i) => [x(i), y(k, v)]));
      nodo('path', { d: `${curva(pts[0], base)}L${x(n - 1)},${base}L${x(0)},${base}Z`, fill: `url(#ga${id})` }, capa);
      series.forEach((s, k) => nodo('path', { d: curva(pts[k], base), fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linecap': 'round', ...(k ? { 'stroke-dasharray': '6 5' } : {}) }, capa));
      const guia = nodo('line', { class: 'g-guide', y1: T, y2: base }, svg);
      const puntos = series.map((s, k) => pts[k].map(([px, py], i) => {
        const c = nodo('circle', { class: 'g-pt', cx: px, cy: py, r: 4.5, stroke: s.color }, svg);
        if (anima && !calmo()) c.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, delay: 500 + i * 70, easing: EASE, fill: 'backwards' });
        return c;
      }));
      host.append(svg);
      const tip = document.createElement('div'); tip.className = 'g-tip'; host.append(tip);
      const leg = document.createElement('div'); leg.className = 'g-legend';
      series.forEach((s, k) => { const i = document.createElement('span'); i.innerHTML = `<i style="background:${s.color}${k ? ';opacity:.85' : ''}"></i>`; i.append(s.label); leg.append(i); });
      host.append(leg);
      const marcar = (i) => {
        guia.setAttribute('x1', x(i)); guia.setAttribute('x2', x(i)); guia.style.opacity = 1;
        puntos.forEach((fila) => fila.forEach((c, j) => c.classList.toggle('on', j === i)));
        tip.innerHTML = `<b>${tips[i]}</b>${series.map((s) => `<span><i style="background:${s.color}"></i>${s.label}<strong>${s.format(s.values[i])}</strong></span>`).join('')}`;
        const w = tip.offsetWidth; tip.style.transform = `translate(${Math.max(4, Math.min(W - w - 4, x(i) - w / 2))}px, 0)`; tip.style.opacity = 1;
      };
      const fuera = () => { guia.style.opacity = 0; tip.style.opacity = 0; puntos.forEach((f) => f.forEach((c) => c.classList.remove('on'))); };
      const sobre = (e) => { const r = svg.getBoundingClientRect(); marcar(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) * (W / r.width) - L) / iw * (n - 1))))); };
      svg.addEventListener('pointermove', sobre); svg.addEventListener('pointerdown', sobre); svg.addEventListener('pointerleave', fuera);
      if (anima) revelar(capa);
    };
    dibujar(true);
    let w0 = host.clientWidth;
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (Math.abs(host.clientWidth - w0) > 4) { w0 = host.clientWidth; dibujar(false); } }).observe(host);
  }

  // Pastel: al pasar sobre una rebanada (o su fila) se separa del centro.
  function pastel(host, { rows, vacio = 'Sin vehículos en este periodo', format = String, pill = String }) {
    host.innerHTML = '';
    const total = rows.reduce((t, r) => t + r.value, 0);
    if (!total) { host.innerHTML = `<div class="empty">${vacio}</div>`; return; }
    const wrap = document.createElement('div'); wrap.className = 'g-pie';
    const svg = nodo('svg', { viewBox: '0 0 240 240', role: 'img', 'aria-label': rows.map((r) => `${r.label}: ${r.value}`).join(', ') }, wrap);
    const cx = 120, cy = 120, R = 98, pt = (a, r = R) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const ul = document.createElement('ul'); ul.className = 'g-leg';
    const unico = rows.filter((r) => r.value).length === 1;
    let a0 = -Math.PI / 2, k = 0;
    rows.forEach((row) => {
      const li = document.createElement('li'); li.style.setProperty('--c', row.color);
      li.innerHTML = `<i></i><span></span><b>${format(row.value)} <small>${Math.round(row.value / total * 100)} %</small></b>`; li.querySelector('span').textContent = row.label; ul.append(li);
      if (!row.value) return;
      const ang = row.value / total * 2 * Math.PI, a1 = a0 + ang, am = (a0 + a1) / 2;
      const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
      const d = unico ? `M${cx - R},${cy}a${R},${R} 0 1 0 ${2 * R},0a${R},${R} 0 1 0 ${-2 * R},0Z` : `M${cx},${cy}L${x0},${y0}A${R},${R} 0 ${ang > Math.PI ? 1 : 0} 1 ${x1},${y1}Z`;
      const gr = nodo('g', { class: 'g-slice', tabindex: 0 }, svg);
      gr.style.setProperty('--dx', `${Math.cos(am) * 9}px`); gr.style.setProperty('--dy', `${Math.sin(am) * 9}px`);
      nodo('path', { d, fill: res(row.color) }, gr);
      if (ang > 0.4 || unico) { const [lx, ly] = unico ? [cx, cy] : pt(am, R * 0.64); nodo('circle', { class: 'g-pill', cx: lx, cy: ly, r: 14 }, gr); const t = nodo('text', { class: 'g-pv', x: lx, y: ly }, gr); t.textContent = pill(row.value); }
      if (!calmo()) gr.animate([{ opacity: 0, transform: 'scale(0.5)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 520, delay: k * 90, easing: EASE, fill: 'backwards' });
      gr.style.transformOrigin = `${cx}px ${cy}px`;
      const on = () => { gr.classList.add('on'); li.classList.add('on'); }, off = () => { gr.classList.remove('on'); li.classList.remove('on'); };
      if (row.href) [gr, li].forEach((n) => { n.classList.add('g-link'); n.style.cursor = 'pointer'; n.addEventListener('click', () => { location.hash = row.href; }); n.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = row.href; }); if (n === li) { n.tabIndex = 0; n.setAttribute('role', 'link'); } });
      [gr, li].forEach((n) => { n.addEventListener('pointerenter', on); n.addEventListener('pointerleave', off); n.addEventListener('focus', on); n.addEventListener('blur', off); });
      a0 = a1; k++;
    });
    const tot = document.createElement('li'); tot.className = 'g-total'; tot.innerHTML = `<span>Total</span><b>${format(total)}</b>`; ul.append(tot);
    wrap.append(ul); host.append(wrap);
  }

  // Columnas con degradado ámbar → rojo; la última (periodo en curso) va más intensa.
  function columnas(host, { labels, tips = labels, values, format = String, tick, height = 280, etiqueta = 'Cobrado' }) {
    host.classList.add('g-host');
    const id = ++uid;
    const dibujar = (anima) => {
      host.querySelectorAll('svg, .g-tip').forEach((n) => n.remove());
      const W = Math.max(280, host.clientWidth), H = height, L = 54, R = 12, T = 12, B = 28, iw = W - L - R, ih = H - T - B, n = values.length, base = T + ih;
      const ymax = bonito(Math.max(...values, 1)), paso = iw / n, bw = Math.min(64, paso * 0.62);
      const svg = nodo('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `${etiqueta}: ${tips.map((t, i) => `${t} ${format(values[i])}`).join(', ')}` });
      const gr = nodo('linearGradient', { id: `gc${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, nodo('defs', {}, svg));
      nodo('stop', { offset: '0%', 'stop-color': res('var(--c-amber)') }, gr); nodo('stop', { offset: '100%', 'stop-color': res('var(--c-red)') }, gr);
      for (let i = 0; i <= 4; i++) {
        const gy = base - ih * i / 4; nodo('line', { class: 'g-grid', x1: L, x2: W - R, y1: gy, y2: gy }, svg);
        const t = nodo('text', { class: 'g-t', x: L - 8, y: gy + 4, 'text-anchor': 'end' }, svg); t.textContent = tick(ymax * i / 4);
      }
      const tip = document.createElement('div'); tip.className = 'g-tip';
      values.forEach((v, i) => {
        const bx = L + paso * i + (paso - bw) / 2, bh = Math.max(2, ih * v / ymax);
        if (visible(i, n, iw)) { const t = nodo('text', { class: 'g-t', x: bx + bw / 2, y: H - 8, 'text-anchor': 'middle' }, svg); t.textContent = labels[i]; }
        const b = nodo('rect', { class: 'g-bar', x: bx, y: base - bh, width: bw, height: bh, rx: Math.min(8, bw / 3), fill: `url(#gc${id})`, 'fill-opacity': i === n - 1 ? 1 : 0.78, tabindex: 0 }, svg);
        if (anima && !calmo()) b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 650, delay: i * 35, easing: EASE, fill: 'backwards' });
        const on = () => { b.classList.add('on'); tip.innerHTML = `<b>${tips[i]}</b><span>${etiqueta}<strong>${format(v)}</strong></span>`; const w = tip.offsetWidth; tip.style.transform = `translate(${Math.max(4, Math.min(W - w - 4, bx + bw / 2 - w / 2))}px, ${Math.max(0, base - bh - 58)}px)`; tip.style.opacity = 1; };
        const off = () => { b.classList.remove('on'); tip.style.opacity = 0; };
        b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', off); b.addEventListener('focus', on); b.addEventListener('blur', off);
      });
      host.append(svg, tip);
    };
    dibujar(true);
    let w0 = host.clientWidth;
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (Math.abs(host.clientWidth - w0) > 4) { w0 = host.clientWidth; dibujar(false); } }).observe(host);
  }

  // Barras horizontales, una por fila y cada una con su color.
  function barras(host, rows, { format = String } = {}) {
    host.innerHTML = '';
    const max = Math.max(...rows.map((r) => r.value), 1);
    rows.forEach((r, i) => {
      const f = document.createElement('div'); f.className = 'g-hrow'; f.tabIndex = 0; f.style.setProperty('--c', r.color); f.style.setProperty('--w', `${r.value / max * 100}%`); f.style.setProperty('--d', `${i * 70}ms`);
      f.innerHTML = '<span class="g-hl"></span><span class="g-track"><i></i></span><b class="g-hv"></b>';
      f.querySelector('.g-hl').textContent = r.label; f.querySelector('.g-hv').textContent = format(r.value);
      if (r.href) { f.classList.add('g-link'); f.setAttribute('role', 'link'); f.addEventListener('click', () => { location.hash = r.href; }); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = r.href; }); }
      host.append(f);
    });
  }

  // Línea mínima para una tarjeta de indicador.
  function chispa(host, values, color) {
    color = res(color);
    const W = Math.max(60, host.clientWidth), H = 34, n = values.length, max = Math.max(...values, 1);
    const pts = values.map((v, i) => [2 + (W - 4) * i / Math.max(1, n - 1), H - 3 - (H - 8) * v / max]);
    const svg = nodo('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' });
    const g = nodo('g', {}, svg);
    nodo('path', { d: `${curva(pts, H - 2)}L${W - 2},${H - 2}L2,${H - 2}Z`, fill: color, 'fill-opacity': 0.14 }, g);
    nodo('path', { d: curva(pts, H - 2), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    host.innerHTML = ''; host.append(svg); revelar(g, 700);
  }

  window.Graficas = { area, columnas, pastel, barras, chispa };
})();
