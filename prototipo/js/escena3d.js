// =====================================================================================================================
// Emblema 3D del portal: el escudo de Fortaleza Servicar con un anillo que marca el avance del servicio
// ---------------------------------------------------------------------------------------------------------------------
// Qué dibuja (three.js r186, WebGLRenderer):
//   · Geometría  el escudo y la «F» son las mismas trayectorias del logotipo SVG, extruidas con bisel
//                (ExtrudeGeometry); el anillo es un TorusGeometry.
//   · Luces      tres puntos (principal, relleno y contraluz) más una luz de hemisferio. Sin mapas de sombra.
//   · Shaders    el anillo usa un ShaderMaterial propio: pinta el tramo recorrido y un brillo en la punta. El
//                escudo extiende MeshStandardMaterial (onBeforeCompile) con un destello que lo cruza despacio.
//   · Carga      three.js pesa ~420 kB comprimido: solo se descarga con import() cuando el equipo puede con él.
//
// Reglas que cumple:
//   · Es decoración con un dato (el avance): si no carga, el portal muestra el escudo SVG de siempre.
//   · No se monta con «reducir movimiento», ahorro de datos, poca memoria o sin WebGL.
//   · Se detiene cuando sale de la pantalla o la pestaña queda oculta, y libera la memoria de la GPU al destruirse.
//   · Los colores salen de las variables CSS del tema y se actualizan al cambiarlo.
//
// Uso:  const e = await montarEmblema(host, { avance: 0.5 });  e?.actualizar({ avance: 0.75, festejo: true });
// =====================================================================================================================

const RUTA_THREE = '../vendor/three/three.module.js';

// ¿Vale la pena cargar WebGL en este equipo? El Galaxy A11 de prueba (2 GB) se queda con el escudo estático.
export function puede3D() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (navigator.connection?.saveData) return false;
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const cssVar = (nombre, respaldo) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || respaldo;

// Trayectorias del logotipo (viewBox 26 × 30, eje Y hacia abajo). `y()` las pasa al eje de three.js y las centra.
const x = (v) => v - 13;
const y = (v) => 15 - v;

function formaEscudo(THREE) {
  const s = new THREE.Shape();
  s.moveTo(x(13), y(1));
  s.lineTo(x(24.5), y(5));
  s.lineTo(x(24.5), y(14.2));
  s.bezierCurveTo(x(24.5), y(21.2), x(19.6), y(26.8), x(13), y(29));
  s.bezierCurveTo(x(6.4), y(26.8), x(1.5), y(21.2), x(1.5), y(14.2));
  s.lineTo(x(1.5), y(5));
  s.closePath();
  return s;
}

function formaF(THREE) {
  const puntos = [
    [9, 8.5],
    [17.6, 8.5],
    [17.6, 11.3],
    [12, 11.3],
    [12, 13.9],
    [16.8, 13.9],
    [16.8, 16.7],
    [12, 16.7],
    [12, 22.5],
    [9, 22.5],
  ];
  const s = new THREE.Shape();
  puntos.forEach(([px, py], i) => (i ? s.lineTo(x(px), y(py)) : s.moveTo(x(px), y(py))));
  s.closePath();
  return s;
}

// Anillo de avance. uv.x recorre la circunferencia (0 → 1): lo que queda por debajo de uAvance va en el color de
// marca y el resto en el color de la pista. La punta lleva un brillo que late despacio.
const ANILLO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const ANILLO_FRAG = /* glsl */ `
  uniform float uAvance;
  uniform float uTiempo;
  uniform vec3 uColor;
  uniform vec3 uPista;
  varying vec2 vUv;
  void main() {
    float borde = 0.004;
    float hecho = 1.0 - smoothstep(uAvance - borde, uAvance + borde, vUv.x);
    float punta = smoothstep(0.07, 0.0, abs(vUv.x - uAvance)) * step(0.001, uAvance) * step(uAvance, 0.999);
    float latido = 0.5 + 0.5 * sin(uTiempo * 2.2);
    vec3 color = mix(uPista, uColor, hecho);
    color += uColor * punta * (0.35 + 0.45 * latido);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export async function montarEmblema(host, { avance = 0 } = {}) {
  if (!host || !puede3D()) return null;
  let THREE;
  try {
    THREE = await import(RUTA_THREE);
  } catch {
    return null; // sin red o bloqueado: se queda el SVG
  }
  if (!host.isConnected) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  const lado = () => Math.max(64, Math.round(host.clientWidth || 96));
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(lado(), lado(), false);
  renderer.setClearAlpha(0);
  const lienzo = renderer.domElement;
  lienzo.className = 'emblema-3d';
  lienzo.setAttribute('aria-hidden', 'true'); // el avance ya lo anuncia la barra de progreso
  host.append(lienzo);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1, 1, 200);
  camara.position.set(0, 0, 86);

  // ---------- luces: principal, relleno, contraluz y cielo ----------
  const cielo = new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 1.1);
  const principal = new THREE.DirectionalLight(0xffffff, 2.6);
  principal.position.set(18, 26, 40);
  const relleno = new THREE.DirectionalLight(0xfff1e6, 0.7);
  relleno.position.set(-30, 6, 28);
  const contraluz = new THREE.DirectionalLight(0xffffff, 1.6);
  contraluz.position.set(-12, 22, -36);
  escena.add(cielo, principal, relleno, contraluz);

  // ---------- geometría ----------
  const grupo = new THREE.Group();
  const geoEscudo = new THREE.ExtrudeGeometry(formaEscudo(THREE), {
    depth: 3.2,
    bevelEnabled: true,
    bevelThickness: 0.9,
    bevelSize: 0.8,
    bevelSegments: 4,
    curveSegments: 24,
  });
  geoEscudo.translate(0, 0, -1.6);
  const geoF = new THREE.ExtrudeGeometry(formaF(THREE), {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.2,
    bevelSegments: 2,
  });
  geoF.translate(0, 0, 2.5);
  const geoAnillo = new THREE.TorusGeometry(20.5, 0.85, 12, 160);

  // ---------- materiales ----------
  const matEscudo = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.15 });
  const destello = { uTiempo: { value: 0 }, uDestello: { value: new THREE.Color(0xffffff) } };
  matEscudo.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, destello);
    shader.vertexShader = `varying vec3 vObj;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vObj = position;',
    );
    shader.fragmentShader = `uniform float uTiempo;\nuniform vec3 uDestello;\nvarying vec3 vObj;\n${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      // Una franja de luz cruza el escudo en diagonal cada ~9 s; el resto del tiempo no se ve.
      float fase = fract(uTiempo / 9.0) * 5.0 - 1.0;
      float franja = smoothstep(0.16, 0.0, abs((vObj.x + vObj.y) / 30.0 + 0.5 - fase));
      totalEmissiveRadiance += uDestello * franja * 0.16;`,
    );
  };
  const matF = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 });
  const matAnillo = new THREE.ShaderMaterial({
    uniforms: {
      uAvance: { value: 0 },
      uTiempo: { value: 0 },
      uColor: { value: new THREE.Color() },
      uPista: { value: new THREE.Color() },
    },
    vertexShader: ANILLO_VERT,
    fragmentShader: ANILLO_FRAG,
  });

  const escudo = new THREE.Mesh(geoEscudo, matEscudo);
  const letra = new THREE.Mesh(geoF, matF);
  const insignia = new THREE.Group();
  insignia.add(escudo, letra);
  insignia.scale.setScalar(0.92);
  const anillo = new THREE.Mesh(geoAnillo, matAnillo);
  // El toro empieza en las 3 y avanza contra el reloj. Reflejado en X empieza en las 9 y avanza con el reloj;
  // un cuarto de vuelta después arranca arriba, como una carátula.
  anillo.scale.x = -1;
  anillo.rotation.z = -Math.PI / 2;
  grupo.add(insignia, anillo);
  escena.add(grupo);

  // ---------- colores del tema ----------
  function pintarTema() {
    matEscudo.color.set(cssVar('--accent', '#9c2327'));
    matAnillo.uniforms.uColor.value.set(cssVar('--accent', '#9c2327'));
    matAnillo.uniforms.uPista.value.set(cssVar('--rule', '#e3e1dd'));
  }
  pintarTema();
  const observaTema = new MutationObserver(pintarTema);
  observaTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- movimiento ----------
  // Todo se interpola hacia su destino con amortiguación: nada salta, y un cambio a mitad de camino se retoma
  // desde donde va (no reinicia como un keyframe).
  const reloj = new THREE.Timer();
  reloj.connect(document);
  const estado = { avance: 0, meta: Math.min(1, Math.max(0, avance)), giro: 0, giroMeta: 0, inclX: 0, inclY: 0, px: 0, py: 0 };
  const suavizar = (a, b, rapidez, dt) => a + (b - a) * (1 - Math.exp(-rapidez * dt));

  function cuadro() {
    reloj.update();
    const dt = Math.min(reloj.getDelta(), 0.05),
      t = reloj.getElapsed();
    estado.avance = suavizar(estado.avance, estado.meta, 3.2, dt);
    estado.giro = suavizar(estado.giro, estado.giroMeta, 2.4, dt);
    estado.inclX = suavizar(estado.inclX, estado.py * 0.25, 6, dt);
    estado.inclY = suavizar(estado.inclY, estado.px * 0.45, 6, dt);
    matAnillo.uniforms.uAvance.value = estado.avance;
    matAnillo.uniforms.uTiempo.value = t;
    destello.uTiempo.value = t;
    // Vaivén lento, como una insignia colgada: unos grados a cada lado, más lo que incline el puntero.
    insignia.rotation.y = Math.sin(t * 0.7) * 0.32 + estado.inclY + estado.giro;
    insignia.rotation.x = Math.sin(t * 0.5) * 0.06 - estado.inclX;
    renderer.render(escena, camara);
  }

  // Solo corre mientras se ve: fuera de la pantalla o con la pestaña oculta no gasta batería.
  let visible = true,
    corriendo = false;
  const acompasar = () => {
    const debe = visible && !document.hidden;
    if (debe === corriendo) return;
    corriendo = debe;
    renderer.setAnimationLoop(debe ? cuadro : null);
  };
  const observaVista = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    acompasar();
  });
  observaVista.observe(host);
  document.addEventListener('visibilitychange', acompasar);

  const alMover = (e) => {
    const r = host.getBoundingClientRect();
    estado.px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    estado.py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const alSalir = () => {
    estado.px = 0;
    estado.py = 0;
  };
  host.addEventListener('pointermove', alMover);
  host.addEventListener('pointerleave', alSalir);

  const observaTam = new ResizeObserver(() => renderer.setSize(lado(), lado(), false));
  observaTam.observe(host);

  // Si el navegador pierde el contexto de WebGL (memoria, pestaña en segundo plano), se vuelve al SVG.
  lienzo.addEventListener('webglcontextlost', () => api.destruir());

  acompasar();
  cuadro();
  requestAnimationFrame(() => host.classList.add('con-3d')); // funde el lienzo sobre el SVG

  const api = {
    // `festejo`: una vuelta completa al cambiar de etapa (por ejemplo, cuando el cliente autoriza).
    actualizar({ avance: nuevo, festejo = false } = {}) {
      if (Number.isFinite(nuevo)) estado.meta = Math.min(1, Math.max(0, nuevo));
      if (festejo) estado.giroMeta += Math.PI * 2;
    },
    destruir() {
      renderer.setAnimationLoop(null);
      observaVista.disconnect();
      observaTam.disconnect();
      observaTema.disconnect();
      reloj.dispose();
      document.removeEventListener('visibilitychange', acompasar);
      host.removeEventListener('pointermove', alMover);
      host.removeEventListener('pointerleave', alSalir);
      [geoEscudo, geoF, geoAnillo, matEscudo, matF, matAnillo].forEach((r) => r.dispose());
      renderer.dispose();
      host.classList.remove('con-3d');
      lienzo.remove();
    },
  };
  return api;
}
