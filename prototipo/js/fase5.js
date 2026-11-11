// =====================================================================================================================
// Clientes, Configuración del taller y formato imprimible de la orden
// ---------------------------------------------------------------------------------------------------------------------
//   - Clientes: cada cliente con sus carros, sus servicios y su saldo. No hay tabla aparte: se arma de los servicios,
//     agrupando por teléfono (en producción es la entidad Customer, especificación §3.1).
//   - Diagnóstico: plantillas por sistema; el técnico marca cada punto (Bien, Atención o Urgente) y anota.
//   - Configuración: datos del taller que salen en el formato de la orden y los parámetros del negocio (solo lectura).
//   - Imprimir orden: hoja de la orden con recepción, daños, inventario, cotización y la firma del técnico. Usa la
//     impresión del navegador ("Guardar como PDF"); en producción el PDF lo genera el servidor.
//
// Se carga después de app.js, fase3.js y fase4.js.
// =====================================================================================================================
(() => {
  const F = window.FS,
    A = window.FSApp;
  const { view, esc, money, int, fecha, fechaHora, toast, setTitle, tiene, puede, vehiculoTxt, pill, telMask } = A;
  const dash = '<span class="dash">—</span>';
  const soloDigitos = (t) => String(t || '').replace(/\D/g, '');

  // ---------------------------------------------------------------------------------------------------------------
  // CLIENTES
  // ---------------------------------------------------------------------------------------------------------------
  function clientes() {
    const mapa = new Map();
    F.servicios.forEach((s) => {
      const tel = soloDigitos(s.cliente.telefono);
      const id = tel || `sin-${s.cliente.nombre}`;
      if (!mapa.has(id))
        mapa.set(id, {
          id,
          tel,
          nombre: s.cliente.nombre,
          rfc: s.cliente.rfc || '',
          servicios: [],
        });
      mapa.get(id).servicios.push(s);
    });
    return [...mapa.values()].map((c) => {
      const vivos = c.servicios.filter((s) => s.estatus !== 'CANCELADO');
      const placas = new Map(c.servicios.map((s) => [s.vehiculo.placas, s.vehiculo]));
      return {
        ...c,
        vehiculos: [...placas.values()],
        abiertos: c.servicios.filter(F.Estados.abierto).length,
        ultimo: c.servicios
          .map((s) => s.ingreso)
          .sort()
          .pop(),
        total: vivos.reduce((t, s) => t + s.calc.total, 0),
        saldo: vivos.filter(F.Estados.abierto).reduce((t, s) => t + s.calc.saldo, 0),
      };
    });
  }

  function renderClientes(args, params = new URLSearchParams()) {
    if (args[0]) return renderCliente(args[0]);
    setTitle('Clientes');
    const importes = puede.importes();
    const q = (params.get('q') || '').trim().toLowerCase();
    const todos = clientes().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const lista = todos.filter(
      (c) =>
        !q ||
        `${c.nombre} ${c.tel} ${c.vehiculos.map((v) => `${v.placas} ${v.marca} ${v.modelo}`).join(' ')}`
          .toLowerCase()
          .includes(q),
    );
    view.innerHTML = `
      <div class="title-row"><div><h1>Clientes</h1>
        <p class="sub">${int(todos.length)} clientes · cada uno conserva sus carros y sus servicios. Se registran al recibir su primer vehículo.</p></div>
        <div class="actions">${tiene('recepcion') ? '<a class="btn primary" href="#/recepcion">Nueva recepción</a>' : ''}</div></div>
      <form class="bit-buscar" role="search"><label class="sr" for="cli-q">Buscar clientes</label>
        <input class="input" id="cli-q" type="search" value="${esc(params.get('q') || '')}" placeholder="Buscar por nombre, teléfono o placas" autocomplete="off">
        <button class="btn" type="submit">Buscar</button>${q ? '<a class="btn ghost" href="#/clientes">Quitar filtro</a>' : ''}</form>
      ${
        lista.length
          ? `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th class="m-hide">Teléfono</th><th>Vehículos</th><th class="n">Servicios</th><th class="n m-hide">Último ingreso</th>${importes ? '<th class="n m-hide">Total</th><th class="n">Por cobrar</th>' : ''}</tr></thead>
        <tbody>${lista
          .map(
            (c) => `<tr class="link" tabindex="0" data-href="#/clientes/${encodeURIComponent(c.id)}">
            <td><span class="id">${esc(c.nombre)}</span>${c.abiertos ? `<span class="sub">${c.abiertos} ${c.abiertos === 1 ? 'servicio abierto' : 'servicios abiertos'}</span>` : ''}</td>
            <td class="num m-hide">${telMask(c.tel)}</td>
            <td>${c.vehiculos.map((v) => `<span class="cli-veh">${esc(vehiculoTxt(v))} <span class="sub">${esc(v.placas)}</span></span>`).join('')}</td>
            <td class="n">${c.servicios.length}</td>
            <td class="n m-hide">${fecha(c.ultimo)}</td>
            ${importes ? `<td class="n m-hide">${c.total ? money(c.total) : dash}</td><td class="n">${c.saldo ? money(c.saldo) : dash}</td>` : ''}</tr>`,
          )
          .join('')}</tbody></table></div>`
          : `<div class="empty">${q ? `Ningún cliente coincide con «${esc(params.get('q'))}». Prueba con un solo apellido o con las placas.` : 'Todavía no hay clientes. Aparecen aquí al guardar su primera recepción.'}</div>`
      }`;
    view.querySelector('.bit-buscar').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = view.querySelector('#cli-q').value.trim();
      location.hash = v ? `#/clientes?q=${encodeURIComponent(v)}` : '#/clientes';
    });
  }

  // Las filas `tr.link[data-href]` las abre el manejador común de app.js (clic o Enter).

  function renderCliente(idCodificado) {
    const id = decodeURIComponent(idCodificado);
    const c = clientes().find((x) => x.id === id);
    if (!c) {
      setTitle('Cliente no encontrado');
      view.innerHTML = `<div class="placeholder-screen"><h1>Cliente no encontrado</h1><p>No hay ningún cliente con ese identificador.</p><a class="btn" href="#/clientes">Volver a clientes</a></div>`;
      return;
    }
    setTitle(c.nombre);
    const importes = puede.importes();
    const servicios = [...c.servicios].sort((a, b) => b.ingreso.localeCompare(a.ingreso));
    view.innerHTML = `
      <div class="detail-head">
        <div>
          <div class="crumbs"><a href="#/clientes">Clientes</a><span aria-hidden="true" class="dash">/</span><h1>${esc(c.nombre)}</h1></div>
          <p class="sub">${c.servicios.length} ${c.servicios.length === 1 ? 'servicio' : 'servicios'} · ${c.vehiculos.length} ${c.vehiculos.length === 1 ? 'vehículo' : 'vehículos'} · cliente desde ${fecha(c.servicios.map((s) => s.ingreso).sort()[0])}</p>
        </div>
        <div class="actions detail-actions">${tiene('recepcion') && c.tel ? `<a class="btn primary" href="#/recepcion?cliente=${c.tel}">Recibir otro vehículo</a>` : ''}</div>
      </div>
      <dl class="facts">
        <div><dt>Teléfono</dt><dd class="num">${telMask(c.tel)}</dd></div>
        <div><dt>Servicios abiertos</dt><dd class="num">${c.abiertos}</dd></div>
        ${importes ? `<div><dt>Total de sus servicios</dt><dd class="num">${money(c.total)}</dd></div><div><dt>Por cobrar</dt><dd class="num">${money(c.saldo)}</dd></div>` : ''}
      </dl>
      <div class="sec-title"><h2>Vehículos</h2><span class="meta">${c.vehiculos.length}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Vehículo</th><th>Placas</th><th class="m-hide">VIN</th><th class="n">Servicios</th><th class="n m-hide">Último kilometraje</th></tr></thead>
        <tbody>${c.vehiculos
          .map((v) => {
            const suyos = c.servicios.filter((s) => s.vehiculo.placas === v.placas);
            const km = Math.max(...suyos.map((s) => s.vehiculo.km || 0));
            return `<tr><td><span class="id">${esc(vehiculoTxt(v))}</span>${v.version ? `<span class="sub">${esc(v.version)}</span>` : ''}</td><td>${esc(v.placas)}</td><td class="mono m-hide">${v.vin ? esc(v.vin) : dash}</td><td class="n">${suyos.length}</td><td class="n m-hide">${km ? `${int(km)} km` : dash}</td></tr>`;
          })
          .join('')}</tbody></table></div>
      <div class="sec-title"><h2>Servicios</h2><span class="meta">${servicios.length}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Orden</th><th>Vehículo</th><th>Estatus</th><th class="n m-hide">Ingreso</th>${importes ? '<th class="n">Total</th><th class="n m-hide">Saldo</th>' : ''}</tr></thead>
        <tbody>${servicios
          .map(
            (
              s,
            ) => `<tr class="link" tabindex="0" data-href="#/orden/${s.codigo}"><td><span class="id num">${s.orden}</span><span class="sub mono">${s.codigo}</span></td>
            <td>${esc(vehiculoTxt(s.vehiculo))}<span class="sub">${esc(s.vehiculo.placas)}</span></td><td>${pill(s.estatus)}</td><td class="n m-hide">${fecha(s.ingreso)}</td>
            ${importes ? `<td class="n">${s.calc.total ? money(s.calc.total) : dash}</td><td class="n m-hide">${F.Estados.abierto(s) && s.calc.saldo ? money(s.calc.saldo) : dash}</td>` : ''}</tr>`,
          )
          .join('')}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // CONFIGURACIÓN
  // ---------------------------------------------------------------------------------------------------------------
  const CAMPOS_TALLER = [
    ['razon', 'Razón social', 'Como aparece en la constancia fiscal'],
    ['rfc', 'RFC del taller', '12 o 13 caracteres'],
    ['domicilio', 'Domicilio', 'Calle, número, colonia, municipio y código postal'],
    ['telefono', 'Teléfono', '10 dígitos'],
    ['horario', 'Horario de atención', 'Por ejemplo: lunes a viernes de 9 a 18 h'],
  ];
  const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

  function renderConfiguracion() {
    setTitle('Configuración');
    const T = F.CONFIG.tallerDatos,
      C = F.CONFIG;
    const faltan = CAMPOS_TALLER.filter(([k]) => !T[k]).map(([, l]) => l.toLowerCase());
    const dato = ([k, l]) =>
      `<div><dt>${l}</dt><dd>${T[k] ? esc(T[k]) : '<span class="dash">Sin capturar</span>'}</dd></div>`;
    view.innerHTML = `
      <div class="title-row"><div><h1>Configuración</h1>
        <p class="sub">Datos del taller que salen en el formato de la orden y parámetros con los que se calcula la utilidad.</p></div></div>
      <div class="sec-title"><h2>Datos del taller</h2><span class="meta">${C.taller} · sucursal ${C.sucursal}</span><button class="btn small" type="button" id="cfg-editar">Editar datos</button></div>
      ${faltan.length ? `<p class="cfg-falta">Falta capturar: ${faltan.join(', ')}. Mientras tanto, el formato de la orden se imprime sin esos datos.</p>` : ''}
      <dl class="facts cfg-facts">${CAMPOS_TALLER.map(dato).join('')}</dl>
      <div class="sec-title"><h2>Parámetros del negocio</h2><span class="meta">solo consulta</span></div>
      <div class="table-wrap"><table><thead><tr><th>Parámetro</th><th class="n">Valor</th><th class="m-hide">Para qué se usa</th></tr></thead><tbody>
        <tr><td>Utilidad de refacciones</td><td class="n">${C.margenRefacciones * 100} %</td><td class="m-hide">Se aplica al costo de las refacciones de cada servicio</td></tr>
        <tr><td>Tarifa de mano de obra</td><td class="n">${money(C.tarifaHoraMO)} por hora</td><td class="m-hide">Convierte la utilidad de mano de obra en horas</td></tr>
        <tr><td>IVA de la comisión</td><td class="n">${C.iva * 100} %</td><td class="m-hide">Se suma a la comisión de cada cobro con terminal</td></tr>
        ${Object.values(C.metodos)
          .filter((m) => !m.historico)
          .map(
            (m) =>
              `<tr><td>Comisión · ${esc(m.nombre)}</td><td class="n">${m.tasaBp ? `${m.tasaBp / 100} %` : 'sin comisión'}</td><td class="m-hide">${m.tasaBp ? 'Se guarda en cada pago con la tasa de ese día' : 'El pago entra completo'}</td></tr>`,
          )
          .join('')}
      </tbody></table></div>
      <p class="note cfg-nota">Cambiar un parámetro altera la utilidad de las órdenes. En el sistema completo cada cambio aplicará solo hacia adelante y quedará en la bitácora; aquí se muestran para consulta.</p>`;

    view.querySelector('#cfg-editar').addEventListener('click', () =>
      A.formulario({
        titulo: 'Datos del taller',
        sub: 'Salen en el encabezado del formato de la orden. Puedes dejar en blanco lo que aún no tengas a la mano.',
        campos: CAMPOS_TALLER.map(([id, label, pista]) => ({
          id,
          label,
          pista,
          valor: T[id],
          span: id === 'domicilio' || id === 'razon' ? 2 : 1,
        })),
        guardar: 'Guardar datos',
        alGuardar: (v) => {
          const nuevo = Object.fromEntries(
            CAMPOS_TALLER.map(([k]) => [
              k,
              String(v[k] || '')
                .trim()
                .slice(0, 200),
            ]),
          );
          nuevo.rfc = nuevo.rfc.toUpperCase().replace(/[\s-]/g, '');
          if (nuevo.rfc && !RFC.test(nuevo.rfc)) {
            toast(
              'El RFC no tiene el formato esperado: 12 caracteres para empresa o 13 para persona física, sin espacios.',
            );
            return false;
          }
          if (nuevo.telefono && soloDigitos(nuevo.telefono).length !== 10) {
            toast('El teléfono del taller debe tener 10 dígitos.');
            return false;
          }
          const antes = { ...T };
          const cambios = CAMPOS_TALLER.map(([k]) => k).filter((k) => antes[k] !== nuevo[k]);
          if (!cambios.length) return;
          Object.assign(T, nuevo);
          F.auditar(
            A.quien(),
            'Editó los datos del taller',
            Object.fromEntries(cambios.map((k) => [k, antes[k] || '—'])),
            Object.fromEntries(cambios.map((k) => [k, nuevo[k] || '—'])),
          );
          F.guardar();
          toast('Datos del taller guardados. Ya salen en el formato de la orden.');
          A.render(false);
        },
      }),
    );
  }

  // ---------------------------------------------------------------------------------------------------------------
  // DIAGNÓSTICO (especificación §2, M06): plantillas por sistema, resultado por punto y nota
  // El técnico elige los sistemas que revisó y marca cada punto. Ningún punto empieza marcado.
  // PLANTILLAS DE MUESTRA: sustituir por las del taller.
  // ---------------------------------------------------------------------------------------------------------------
  const PLANTILLAS = {
    frenos: [
      'Frenos',
      [
        'Balatas delanteras',
        'Balatas traseras',
        'Discos y tambores',
        'Líquido de frenos',
        'Mangueras y líneas',
        'Freno de mano',
      ],
    ],
    suspension: [
      'Suspensión y dirección',
      ['Amortiguadores', 'Horquillas y bujes', 'Rótulas', 'Terminales de dirección', 'Baleros', 'Alineación'],
    ],
    motor: [
      'Motor',
      ['Aceite y filtro', 'Bandas', 'Bujías y bobinas', 'Soportes de motor', 'Fugas de aceite', 'Filtro de aire'],
    ],
    enfriamiento: [
      'Enfriamiento',
      ['Anticongelante', 'Mangueras', 'Radiador', 'Bomba de agua', 'Ventilador', 'Termostato'],
    ],
    electrico: [
      'Sistema eléctrico',
      ['Batería', 'Alternador', 'Marcha', 'Luces', 'Fusibles', 'Códigos de falla (escáner)'],
    ],
    llantas: ['Llantas', ['Desgaste', 'Presión', 'Llanta de refacción', 'Birlos', 'Balanceo']],
  };
  const RESULTADO = {
    bien: ['Bien', 'pos'],
    atencion: ['Atención', 'warn'],
    urgente: ['Urgente', 'neg'],
  };

  // Hallazgos de un diagnóstico guardado: [sistema, punto, resultado, nota], solo con claves y resultados conocidos.
  const puntosDe = (dx) =>
    Object.entries(dx?.puntos || {})
      .map(([k, v]) => {
        const [sis, i] = k.split(':');
        const p = PLANTILLAS[sis]?.[1][+i];
        return p && Array.isArray(v) && RESULTADO[v[0]] ? [PLANTILLAS[sis][0], p, v[0], String(v[1] || '')] : null;
      })
      .filter(Boolean);
  const hallazgosDe = (dx) => puntosDe(dx).filter(([, , r]) => r !== 'bien');

  // Resumen para el detalle de la orden.
  function resumenDiagnostico(s, editable) {
    const dx = s.diagnostico,
      puntos = puntosDe(dx),
      hall = hallazgosDe(dx);
    const boton = editable
      ? `<a class="btn small" href="#/diagnostico/${s.codigo}">${dx ? 'Editar diagnóstico' : 'Capturar diagnóstico'}</a>`
      : '';
    if (!dx && !editable) return '';
    return `<div class="sec-title"><h2>Diagnóstico</h2><span class="meta">${dx ? `${puntos.length} puntos revisados · ${hall.length} ${hall.length === 1 ? 'hallazgo' : 'hallazgos'}` : ''}</span>${boton}</div>
      ${
        !dx
          ? '<div class="empty">Sin diagnóstico capturado. El técnico marca aquí lo que revisó, sistema por sistema.</div>'
          : hall.length
            ? `<div class="rows dx-res">${hall.map(([sis, p, r, nota]) => `<div class="row"><span><b>${esc(p)}</b><span class="sub">${esc(sis)}${nota ? ` · ${esc(nota)}` : ''}</span></span><span class="pill ${RESULTADO[r][1]}">${RESULTADO[r][0]}</span></div>`).join('')}</div>`
            : '<div class="empty">Todo lo revisado está en buen estado.</div>'
      }
      ${dx ? `<p class="dx-pie">Lo capturó ${esc(dx.quien || '')} el ${fechaHora(dx.fecha)}.</p>` : ''}`;
  }

  function renderDiagnostico([codigo]) {
    const s = F.servicios.find((x) => x.codigo === codigo);
    if (!s || !F.Estados.abierto(s)) {
      setTitle('Diagnóstico');
      view.innerHTML = `<div class="placeholder-screen"><h1>Diagnóstico no disponible</h1><p>${s ? 'El servicio ya está cerrado: su diagnóstico solo se consulta en la orden.' : 'No existe ese servicio.'}</p><a class="btn" href="${s ? `#/orden/${s.codigo}` : '#/ordenes'}">Volver</a></div>`;
      return;
    }
    setTitle(`Diagnóstico · orden ${s.orden}`);
    // Estado de la captura: copia de lo guardado, para poder salir sin guardar.
    const puntos = Object.fromEntries(Object.entries(s.diagnostico?.puntos || {}).map(([k, v]) => [k, [...v]]));
    const elegidos = new Set(
      Object.keys(puntos)
        .map((k) => k.split(':')[0])
        .filter((k) => PLANTILLAS[k]),
    );

    view.innerHTML = `
      <div class="title-row">
        <div><div class="crumbs"><a href="#/ordenes">Órdenes</a><span aria-hidden="true" class="dash">/</span><a href="#/orden/${s.codigo}">Orden ${s.orden}</a><span aria-hidden="true" class="dash">/</span><h1>Diagnóstico</h1></div>
          <p class="sub">${esc(vehiculoTxt(s.vehiculo))} · ${esc(s.vehiculo.placas)}${s.falla ? ` · el cliente reporta: ${esc(s.falla)}` : ''}</p></div>
        <div class="actions"><a class="btn ghost" href="#/orden/${s.codigo}">Salir sin guardar</a></div>
      </div>
      <form class="form-grid" id="dx" novalidate>
        <div>
          <fieldset class="fieldset"><legend>Sistemas revisados</legend>
            <p class="desc">Elige solo lo que se revisó. Cada punto empieza sin marcar.</p>
            <div class="dx-sis" role="group" aria-label="Sistemas revisados">${Object.entries(PLANTILLAS)
              .map(
                ([k, [n]]) =>
                  `<button type="button" class="btn" data-sis="${k}" aria-pressed="${elegidos.has(k)}">${n}</button>`,
              )
              .join('')}</div>
          </fieldset>
          <div id="dx-cuerpo"></div>
        </div>
        <aside class="side-sticky">
          <section class="panel summary"><header><h2>Resumen</h2></header>
            <div class="rows" id="dx-resumen"></div>
            <p class="hint" id="dx-falta" style="color:var(--muted);font-size:12px;line-height:16px;margin:12px 0"></p>
            <button class="btn primary" type="submit" id="dx-guardar" aria-describedby="dx-falta" style="width:100%">Guardar diagnóstico</button>
          </section>
        </aside>
      </form>`;
    const $ = (q) => view.querySelector(q);

    const cuerpo = () =>
      [...elegidos]
        .map((k) => {
          const [nombre, lista] = PLANTILLAS[k];
          return `<fieldset class="fieldset"><legend>${nombre}</legend><div class="checklist dx-lista">${lista
            .map((p, i) => {
              const id = `${k}:${i}`,
                [r, nota] = puntos[id] || [];
              return `<div class="check-row dx-row"><span id="dx-${k}-${i}">${p}</span><span class="tri" role="group" aria-labelledby="dx-${k}-${i}">${Object.entries(
                RESULTADO,
              )
                .map(
                  ([v, [l]]) =>
                    `<button type="button" data-p="${id}" data-v="${v}" aria-pressed="${r === v}">${l}</button>`,
                )
                .join(
                  '',
                )}</span>${r && r !== 'bien' ? `<input class="input dx-nota" data-nota="${id}" value="${esc(nota || '')}" placeholder="Qué se encontró (opcional)" aria-label="Nota de ${esc(p)}">` : ''}</div>`;
            })
            .join('')}</div></fieldset>`;
        })
        .join('');

    function actualizar(repintar = true) {
      if (repintar)
        $('#dx-cuerpo').innerHTML =
          cuerpo() || '<div class="empty">Elige arriba al menos un sistema para empezar.</div>';
      const total = [...elegidos].reduce((t, k) => t + PLANTILLAS[k][1].length, 0);
      const marcados = Object.keys(puntos).filter((k) => elegidos.has(k.split(':')[0]));
      const de = (r) => marcados.filter((k) => puntos[k][0] === r).length;
      $('#dx-resumen').innerHTML = [
        ['Sistemas', elegidos.size],
        ['Puntos revisados', `${marcados.length} de ${total}`],
        ['Atención', de('atencion')],
        ['Urgente', de('urgente')],
      ]
        .map(([a, b]) => `<div class="row"><span>${a}</span><span class="num">${b}</span></div>`)
        .join('');
      const falta = !elegidos.size
        ? 'elegir al menos un sistema'
        : total - marcados.length
          ? `marcar ${total - marcados.length} ${total - marcados.length === 1 ? 'punto' : 'puntos'}`
          : '';
      $('#dx-falta').textContent = falta
        ? `Falta: ${falta}.`
        : 'Todo listo. Los hallazgos quedan en la orden para armar la cotización.';
      $('#dx-guardar').disabled = !!falta;
    }

    view.querySelector('.dx-sis').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sis]');
      if (!b) return;
      const k = b.dataset.sis;
      elegidos.has(k) ? elegidos.delete(k) : elegidos.add(k);
      b.setAttribute('aria-pressed', elegidos.has(k));
      actualizar();
    });
    $('#dx-cuerpo').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]');
      if (!b) return;
      const id = b.dataset.p,
        fila = b.closest('.dx-row');
      puntos[id] = [b.dataset.v, puntos[id]?.[1] || ''];
      // Solo cambia esa fila: la lista no se repinta, para no perder el foco ni la posición.
      fila.querySelectorAll('button[data-p]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      let nota = fila.querySelector('.dx-nota');
      if (b.dataset.v === 'bien') nota?.remove();
      else if (!nota) {
        nota = document.createElement('input');
        nota.className = 'input dx-nota';
        nota.dataset.nota = id;
        nota.value = puntos[id][1];
        nota.placeholder = 'Qué se encontró (opcional)';
        nota.setAttribute('aria-label', `Nota de ${fila.querySelector('span').textContent}`);
        fila.append(nota);
      }
      actualizar(false);
    });
    $('#dx-cuerpo').addEventListener('input', (e) => {
      const id = e.target.dataset.nota;
      if (id && puntos[id]) puntos[id][1] = e.target.value.slice(0, 200);
    });
    $('#dx').addEventListener('submit', (e) => {
      e.preventDefault();
      if ($('#dx-guardar').disabled) return;
      const antes = s.diagnostico
        ? {
            puntos: puntosDe(s.diagnostico).length,
            hallazgos: hallazgosDe(s.diagnostico).length,
          }
        : null;
      s.diagnostico = {
        quien: A.quien(),
        fecha: F.CONFIG.ahora,
        puntos: Object.fromEntries(Object.entries(puntos).filter(([k]) => elegidos.has(k.split(':')[0]))),
      };
      const n = hallazgosDe(s.diagnostico).length;
      A.anotar(s, 'Guardó el diagnóstico', antes, {
        puntos: puntosDe(s.diagnostico).length,
        hallazgos: n,
      });
      location.hash = `#/orden/${s.codigo}`;
      toast(`Diagnóstico guardado en la orden ${s.orden}: ${n} ${n === 1 ? 'hallazgo' : 'hallazgos'}.`);
    });
    actualizar();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // FORMATO IMPRIMIBLE DE LA ORDEN
  // Se arma una hoja fuera de la pantalla y se manda a imprimir; el CSS de impresión oculta todo lo demás.
  // No incluye costos, proveedores ni utilidad, y solo lleva precios si el rol puede ver importes.
  // ---------------------------------------------------------------------------------------------------------------
  const ESTADO_INV = { bien: 'Bien', danado: 'Dañado', no: 'No tiene' };

  function hojaOrden(s) {
    const T = F.CONFIG.tallerDatos,
      importes = puede.importes(),
      D = window.Diagrama,
      rec = s.recepcion,
      k = s.calc;
    const nombre = (id) => F.PERSONAL[id]?.nombre || '';
    const inv = (s.inventario || []).map((v, i) => [A.INVENTARIO[i], ESTADO_INV[v]]).filter(([a, b]) => a && b);
    const novedades = inv.filter(([, v]) => v !== 'Bien');
    const tecnicos = [s.tecnico, ...(s.apoyo || [])].map(nombre).filter(Boolean);
    return `
      <header class="imp-cab">
        <div><p class="imp-marca">${esc(F.CONFIG.taller)}</p>
          <p>${[T.razon, T.rfc && `RFC ${T.rfc}`].filter(Boolean).map(esc).join(' · ')}</p>
          <p>${[T.domicilio, T.telefono && `Tel. ${T.telefono}`].filter(Boolean).map(esc).join(' · ')}</p>
          <p>${esc(T.horario)}</p></div>
        <div class="imp-folio"><p class="imp-t">Orden de servicio</p><p class="imp-n">${esc(s.orden)}</p><p>${esc(s.codigo)}</p><p>${F.Estados.etiqueta(s.estatus)}</p></div>
      </header>
      <section class="imp-dos">
        <div><h2>Cliente</h2><p>${esc(s.cliente.nombre)}</p><p>Tel. ${esc(soloDigitos(s.cliente.telefono))}</p></div>
        <div><h2>Vehículo</h2><p>${esc(`${s.vehiculo.marca} ${s.vehiculo.modelo} ${s.vehiculo.anio}`)}${s.vehiculo.version ? ` · ${esc(s.vehiculo.version)}` : ''}</p>
          <p>Placas ${esc(s.vehiculo.placas)}${s.vehiculo.color ? ` · ${esc(s.vehiculo.color)}` : ''}${s.vehiculo.vin ? ` · VIN ${esc(s.vehiculo.vin)}` : ''}</p>
          <p>${s.vehiculo.km ? `${int(s.vehiculo.km)} km` : ''}${s.combustible ? ` · gasolina: ${esc(s.combustible)}` : ''}</p></div>
      </section>
      <section><h2>Recepción</h2>
        <p>Ingresó el ${fechaHora(s.ingreso)}${s.asesor ? ` · asesor: ${esc(nombre(s.asesor))}` : ''}${tecnicos.length ? ` · ${tecnicos.length === 1 ? 'técnico' : 'técnicos'}: ${esc(tecnicos.join(', '))}` : ''}</p>
        <p><b>Falla reportada por el cliente:</b> ${esc(s.falla || 'Sin anotar')}</p></section>
      <section><h2>Daños de carrocería al recibir</h2>
        ${
          (s.danos || []).length
            ? `<ul class="imp-lista">${s.danos.map((d) => `<li>${esc(D?.etiqueta(d.zona) || d.zona)}: ${esc(D?.TIPOS[d.tipo]?.nombre || d.tipo)}${d.nota ? ` (${esc(d.nota)})` : ''}</li>`).join('')}</ul>`
            : `<p>${s.danos ? 'Sin daños visibles al recibir.' : 'No se registraron en la plataforma.'}</p>`
        }</section>
      ${
        inv.length
          ? `<section><h2>Inventario del vehículo</h2><p>${inv.length - novedades.length} de ${inv.length} puntos en buen estado.${novedades.length ? '' : ' Sin novedades.'}</p>
        ${novedades.length ? `<ul class="imp-lista">${novedades.map(([a, b]) => `<li>${esc(a)}: ${b}</li>`).join('')}</ul>` : ''}</section>`
          : ''
      }
      ${
        s.diagnostico
          ? `<section><h2>Diagnóstico</h2><p>${puntosDe(s.diagnostico).length} puntos revisados.${hallazgosDe(s.diagnostico).length ? '' : ' Todo en buen estado.'}</p>
        ${
          hallazgosDe(s.diagnostico).length
            ? `<ul class="imp-lista">${hallazgosDe(s.diagnostico)
                .map(
                  ([sis, p, r, nota]) =>
                    `<li>${esc(sis)} · ${esc(p)}: ${RESULTADO[r][0]}${nota ? ` (${esc(nota)})` : ''}</li>`,
                )
                .join('')}</ul>`
            : ''
        }</section>`
          : ''
      }
      <section><h2>${['RECIBIDO', 'EN_DIAGNOSTICO', 'COTIZADO'].includes(s.estatus) ? 'Cotización' : 'Trabajos autorizados'}</h2>
        ${
          s.trabajos.length
            ? `<table class="imp-tabla"><thead><tr><th>Trabajo</th>${importes ? '<th>Precio</th>' : ''}</tr></thead>
          <tbody>${s.trabajos.map(([d, v]) => `<tr><td>${esc(d)}</td>${importes ? `<td>${money(v)}</td>` : ''}</tr>`).join('')}</tbody>
          ${importes ? `<tfoot><tr><td>Total</td><td>${money(k.total)}</td></tr><tr><td>Pagado</td><td>${money(k.pagado)}</td></tr><tr><td>Saldo</td><td>${money(k.saldo)}</td></tr></tfoot>` : ''}</table>`
            : '<p>Pendiente de diagnóstico.</p>'
        }</section>
      ${s.estatus === 'CANCELADO' ? `<section><h2>Cancelación</h2><p>${fechaHora(s.cancelado.fecha)} · ${esc(s.cancelado.motivo)}</p></section>` : ''}
      <section class="imp-firma"><h2>Firma de quien recibe el vehículo</h2>
        ${
          rec
            ? `<div class="imp-trazo">${F.Firma.svg(rec.trazos, 'Firma')}</div><p>${esc(nombre(rec.tecnico))} · técnico · ${fechaHora(rec.hora)}</p>${rec.hash ? `<p class="imp-sello">Sello de integridad: ${rec.hash}</p>` : ''}`
            : '<div class="imp-trazo imp-vacia"></div><p>Nombre y firma del técnico que recibe</p>'
        }</section>
      <footer class="imp-pie"><p>Las cláusulas del contrato de adhesión registrado ante PROFECO se anexan a este formato.</p><p>Impreso el ${fechaHora(new Date().toISOString())}</p></footer>`;
  }

  function imprimirOrden(s) {
    document.getElementById('impresion')?.remove();
    const hoja = document.createElement('article');
    hoja.id = 'impresion';
    hoja.setAttribute('aria-hidden', 'true');
    hoja.innerHTML = hojaOrden(s);
    document.body.append(hoja);
    const T = F.CONFIG.tallerDatos;
    if (!T.rfc || !T.domicilio)
      toast(
        `La orden se imprime sin RFC ni domicilio del taller.${tiene('empleados') ? ' <a href="#/configuracion">Capturarlos en Configuración</a>' : ' Administración los captura en Configuración.'}`,
      );
    addEventListener('afterprint', () => hoja.remove(), { once: true });
    window.print();
  }

  A.registrarRuta('clientes', renderClientes, { titulo: 'Clientes' });
  A.registrarRuta('diagnostico', renderDiagnostico, {
    permiso: 'estatus',
    titulo: 'Diagnóstico',
    menu: 'ordenes',
  });
  A.registrarRuta('configuracion', renderConfiguracion, {
    permiso: 'empleados',
    titulo: 'Configuración',
  });
  Object.assign(A, { imprimirOrden, hojaOrden, resumenDiagnostico });
})();
