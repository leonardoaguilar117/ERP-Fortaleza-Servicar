// Fase 4 (demostración): Administración. Balance, Bancos y flujos, Empleados y roles.
// "Gastos y compras" vive en js/fase3.js y se muestra dentro de este mismo grupo del menú.
// Todo se calcula en el navegador a partir de los pagos, compras y gastos de las órdenes (ver js/datos4.js).
(() => {
  const A = window.FSApp, F = window.FS;
  const { view, puede, esc, money, toast, setTitle, ICO, seg2, segHtml, tickMoney, suma, I, PALETA, fCorta, bloqueado, formulario, descargar, MES_L } = A;
  const HOY = F.FLUJO_HOY, INICIO = F.FLUJO_INICIO;
  const sumaDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const etiquetasDia = (ds) => ds.map((x) => String(+x.slice(8)));
  const tipsDia = (ds) => ds.map((x) => A.fmtDia(x));
  const kp = (l, ico, v, c, tono, href = '', cls = '') => {
    const cuerpo = `<div class="kpi-top"><div class="kpi-label">${l}</div><span class="kpi-ico">${ico}</span></div><div class="kpi-value num ${cls}">${v}</div><div class="cap">${c}</div>`;
    return href ? `<a class="kpi" data-rise href="${href}" style="--tono:var(--c-${tono})">${cuerpo}</a>` : `<div class="kpi" data-rise style="--tono:var(--c-${tono})">${cuerpo}</div>`;
  };
  const signo = (v) => (v >= 0 ? 'v-pos' : 'v-neg');
  const real = (m) => m.filter((x) => !x.interno); // sin transferencias entre cuentas
  const nombreCuenta = (id) => F.cuentas.find((c) => c.id === id)?.nombre || id;

  const ICO4 = {
    bank: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 6 8 2.5 14 6M3.5 6.5v5M6.5 6.5v5M9.5 6.5v5M12.5 6.5v5M2 13.5h12"/></svg>`,
    scale: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 2v12M3 5h10M3 5l-1.5 4a2 2 0 0 0 3 0zM13 5l-1.5 4a2 2 0 0 0 3 0zM5.5 14h5"/></svg>`,
    cam: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 5.5h2.5L6 3.5h4L11.5 5.5H14v7H2z"/><circle cx="8" cy="9" r="2.2"/></svg>`,
    lock: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>`,
  };

  // ---------- periodo de los flujos: compartido por Balance y Bancos ----------
  // Los movimientos de la demostración arrancan el 1 de octubre, que es cuando se fijó el saldo inicial de cada cuenta.
  let rF = { k: 'mes', desde: INICIO, hasta: HOY };
  const PRESETS = { hoy: () => [HOY, HOY], '7d': () => [sumaDias(HOY, -6), HOY], mes: () => [INICIO, HOY] };
  const fechaL = (iso) => `${+iso.slice(8)} de ${MES_L[+iso.slice(5, 7) - 1]}`;
  const rangoTxt = (r) => (r.desde === r.hasta ? `el ${fechaL(r.desde)}` : `del ${fechaL(r.desde)} al ${fechaL(r.hasta)}`);
  const enRango = (f) => f >= rF.desde && f <= rF.hasta;
  const diasRango = () => { const d = []; for (let f = rF.desde; f <= rF.hasta; f = sumaDias(f, 1)) d.push(f); return d; };
  const periodoHtml = (extra = '') => `<div class="actions periodo">${segHtml([['hoy', 'Hoy'], ['7d', '7 días'], ['mes', 'Este mes'], ['otro', 'Elegir fechas']], rF.k, 'Periodo de los flujos')}
      <div class="fechas" ${rF.k === 'otro' ? '' : 'hidden'}><label><span class="sr">Desde</span><input type="date" id="p-desde" value="${rF.desde}" min="${INICIO}" max="${HOY}"></label><span aria-hidden="true">–</span><label><span class="sr">Hasta</span><input type="date" id="p-hasta" value="${rF.hasta}" min="${INICIO}" max="${HOY}"></label></div>${extra}</div>`;
  function periodoEventos() {
    const fechas = view.querySelector('.periodo .fechas'), fd = view.querySelector('#p-desde'), fh = view.querySelector('#p-hasta');
    seg2(view.querySelector('.periodo .seg2'), (k) => {
      if (k === 'otro') { fechas.hidden = false; rF.k = 'otro'; fd.focus(); return; }
      const [desde, hasta] = PRESETS[k](); rF = { k, desde, hasta }; A.render(false);
    });
    const cambiar = () => {
      if (!fd.value || !fh.value) return;
      const [a, b] = [fd.value, fh.value].map((v) => (v < INICIO ? INICIO : v > HOY ? HOY : v)).sort();
      rF = { k: 'otro', desde: a, hasta: b }; A.render(false);
    };
    fd.addEventListener('change', cambiar); fh.addEventListener('change', cambiar);
  }
  // un solo día no dibuja tendencia: se muestra el total y se pide un periodo más largo
  const tendencia = (host, ds, serie) => {
    if (ds.length < 2) { host.innerHTML = '<div class="empty">Elige un periodo de dos días o más para ver la tendencia; los totales están arriba.</div>'; return; }
    Graficas.area(host, { labels: etiquetasDia(ds), tips: tipsDia(ds), height: 250, series: [serie] });
  };
  const saldoAl = (id, todos, f) => F.saldoDe(id, todos.filter((x) => x.fecha <= f));

  // =====================================================================================================
  // BALANCE
  // =====================================================================================================
  function renderBalance() {
    setTitle('Balance');
    if (!puede.tiene('flujos')) { bloqueado('Balance'); return; }
    const todos = F.movimientos(), mov = real(todos).filter((x) => enRango(x.fecha));
    const ing = suma(mov.filter((x) => x.tipo === 'ingreso').map((x) => x.monto));
    const compras = suma(mov.filter((x) => x.tipo === 'egreso' && x.categoria === 'Compras para órdenes').map((x) => x.monto));
    const gastosOp = suma(mov.filter((x) => x.tipo === 'egreso' && x.categoria !== 'Compras para órdenes').map((x) => x.monto));
    const egr = suma([compras, gastosOp]), neto = suma([ing, -egr]);
    const enCuentas = suma(F.cuentas.map((c) => saldoAl(c.id, todos, rF.hasta)));
    // situación a hoy: no depende del periodo
    const piso = F.servicios.filter((s) => s.estatus !== 'ENTREGADO');
    const porCobrar = suma(piso.map((s) => Math.max(0, s.calc.saldo)));
    const porPagar = suma(F.compras.filter((c) => c.estatus === 'pendiente').map((c) => c.costo));
    const saldos = F.cuentas.map((c) => ({ ...c, saldo: F.saldoDe(c.id, todos) }));
    const efectivo = suma(saldos.filter((c) => c.tipo === 'Efectivo').map((c) => c.saldo)), bancos = suma(saldos.filter((c) => c.tipo !== 'Efectivo').map((c) => c.saldo));
    const activos = suma([efectivo, bancos, porCobrar]), capital = suma([activos, -porPagar]);
    const entregados = F.servicios.filter((s) => s.estatus === 'ENTREGADO' && enRango(s.entrega.slice(0, 10)));
    const utilidad = suma(entregados.map((s) => s.calc.utilidad)), resultado = suma([utilidad, -gastosOp]);
    const cats = {};
    mov.filter((x) => x.tipo === 'egreso').forEach((x) => { cats[x.categoria] = suma([cats[x.categoria] || 0, x.monto]); });
    const filasCat = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const ds = diasRango(), saldoDia = ds.map((d) => suma(F.cuentas.map((c) => saldoAl(c.id, todos, d))));
    const fila = (t, v, cls = '', href = '') => `<tr${href ? ` class="link" tabindex="0" data-href="${href}"` : ''}><td>${t}</td><td class="n ${cls}">${v}</td></tr>`;
    const etiqueta = rangoTxt(rF);

    view.innerHTML = `
      <div class="title-row"><div><h1>Balance</h1><p class="sub">Flujos ${etiqueta} · lo cobrado y lo pagado, no lo facturado</p></div>
        ${periodoHtml(`<button class="btn" type="button" data-export>${I.down}Exportar a Excel</button>`)}</div>
      <section class="kpis" aria-label="Resumen del periodo">
        ${kp('Ingresos', ICO.dollar, money(ing), 'cobros de servicios, neto de comisión, y otros ingresos', 'green', '#/bancos?tipo=ingreso', 'v-pos')}
        ${kp('Egresos', I.cart, money(egr), `${money(compras)} en compras · ${money(gastosOp)} en gastos y otros`, 'red', '#/bancos?tipo=egreso', 'v-neg')}
        ${kp('Flujo neto', ICO.flow, money(neto), neto >= 0 ? 'hubo más ingresos que egresos' : 'hubo más egresos que ingresos', neto >= 0 ? 'green' : 'red', '#/bancos', signo(neto))}
        ${kp('Saldo en cuentas', ICO4.bank, money(enCuentas), `al ${fechaL(rF.hasta)}`, 'blue', '#/bancos')}
      </section>
      <div class="dgrid parejo">
        <section class="panel" data-rise><header><h2>${ICO.flow}Saldo total en cuentas</h2><span class="meta">día a día · ${etiqueta}</span></header><div id="chart-bal"></div></section>
        <section class="panel" data-rise><header><h2>${I.cart}Egresos por categoría</h2><span class="meta">${etiqueta}</span></header><div id="chart-egr"></div></section>
      </div>
      <div class="dgrid parejo">
        <section class="panel flush" data-rise><header><h2>${ICO4.scale}Situación a hoy</h2><span class="meta">no depende del periodo</span></header>
          <div class="table-wrap"><table><tbody>
            <tr class="sec"><td colspan="2">Lo que se tiene</td></tr>
            ${fila('Efectivo en caja', money(efectivo), '', '#/bancos?cuenta=caja')}${fila('Dinero en bancos', money(bancos), '', '#/bancos?cuenta=bbva')}${fila(`Por cobrar a clientes <small>${piso.filter((s) => s.calc.saldo > 0).length} servicios en piso</small>`, money(porCobrar), '', '#/ordenes?f=piso')}
            <tr class="tot"><td>Total</td><td class="n">${money(activos)}</td></tr>
            <tr class="sec"><td colspan="2">Lo que se debe</td></tr>
            ${fila('Por pagar a proveedores', money(porPagar), 'v-neg', '#/compras')}
            <tr class="tot res"><td>Queda para el taller</td><td class="n ${signo(capital)}">${money(capital)}</td></tr>
          </tbody></table></div></section>
        <section class="panel flush" data-rise><header><h2>${I.chart}Resultado del periodo</h2><span class="meta">${etiqueta}</span></header>
          <div class="table-wrap"><table><tbody>
            ${fila(`Utilidad de servicios entregados <small>${entregados.length} servicios · mano de obra + refacciones</small>`, money(utilidad), 'v-pos', '#/reportes')}
            ${fila('Gastos del taller', `−${money(gastosOp)}`, 'v-neg', '#/compras')}
            <tr class="tot res"><td>Resultado</td><td class="n ${signo(resultado)}">${money(resultado)}</td></tr>
          </tbody></table></div>
          <p class="note">La utilidad ya descuenta lo que costaron las refacciones y el TOT de cada orden, por eso aquí no se restan otra vez. Los gastos del taller (renta, nómina, luz) son datos de muestra: el Excel actual no los captura.</p></section>
      </div>`;
    periodoEventos();
    view.querySelectorAll('tr.link').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
    view.querySelector('[data-export]').addEventListener('click', () => descargar(`balance-${rF.desde}-a-${rF.hasta}.csv`, ['Concepto', 'Monto'], [
      ['Periodo', `${rF.desde} a ${rF.hasta}`], ['Ingresos', ing], ['Egresos por compras', -compras], ['Egresos por gastos y otros', -gastosOp], ['Flujo neto', neto], ['Saldo en cuentas al cierre', enCuentas],
      ['Utilidad de servicios entregados', utilidad], ['Resultado', resultado], ['Efectivo en caja (hoy)', efectivo], ['Dinero en bancos (hoy)', bancos], ['Por cobrar a clientes (hoy)', porCobrar], ['Por pagar a proveedores (hoy)', -porPagar],
    ]));
    tendencia(document.getElementById('chart-bal'), ds, { label: 'Saldo en cuentas', values: saldoDia, color: 'var(--c-blue)', format: money, tick: tickMoney });
    Graficas.pastel(document.getElementById('chart-egr'), { rows: filasCat.map(([label, value], i) => ({ label, value, color: A.EGRESOS[i % A.EGRESOS.length], href: label === 'Compras para órdenes' ? '#/compras' : '#/bancos?tipo=egreso' })), format: tickMoney, pill: (v) => `${Math.round(v / 1000)}k`, vacio: `Sin egresos ${etiqueta}` });
  }

  // =====================================================================================================
  // BANCOS Y FLUJOS
  // =====================================================================================================
  function nuevoMovimiento() {
    const cuentas = F.cuentas.map((c) => [c.id, c.nombre]);
    formulario({
      titulo: 'Nuevo movimiento', sub: 'Ingresos, egresos y traspasos entre cuentas. Los cobros y las compras ya entran solos desde las órdenes.',
      campos: [
        { id: 'tipo', label: 'Tipo', tipo: 'select', valor: 'ingreso', opts: [['ingreso', 'Ingreso'], ['egreso', 'Egreso'], ['transferencia', 'Traspaso entre cuentas']] },
        { id: 'monto', label: 'Monto', tipo: 'number', req: true, pista: '0.00' },
        { id: 'cuenta', label: 'Cuenta (origen)', tipo: 'select', valor: 'bbva', opts: cuentas },
        { id: 'destino', label: 'Cuenta destino', tipo: 'select', valor: 'caja', opts: cuentas, hint: 'Solo se usa en los traspasos.' },
        { id: 'concepto', label: 'Concepto', req: true, span: 2, pista: 'Ej. Aportación del dueño, pago de un préstamo' },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, valor: HOY },
      ],
      alGuardar: (v) => {
        const monto = +v.monto || 0, id = `m${Date.now()}`;
        if (v.fecha < INICIO || v.fecha > HOY) { toast(`La fecha debe estar entre el ${fechaL(INICIO)} y hoy.`); return; }
        if (v.tipo === 'transferencia') {
          if (v.cuenta === v.destino) { toast('El origen y el destino deben ser cuentas distintas.'); return; }
          F.manuales.push({ id, fecha: v.fecha, cuenta: v.cuenta, tipo: 'egreso', concepto: v.concepto, monto, interno: true, par: `${id}b` }, { id: `${id}b`, fecha: v.fecha, cuenta: v.destino, tipo: 'ingreso', concepto: v.concepto, monto, interno: true, par: id });
        } else F.manuales.push({ id, fecha: v.fecha, cuenta: v.cuenta, tipo: v.tipo, concepto: v.concepto, monto, interno: false });
        toast('Movimiento registrado.'); A.render(false);
      },
    });
  }

  // ---------- editar y eliminar ----------
  // Se edita en su origen: un gasto en la lista de gastos, una compra en su renglón de la orden (y se recalcula la
  // utilidad), un movimiento manual en sí mismo. Cada cambio queda en la bitácora con quién, qué había y qué quedó.
  const quien = () => A.ROL_NOMBRE[A.rol()];
  const auditar = (accion, antes, despues) => F.auditoria.unshift({ fecha: new Date().toISOString(), quien: quien(), accion, antes, despues });
  const opCuentas = () => F.cuentas.map((c) => [c.id, c.nombre]);
  const fechaOk = (f) => { if (f < INICIO || f > HOY) { toast(`La fecha debe estar entre el ${fechaL(INICIO)} y hoy.`); return false; } return true; };
  const montoOk = (v) => { if (!(+v > 0)) { toast('El monto debe ser mayor que cero.'); return false; } return true; };
  const copia = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'linea' ? undefined : v)));
  const confirmar = (titulo, sub, accion) => formulario({ titulo, sub, campos: [], guardar: 'Eliminar', alGuardar: accion });
  const acciones = (x) => (x.origen === 'cobro'
    ? `<div class="acc-f"><a class="btn small ghost" href="#/orden/${x.servicio}" title="Los cobros se registran y corrigen en su orden">Ver orden</a></div>`
    : `<div class="acc-f"><button class="btn small" type="button" data-edit="${x.origen}:${x.ref}">Editar</button>${x.origen === 'compra' ? '' : `<button class="btn small ghost" type="button" data-del="${x.origen}:${x.ref}">Eliminar</button>`}</div>`);

  function editarManual(id) {
    const x = F.manuales.find((m) => m.id === id);
    if (!x) return;
    if (x.interno) {
      const par = F.manuales.find((m) => m.id === x.par), sale = x.tipo === 'egreso' ? x : par, entra = sale === x ? par : x;
      formulario({
        titulo: 'Editar traspaso', sub: 'Mueve dinero entre dos cuentas del taller; no cuenta como ingreso ni egreso.', guardar: 'Guardar cambios',
        campos: [
          { id: 'monto', label: 'Monto', tipo: 'number', req: true, valor: sale.monto },
          { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, valor: sale.fecha },
          { id: 'cuenta', label: 'Cuenta origen', tipo: 'select', valor: sale.cuenta, opts: opCuentas() },
          { id: 'destino', label: 'Cuenta destino', tipo: 'select', valor: entra.cuenta, opts: opCuentas() },
          { id: 'concepto', label: 'Concepto', req: true, span: 2, valor: sale.concepto },
        ],
        alGuardar: (v) => {
          if (!montoOk(v.monto) || !fechaOk(v.fecha)) return;
          if (v.cuenta === v.destino) { toast('El origen y el destino deben ser cuentas distintas.'); return; }
          const antes = copia(sale);
          Object.assign(sale, { monto: +v.monto, fecha: v.fecha, cuenta: v.cuenta, concepto: v.concepto, editado: true });
          Object.assign(entra, { monto: +v.monto, fecha: v.fecha, cuenta: v.destino, concepto: v.concepto, editado: true });
          auditar('Editó un traspaso', antes, copia(sale)); toast('Traspaso actualizado. El cambio queda en la bitácora.'); A.render(false);
        },
      });
      return;
    }
    formulario({
      titulo: `Editar ${x.tipo === 'ingreso' ? 'ingreso' : 'egreso'}`, sub: 'Movimiento capturado a mano en Bancos y flujos.', guardar: 'Guardar cambios',
      campos: [
        { id: 'tipo', label: 'Tipo', tipo: 'select', valor: x.tipo, opts: [['ingreso', 'Ingreso'], ['egreso', 'Egreso']] },
        { id: 'monto', label: 'Monto', tipo: 'number', req: true, valor: x.monto },
        { id: 'cuenta', label: 'Cuenta', tipo: 'select', valor: x.cuenta, opts: opCuentas() },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, valor: x.fecha },
        { id: 'concepto', label: 'Concepto', req: true, span: 2, valor: x.concepto },
      ],
      alGuardar: (v) => {
        if (!montoOk(v.monto) || !fechaOk(v.fecha)) return;
        const antes = copia(x);
        Object.assign(x, { tipo: v.tipo, monto: +v.monto, cuenta: v.cuenta, fecha: v.fecha, concepto: v.concepto, editado: true });
        auditar(`Editó un ${v.tipo}`, antes, copia(x)); toast(`${v.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} actualizado. El cambio queda en la bitácora.`); A.render(false);
      },
    });
  }
  function eliminarManual(id) {
    const x = F.manuales.find((m) => m.id === id);
    if (!x) return;
    confirmar(`¿Eliminar este ${x.interno ? 'traspaso' : x.tipo}?`, `${esc(x.concepto)} · ${money(x.monto)} · ${fCorta(x.fecha)}. El saldo de la cuenta se recalcula y queda registro en la bitácora.`, () => {
      const ids = [x.id, x.par].filter(Boolean);
      ids.forEach((k) => { const i = F.manuales.findIndex((m) => m.id === k); if (i >= 0) F.manuales.splice(i, 1); });
      auditar(`Eliminó un ${x.interno ? 'traspaso' : x.tipo}`, copia(x), null); toast('Movimiento eliminado.'); A.render(false);
    });
  }
  function editarGasto(id) {
    const g = F.gastos.find((x) => x.id === id);
    if (!g) return;
    formulario({
      titulo: 'Editar gasto', sub: 'Gasto del taller que no pertenece a una orden.', guardar: 'Guardar cambios',
      campos: [
        { id: 'categoria', label: 'Categoría', tipo: 'select', valor: g.categoria, opts: F.CATEGORIAS.map((c) => [c, c]) },
        { id: 'monto', label: 'Monto', tipo: 'number', req: true, valor: g.monto },
        { id: 'concepto', label: 'Concepto', req: true, span: 2, valor: g.concepto },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, valor: g.fecha },
        { id: 'cuenta', label: 'Se pagó desde', tipo: 'select', valor: F.cuentaGasto(g), opts: opCuentas() },
        { id: 'proveedor', label: 'Proveedor o beneficiario', span: 2, valor: g.proveedor || '' },
      ],
      alGuardar: (v) => {
        if (!montoOk(v.monto) || !fechaOk(v.fecha)) return;
        const antes = copia(g);
        Object.assign(g, { categoria: v.categoria, monto: +v.monto, concepto: v.concepto, fecha: v.fecha, cuenta: v.cuenta, proveedor: v.proveedor, editado: true });
        auditar('Editó un gasto', antes, copia(g)); toast('Gasto actualizado. El cambio queda en la bitácora.'); A.render(false);
      },
    });
  }
  function eliminarGasto(id) {
    const i = F.gastos.findIndex((x) => x.id === id), g = F.gastos[i];
    if (!g) return;
    confirmar('¿Eliminar este gasto?', `${esc(g.concepto)} · ${money(g.monto)} · ${fCorta(g.fecha)}. Queda registro en la bitácora.`, () => {
      F.gastos.splice(i, 1); auditar('Eliminó un gasto', copia(g), null); toast('Gasto eliminado.'); A.render(false);
    });
  }
  function editarCompra(id) {
    const c = F.compras.find((x) => x.id === id);
    if (!c) return;
    const s = F.servicios.find((x) => x.codigo === c.servicio);
    formulario({
      titulo: 'Editar compra', sub: `Refacción o TOT de la orden ${c.orden}. Al guardar se recalcula la utilidad de esa orden.`, guardar: 'Guardar cambios',
      campos: [
        { id: 'concepto', label: 'Descripción y número de parte', req: true, span: 2, valor: c.concepto },
        { id: 'proveedor', label: 'Proveedor', req: true, valor: c.proveedor, lista: [...new Set(F.compras.map((x) => x.proveedor).filter(Boolean))] },
        { id: 'costo', label: 'Costo', tipo: 'number', req: true, valor: c.costo },
        { id: 'factura', label: 'Factura o remisión del proveedor', valor: c.factura || '' },
        { id: 'fecha', label: 'Fecha de compra', tipo: 'date', valor: c.fecha || '', hint: 'Déjala vacía si aún está por comprar.' },
      ],
      alGuardar: (v) => {
        if (!montoOk(v.costo) || (v.fecha && !fechaOk(v.fecha))) return;
        const antes = copia(c), fecha = v.fecha || null;
        const estatus = c.estatus === 'propio' ? 'propio' : !fecha ? 'por_comprar' : c.estatus === 'por_comprar' ? 'pendiente' : c.estatus;
        Object.assign(c, { concepto: v.concepto, proveedor: v.proveedor, costo: +v.costo, factura: v.factura || null, fecha, estatus, editado: true });
        if (c.linea) { c.linea[0] = c.concepto; c.linea[1] = c.costo; c.linea[2] = c.proveedor; c.linea[3] = c.factura; c.linea[4] = fecha; }
        const util0 = s?.calc.utilidad;
        if (s) s.calc = F.calcular(s);
        auditar('Editó una compra', antes, copia(c));
        toast(`Compra actualizada.${s && util0 !== s.calc.utilidad ? ` La utilidad de la orden ${c.orden} pasó de ${money(util0)} a ${money(s.calc.utilidad)}.` : ''} El cambio queda en la bitácora.`);
        A.render(false);
      },
    });
  }
  const EDITAR = { manual: editarManual, gasto: editarGasto, compra: editarCompra };
  const ELIMINAR = { manual: eliminarManual, gasto: eliminarGasto };
  Object.assign(A, { editarGasto, eliminarGasto, editarCompra });

  function renderBancos(_, params) {
    setTitle('Bancos y flujos');
    if (!puede.tiene('flujos')) { bloqueado('Bancos y flujos'); return; }
    const todos = F.movimientos();
    const fc = F.cuentas.some((c) => c.id === params.get('cuenta')) ? params.get('cuenta') : '';
    const ft = ['ingreso', 'egreso'].includes(params.get('tipo')) ? params.get('tipo') : '';
    const q = (params.get('q') || '').toLowerCase();
    const delPeriodo = todos.filter((x) => enRango(x.fecha));
    const lista = delPeriodo.filter((x) => (!fc || x.cuenta === fc) && (!ft || x.tipo === ft) && (!q || `${x.concepto} ${x.detalle || ''} ${x.categoria}`.toLowerCase().includes(q)));
    const enlace = (o) => { const p = new URLSearchParams({ ...(fc && { cuenta: fc }), ...(ft && { tipo: ft }), ...(q && { q }), ...o }); [...p].forEach(([k, v]) => { if (!v) p.delete(k); }); const s = p.toString(); return `#/bancos${s ? `?${s}` : ''}`; };
    const entradas = suma(real(delPeriodo).filter((x) => x.tipo === 'ingreso' && (!fc || x.cuenta === fc)).map((x) => x.monto));
    const salidas = suma(real(delPeriodo).filter((x) => x.tipo === 'egreso' && (!fc || x.cuenta === fc)).map((x) => x.monto));
    const etiqueta = rangoTxt(rF);
    const tarjetaCuenta = (c) => `<a class="kpi kpi-f" href="${enlace({ cuenta: fc === c.id ? '' : c.id })}" aria-current="${fc === c.id}" style="--tono:var(--c-${c.tono})"><div class="kpi-top"><div class="kpi-label">${esc(c.nombre)}</div><span class="kpi-ico">${c.tipo === 'Efectivo' ? ICO.cash : ICO4.bank}</span></div><div class="kpi-value num">${money(saldoAl(c.id, todos, rF.hasta))}</div><div class="cap">${c.tipo} · saldo al ${fechaL(rF.hasta)}${fc === c.id ? ' · filtrada' : ''}</div></a>`;
    const ds = diasRango(), cuentasVis = F.cuentas.filter((c) => !fc || c.id === fc);
    const serie = ds.map((d) => suma(cuentasVis.map((c) => saldoAl(c.id, todos, d))));
    const chips = (fc || ft || q) ? `<div class="chips-f">${fc ? `<a class="chip-b" href="${enlace({ cuenta: '' })}">${esc(nombreCuenta(fc))} ✕</a>` : ''}${ft ? `<a class="chip-b" href="${enlace({ tipo: '' })}">${ft === 'ingreso' ? 'Solo ingresos' : 'Solo egresos'} ✕</a>` : ''}${q ? `<a class="chip-b" href="${enlace({ q: '' })}">“${esc(q)}” ✕</a>` : ''}<a class="btn-link" href="#/bancos">Limpiar filtros</a></div>` : '';

    view.innerHTML = `
      <div class="title-row"><div><h1>Bancos y flujos</h1><p class="sub">Movimientos ${etiqueta}. Los cobros solo se registran (efectivo o transferencia); no se cobra desde la plataforma.</p></div>
        ${periodoHtml()}</div>
      <div class="acciones-fila"><button class="btn" type="button" data-export>${I.down}Exportar a Excel</button><button class="btn primary" type="button" data-nuevo>${I.plus}Nuevo movimiento</button></div>
      <section class="kpis" aria-label="Cuentas y totales">
        ${F.cuentas.map(tarjetaCuenta).join('')}
        <a class="kpi kpi-f" href="${enlace({ tipo: ft === 'ingreso' ? '' : 'ingreso' })}" aria-current="${ft === 'ingreso'}" style="--tono:var(--c-green)"><div class="kpi-top"><div class="kpi-label">Ingresos</div><span class="kpi-ico">${ICO.dollar}</span></div><div class="kpi-value num v-pos">${money(entradas)}</div><div class="cap">cobros y otros ingresos</div></a>
        <a class="kpi kpi-f" href="${enlace({ tipo: ft === 'egreso' ? '' : 'egreso' })}" aria-current="${ft === 'egreso'}" style="--tono:var(--c-red)"><div class="kpi-top"><div class="kpi-label">Egresos</div><span class="kpi-ico">${I.cart}</span></div><div class="kpi-value num v-neg">${money(salidas)}</div><div class="cap">compras, gastos y otros egresos</div></a>
      </section>
      <section class="panel" data-rise><header><h2>${ICO.flow}Saldo día a día</h2><span class="meta">${fc ? esc(nombreCuenta(fc)) : 'todas las cuentas'} · ${etiqueta}</span></header><div id="chart-flujo"></div></section>
      <p class="nota-f">Toca una tarjeta para filtrar. Los traspasos entre cuentas mueven el saldo, pero no cuentan como ingreso ni egreso. Todo lo capturado en Administración se puede editar; los cobros se corrigen en su orden.</p>
      <div class="tools"><input class="input" id="f-q" type="search" value="${esc(q)}" placeholder="Buscar por concepto, proveedor o categoría" aria-label="Buscar movimientos"></div>${chips}
      <div class="table-wrap"><table class="respond"><thead><tr><th>Fecha</th><th>Concepto</th><th>Cuenta</th><th>Categoría</th><th class="n">Monto</th><th><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${lista.map((x) => `<tr${x.servicio ? ` class="link" tabindex="0" data-href="#/orden/${x.servicio}"` : ''}><td class="m-hide num">${fCorta(x.fecha)}</td>
          <td><span class="id">${esc(x.concepto)}${x.editado ? ' <span class="pill info">Editado</span>' : ''}</span><span class="sub">${fCorta(x.fecha)}${x.detalle ? ` · ${esc(x.detalle)}` : ''}${x.metodo ? ` · ${x.metodo === 'efectivo' ? 'efectivo' : x.metodo === 'transferencia' ? 'transferencia' : 'depósito de terminal (anterior)'}` : ''}</span></td>
          <td class="m-line2">${esc(nombreCuenta(x.cuenta))}</td><td class="m-hide">${x.interno ? '<span class="pill">Traspaso</span>' : esc(x.categoria)}</td>
          <td class="n m-right ${x.interno ? '' : x.tipo === 'ingreso' ? 'v-pos' : 'v-neg'}">${x.tipo === 'ingreso' ? '+' : '−'}${money(x.monto)}</td><td>${acciones(x)}</td></tr>`).join('') || `<tr><td colspan="6"><div class="empty">Sin movimientos ${etiqueta} con este filtro<a class="btn small" href="#/bancos">Limpiar filtros</a></div></td></tr>`}</tbody></table></div>`;

    periodoEventos();
    view.querySelector('[data-nuevo]').addEventListener('click', nuevoMovimiento);
    // las filas ligadas a una orden las abre el delegado general (app.js), que ignora los clics en botones
    view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { const [o, r] = b.dataset.edit.split(':'); EDITAR[o](r); }));
    view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const [o, r] = b.dataset.del.split(':'); ELIMINAR[o](r); }));
    view.querySelector('#f-q').addEventListener('change', (e) => { location.hash = enlace({ q: e.target.value.trim() }); });
    view.querySelector('[data-export]').addEventListener('click', () => descargar(`movimientos-${rF.desde}-a-${rF.hasta}.csv`, ['Fecha', 'Cuenta', 'Tipo', 'Categoría', 'Concepto', 'Monto'], lista.map((x) => [x.fecha, nombreCuenta(x.cuenta), x.interno ? 'Traspaso' : x.tipo === 'ingreso' ? 'Ingreso' : 'Egreso', x.categoria, x.concepto, x.tipo === 'ingreso' ? x.monto : -x.monto])));
    tendencia(document.getElementById('chart-flujo'), ds, { label: 'Saldo', values: serie, color: 'var(--c-teal)', format: money, tick: tickMoney });
  }

  // =====================================================================================================
  // EMPLEADOS Y ROLES
  // =====================================================================================================
  const ROL_PERSONAL = { Administración: 'Administración', Asesor: 'Asesor de servicio', Técnico: 'Técnico' };
  const abiertos = (id) => F.servicios.filter((s) => s.estatus !== 'ENTREGADO' && (s.tecnico === id || s.asesor === id)).length;

  function nuevoEmpleado() {
    formulario({
      titulo: 'Nuevo empleado', sub: 'Quedará con el rol que elijas. En esta demostración no se envía la invitación por correo.',
      campos: [
        { id: 'nombre', label: 'Nombre', req: true, span: 2 },
        { id: 'rol', label: 'Rol', tipo: 'select', valor: 'Técnico', opts: F.ROLES.map((r) => [r, r]) },
        { id: 'tel', label: 'Teléfono (10 dígitos)', req: true, tipo: 'tel', pista: '5512345678' },
        { id: 'correo', label: 'Correo', req: true, tipo: 'email', span: 2, hint: 'Con este correo entrará al sistema.' },
      ],
      alEscribir: (v, poner) => { const d = v.tel.replace(/\D/g, '').slice(0, 10); if (d !== v.tel) poner('tel', d); },
      alGuardar: (v) => {
        if (v.tel.length !== 10) { toast('El teléfono debe tener 10 dígitos.'); return; }
        if (!/^\S+@\S+\.\S+$/.test(v.correo)) { toast('Revisa el correo: no parece válido.'); return; }
        const id = v.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `emp${Date.now()}`;
        if (F.empleados.some((e) => e.id === id)) { toast('Ya hay un empleado con ese nombre.'); return; }
        F.empleados.push({ id, nombre: v.nombre, rol: v.rol, correo: v.correo.toLowerCase(), tel: v.tel, activo: true, ingreso: HOY });
        if (v.rol !== 'Administración') F.PERSONAL[id] = { nombre: v.nombre.split(' ')[0], rol: ROL_PERSONAL[v.rol], tono: Math.floor(Math.random() * 360) };
        toast(`${esc(v.nombre)} se agregó como ${v.rol.toLowerCase()}.`); A.render(false);
      },
    });
  }

  function renderEmpleados() {
    setTitle('Empleados y roles');
    if (!puede.tiene('empleados')) { bloqueado('Empleados y roles'); return; }
    const E = F.empleados, activos = E.filter((e) => e.activo);
    const porRol = (r) => activos.filter((e) => e.rol === r).length;
    const celda = (e) => `<tr>
        <td><span class="who">${A.avatar(e.id, e.nombre[0], F.PERSONAL[e.id]?.tono ?? 18, 'grande')}<span><span class="id">${esc(e.nombre)}</span><span class="sub">${esc(e.correo)}</span></span></span></td>
        <td class="m-hide">${e.id === 'admin' ? '<span class="pill info">Administración</span>' : `<select class="input rol-sel" data-rol="${e.id}" aria-label="Rol de ${esc(e.nombre)}">${F.ROLES.map((r) => `<option${r === e.rol ? ' selected' : ''}>${r}</option>`).join('')}</select>`}</td>
        <td class="m-hide num">${esc(e.tel.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3'))}</td>
        <td class="m-hide n">${abiertos(e.id) || '<span class="dash">—</span>'}</td>
        <td class="m-right">${e.activo ? '<span class="pill pos">Activo</span>' : '<span class="pill">De baja</span>'}</td>
        <td><div class="acc-f"><button class="btn small" type="button" data-foto="${e.id}">${ICO4.cam}${A.fotoDe(e.id) ? 'Cambiar foto' : 'Agregar foto'}</button>${A.fotoDe(e.id) ? `<button class="btn small ghost" type="button" data-sinfoto="${e.id}">Quitar foto</button>` : ''}${e.id !== 'admin' ? `<button class="btn small ghost" type="button" data-baja="${e.id}">${e.activo ? 'Dar de baja' : 'Reactivar'}</button>` : ''}</div></td></tr>`;
    // casilla editable por rol y permiso; lo fijo se explica en lugar de solo deshabilitarse
    const casilla = (id, rol) => {
      const on = F.tiene(rol, id);
      if (F.fijo(rol, id)) return `<span class="perm fijo" title="Administración conserva este permiso para que nadie se quede sin poder corregir los roles">${ICO4.lock}<span>Siempre</span></span>`;
      return `<label class="perm-chk"><input type="checkbox" data-p="${id}" data-r="${rol}"${on ? ' checked' : ''} aria-label="${esc(rol)}: ${esc(F.nombrePermiso(id))}"><span class="perm-txt">${on ? 'Sí' : 'No'}</span></label>`;
    };
    const requisito = (id) => (F.REQUIERE[id] ? `<small>requiere: ${F.REQUIERE[id].map((r) => F.nombrePermiso(r).toLowerCase()).join(', ')}</small>` : '');

    view.innerHTML = `
      <div class="title-row"><div><h1>Empleados y roles</h1><p class="sub">Quién trabaja en el taller, qué rol tiene y qué puede hacer cada rol.</p></div>
        <div class="actions"><button class="btn primary" type="button" data-nuevo>${I.plus}Nuevo empleado</button></div></div>
      <section class="kpis" aria-label="Resumen">${kp('Empleados activos', ICO.users, activos.length, `${E.length - activos.length} de baja`, 'blue')}${kp('Técnicos', ICO.auto, porRol('Técnico'), 'con servicios asignados', 'plum', '#/ordenes?f=piso')}${kp('Asesores', ICO.chat, porRol('Asesor'), 'atienden al cliente', 'amber')}${kp('Administración', ICO4.scale, porRol('Administración'), 'acceso total', 'teal')}</section>
      <section class="panel flush" data-rise><header><h2>${ICO.users}Equipo</h2><span class="meta">datos de muestra</span></header>
        <div class="table-wrap"><table class="respond"><thead><tr><th>Empleado</th><th>Rol</th><th>Teléfono</th><th class="n">Servicios abiertos</th><th>Estatus</th><th><span class="sr">Acciones</span></th></tr></thead><tbody>${E.map(celda).join('')}</tbody></table></div>
        <p class="note">La foto se recorta a un cuadrado y se guarda en este navegador. En producción se procesa en el servidor (sin datos de ubicación de la cámara) y se guarda en el almacenamiento de archivos.</p></section>
      <section class="panel flush" data-rise><header><h2>${ICO4.scale}Qué puede hacer cada rol</h2><button class="btn small ghost" type="button" data-reset>Restablecer los permisos originales</button></header>
        <div class="table-wrap"><table class="matriz"><thead><tr><th>Permiso</th>${F.ROLES.map((r) => `<th class="c">${r}</th>`).join('')}</tr></thead><tbody>
          ${F.PERMISOS.map(([grupo, filas]) => `<tr class="sec"><td colspan="${F.ROLES.length + 1}">${grupo}</td></tr>${filas.map(([id, t]) => `<tr><td>${t}${requisito(id)}</td>${F.ROLES.map((r) => `<td class="c">${casilla(id, r)}</td>`).join('')}</tr>`).join('')}`).join('')}
        </tbody></table></div>
        <p class="note">Toca una casilla para dar o quitar el permiso; se aplica en cuanto cambia y queda en auditoría. Si un permiso necesita otro, se ajustan juntos. Para comprobarlo, usa "Ver como" en la barra lateral. En producción el servidor quita de cada respuesta lo que el rol no puede ver, no solo la pantalla.</p></section>`;

    view.querySelector('[data-nuevo]').addEventListener('click', nuevoEmpleado);
    view.querySelector('[data-reset]').addEventListener('click', () => { F.restablecerPermisos(); A.pintarQuien(); toast('Se restablecieron los permisos originales de cada rol.'); A.render(false); });
    view.querySelectorAll('[data-p]').forEach((chk) => chk.addEventListener('change', () => {
      const { p, r } = chk.dataset, extra = F.cambiarPermiso(r, p, chk.checked);
      const nom = (k) => `«${F.nombrePermiso(k)}»`;
      toast(`${esc(r)}: ${chk.checked ? 'ahora puede' : 'ya no puede'} ${nom(p)}.${extra.length ? ` También ${chk.checked ? 'se activó' : 'se quitó'} ${extra.map(nom).join(', ')}, porque ${chk.checked ? 'es requisito' : 'depende de ese permiso'}.` : ''} Queda en auditoría.`);
      A.pintarQuien(); A.render(false);
    }));
    view.querySelectorAll('[data-foto]').forEach((b) => b.addEventListener('click', () => A.pedirFoto(b.dataset.foto, () => { A.pintarQuien(); A.render(false); })));
    view.querySelectorAll('[data-sinfoto]').forEach((b) => b.addEventListener('click', () => { A.quitarFoto(b.dataset.sinfoto); A.pintarQuien(); toast('Foto quitada.'); A.render(false); }));
    view.querySelectorAll('[data-baja]').forEach((b) => b.addEventListener('click', () => {
      const e = E.find((x) => x.id === b.dataset.baja), n = abiertos(e.id);
      if (e.activo && n) { toast(`${esc(e.nombre)} tiene ${n} ${n === 1 ? 'servicio abierto' : 'servicios abiertos'}. Reasígnalos antes de darlo de baja.`); return; }
      e.activo = !e.activo; toast(`${esc(e.nombre)}: ${e.activo ? 'reactivado' : 'de baja'}. Su historial se conserva.`); A.render(false);
    }));
    view.querySelectorAll('[data-rol]').forEach((s) => s.addEventListener('change', () => {
      const e = E.find((x) => x.id === s.dataset.rol), n = abiertos(e.id);
      if (n && e.rol === 'Técnico') { s.value = e.rol; toast(`${esc(e.nombre)} tiene ${n} ${n === 1 ? 'servicio abierto' : 'servicios abiertos'}. Reasígnalos antes de cambiar su rol.`); return; }
      e.rol = s.value; if (F.PERSONAL[e.id]) F.PERSONAL[e.id].rol = ROL_PERSONAL[s.value];
      toast(`${esc(e.nombre)} ahora es ${s.value.toLowerCase()}. El cambio queda en auditoría.`); A.render(false);
    }));
  }

  A.rutas.balance = renderBalance; A.rutas.bancos = renderBancos; A.rutas.empleados = renderEmpleados;
  if (['balance', 'bancos', 'empleados'].includes(location.hash.slice(2).split(/[/?]/)[0])) A.render(false);
})();
