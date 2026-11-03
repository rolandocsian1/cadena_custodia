/*
 * Componentes de interfaz compartidos: menú lateral según rol, encabezado,
 * control de acceso a cada pantalla y utilidades de formato.
 */
(function (global) {
  const S = global.Store;

  const NAV = [
    { href: 'inicio.html', label: 'Inicio', perms: null },
    { href: 'incidentes.html', label: 'Incidentes', perms: ['INC_VER', 'INC_CREAR'] },
    { href: 'evidencias.html', label: 'Evidencias', perms: ['EVD_VER', 'EVD_CREAR'] },
    { href: 'custodia.html', label: 'Custodia', perms: ['CUS_VER', 'CUS_GESTIONAR', 'TRF_AUTORIZAR'], count: pendCustodia },
    { href: 'solicitudes.html', label: 'Solicitudes', perms: ['ACC_SOLICITAR', 'ACC_AUTORIZAR', 'AUD_CONSULTAR'], count: pendSolicitudes },
    { href: 'analisis.html', label: 'Análisis', perms: ['ANA_REGISTRAR', 'AUD_CONSULTAR'] },
    { href: 'alertas.html', label: 'Alertas', perms: ['ALE_VER', 'ALE_RESOLVER'], count: () => S.db.alertas.filter(a => a.estado !== 'Resuelta').length },
    { href: 'seguimiento.html', label: 'Seguimiento', perms: ['SEG_VER'] },
    { href: 'bitacora.html', label: 'Bitácora', perms: ['BIT_VER'] },
    { href: 'informe.html', label: 'Informes', perms: ['INF_GENERAR'] },
    { href: 'cierre.html', label: 'Cierre', perms: ['CAS_CERRAR'] },
    { href: 'admin.html', label: 'Administración', perms: ['ADM_GESTIONAR'] }
  ];

  function pendCustodia() {
    const u = S.me();
    return S.db.transferencias.filter(t =>
      (t.estado === 'Pendiente de recepción' && t.id_recibe === u.id) ||
      (t.estado === 'Pendiente de autorización' && S.can('TRF_AUTORIZAR'))).length;
  }
  function pendSolicitudes() {
    return S.can('ACC_AUTORIZAR') ? S.db.solicitudes.filter(s => s.decision === 'Pendiente').length : 0;
  }

  // ---------------------------------------------------------------- Formato
  const esc = (v) => String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const pad = (n) => String(n).padStart(2, '0');
  function fmt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
  function fmtTime(iso) { if (!iso) return '—'; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function toLocalInput(d) {
    d = d ? new Date(d) : new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  const shortHash = (h) => h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '—';

  const COLORS = {
    'Abierto': 'blue', 'En investigación': 'yellow', 'Cerrado': 'green', 'Archivado': 'gray',
    'Registrada': 'yellow', 'Almacenada': 'green', 'Archivada': 'gray', 'En análisis': 'yellow',
    'Pendiente de autorización': 'yellow', 'Pendiente de recepción': 'yellow', 'Completada': 'green', 'Rechazada': 'red', 'Con inconsistencia': 'red',
    'Pendiente': 'yellow', 'Aprobada': 'green', 'Vigente': 'blue', 'Programada': 'blue', 'Vencida': 'gray', 'Finalizada': 'gray',
    'En revisión': 'blue', 'Resuelta': 'green', 'Iniciado': 'blue', 'Suspendido': 'red', 'Finalizado': 'green',
    'Activo': 'green', 'Inactivo': 'gray', 'Bloqueado': 'red',
    'Baja': 'gray', 'Media': 'blue', 'Alta': 'yellow', 'Crítica': 'red'
  };
  const badge = (txt, color) => `<span class="badge ${color || COLORS[txt] || 'gray'}">${esc(txt)}</span>`;
  const sem = (ev) => { const s = S.semaforo(ev); return `<span class="badge ${s.color}"><span class="dot ${s.color}"></span>${esc(s.texto)}</span>`; };

  function param(name) { return new URLSearchParams(location.search).get(name); }
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ---------------------------------------------------------------- Mensajes
  function toast(msg, type) {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === 'error' ? 6500 : 4000);
  }
  // Muestra un mensaje en la siguiente página (después de redirigir)
  function flash(msg, type) { sessionStorage.setItem('custodia_flash', JSON.stringify({ msg, type })); }
  function go(url, msg, type) { if (msg) flash(msg, type); location.href = url; }

  function modal(html, onMount) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    $$('[data-close]', back).forEach(b => b.addEventListener('click', close));
    if (onMount) onMount(back.querySelector('.modal'), close);
    return close;
  }
  function confirmar(titulo, texto, okLabel, danger) {
    return new Promise(resolve => {
      modal(`<h2>${esc(titulo)}</h2><p class="muted">${texto}</p>
        <div class="form-actions"><button class="btn" data-close>Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" id="m-ok">${esc(okLabel || 'Confirmar')}</button></div>`,
      (m, close) => {
        $('#m-ok', m).onclick = () => { close(); resolve(true); };
        $$('[data-close]', m).forEach(b => b.addEventListener('click', () => resolve(false)));
      });
    });
  }
  function pedirTexto(titulo, texto, label, okLabel, danger) {
    return new Promise(resolve => {
      modal(`<h2>${esc(titulo)}</h2><p class="muted">${texto}</p>
        <label class="lbl">${esc(label)} <span class="req">*</span></label><textarea id="m-txt"></textarea>
        <div class="form-actions"><button class="btn" data-close>Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" id="m-ok">${esc(okLabel || 'Aceptar')}</button></div>`,
      (m, close) => {
        $('#m-txt', m).focus();
        $('#m-ok', m).onclick = () => { const v = $('#m-txt', m).value; close(); resolve(v); };
        $$('[data-close]', m).forEach(b => b.addEventListener('click', () => resolve(null)));
      });
    });
  }

  // Ejecuta una operación del Store mostrando el error si la regla lo impide
  function intentar(fn, okMsg) {
    try {
      const r = fn();
      if (okMsg) toast(okMsg, 'ok');
      return r === undefined ? true : r;
    } catch (e) {
      toast(e.message, 'error');
      if (e.campos) marcarInvalidos(e.campos);
      return false;
    }
  }
  function marcarInvalidos(campos) {
    $$('.invalid').forEach(x => x.classList.remove('invalid'));
    campos.forEach(c => { const el = document.querySelector(`[name="${c}"]`); if (el) el.classList.add('invalid'); });
    const first = document.querySelector('.invalid');
    if (first) first.focus();
  }
  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v : v; });
    return o;
  }

  const opts = (list, val, label, value, empty) =>
    (empty ? `<option value="">${esc(empty)}</option>` : '') +
    list.map(x => {
      const v = value ? value(x) : x, l = label ? label(x) : x;
      return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('');

  // Botón deshabilitado que explica la regla que lo bloquea
  const lockedBtn = (label, motivo) => `<button class="btn disabled" type="button" title="${esc(motivo)}" onclick="UI.toast(${esc(JSON.stringify(motivo))}, 'warn')">${esc(label)}</button>`;

  // ---------------------------------------------------------------- Layout
  function layout(active) {
    const u = S.me();
    const rol = S.rolDe(u);
    const items = NAV.filter(n => S.canAny(n.perms, u)).map(n => {
      const c = n.count ? n.count() : 0;
      return `<a href="${n.href}" class="${n.href === active ? 'active' : ''}"><span>${n.label}</span>${c ? `<span class="count">${c}</span>` : ''}</a>`;
    }).join('');
    const ini = (u.nombres[0] + u.apellidos[0]).toUpperCase();
    document.body.innerHTML = `
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="inicio.html"><div class="brand-logo">C</div><div><div class="brand-name">CUSTODIA</div><div class="brand-sub">Evidencia digital</div></div></a>
          <div class="nav-title">Espacio de trabajo</div>
          <nav class="nav">${items}</nav>
          <div class="sidebar-foot">
            <button type="button" id="btn-reset">Restablecer datos</button></div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="menu-toggle" id="menu-toggle" aria-label="Menú">☰</button>
            <div class="sys"><b>Sistema de Cadena de Custodia</b></div>
            <div class="userbox">
              <div class="who" style="text-align:right"><b>${esc(S.nombre(u))}</b><span>${esc(rol.nombre)}</span></div>
              <div class="avatar">${esc(ini)}</div>
              <button class="btn sm" id="btn-logout">Salir</button>
            </div>
          </header>
          <main class="content" id="app"></main>
        </div>
      </div>`;
    $('#btn-logout').onclick = () => { S.logout(); location.href = 'index.html'; };
    $('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');
    $('#btn-reset').onclick = async () => {
      if (await confirmar('Restablecer datos', 'Se borrarán los registros creados y se restaurarán los datos iniciales. Se cerrará la sesión.', 'Restablecer', true)) {
        S.reset(); location.href = 'index.html';
      }
    };
    return $('#app');
  }

  function header(eyebrow, title, sub, actions) {
    return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1 class="page-title">${esc(title)}</h1></div>
      ${actions ? `<div class="btn-row no-print">${actions}</div>` : ''}</div>
      <p class="page-sub">${sub || ''}</p>`;
  }
  const footer = () => '';

  /**
   * Inicializa una pantalla protegida.
   * opciones: { active: 'archivo.html', perms: [...], modulo: 'Nombre', render(app) }
   */
  function page(o) {
    document.addEventListener('DOMContentLoaded', () => {
      const u = S.me();
      if (!u) {
        location.href = 'index.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
        return;
      }
      const app = layout(o.active);
      if (o.perms && !S.canAny(o.perms, u)) {
        S.denegarModulo(o.modulo || o.active);
        app.innerHTML = header('Acceso restringido', 'Acceso denegado', '') +
          `<div class="alert error"><b>Su rol (${esc(S.rolDe(u).nombre)}) no tiene permiso para abrir el módulo “${esc(o.modulo || o.active)}”.</b>
          El intento quedó registrado en la bitácora.</div>
          <a class="btn" href="inicio.html">Volver al inicio</a>`;
        return;
      }
      try {
        o.render(app, u);
      } catch (e) {
        console.error(e);
        app.innerHTML = `<div class="alert error"><b>No fue posible mostrar la pantalla.</b>${esc(e.message)}</div><a class="btn" href="inicio.html">Volver al inicio</a>`;
      }
      const f = sessionStorage.getItem('custodia_flash');
      if (f) { sessionStorage.removeItem('custodia_flash'); const { msg, type } = JSON.parse(f); toast(msg, type); }
    });
  }

  function notFound(app, what) {
    app.innerHTML = `<div class="alert warn"><b>${esc(what)} no encontrado.</b>Verifique el enlace o vuelva a la lista.</div><a class="btn" href="inicio.html">Volver al inicio</a>`;
  }

  // Selector de archivo que calcula el SHA-256 en el navegador
  async function hashFiles(fileList) {
    const out = [];
    for (const f of Array.from(fileList)) {
      const hash = await sha256File(f);
      out.push({ nombre: f.name, tamano: f.size, hash, tipo_archivo: f.type || 'Archivo digital' });
    }
    return out;
  }
  // Archivo de prueba (idéntico o modificado) a partir del contenido registrado
  function demoContenido(contenido, modificado) {
    return modificado ? contenido.replace(/\n$/, '') + ' [modificado]\n' : contenido;
  }
  function demoHash(contenido, modificado) { return sha256(demoContenido(contenido, modificado)); }

  /**
   * Diálogo para verificar la integridad de un archivo: el usuario selecciona
   * el archivo (o una copia de prueba) y se compara su SHA-256 con el registrado.
   */
  function dialogoVerificacion(archivo, onDone) {
    const S = global.Store;
    const demo = archivo.contenido_demo;
    modal(`<h2>Verificar integridad</h2>
      <p class="muted small">Archivo de referencia: <b>${esc(archivo.nombre)}</b><br>Hash registrado: <code>${esc(archivo.hash_original)}</code></p>
      <label class="lbl">Seleccione el archivo que desea comprobar</label>
      <input type="file" id="v-file">
      ${demo ? `<p class="note">O utilice un archivo de prueba:</p>
        <div class="btn-row"><button class="btn sm" id="v-ok">Copia idéntica (prueba)</button><button class="btn sm danger" id="v-bad">Copia modificada (prueba)</button></div>` : ''}
      <div id="v-res" style="margin-top:16px"></div>
      <div class="form-actions"><button class="btn" data-close>Cerrar</button></div>`,
    (m) => {
      const run = (hash, nombre) => {
        const r = intentar(() => S.verificarIntegridad(archivo.id, hash, nombre));
        if (!r) return;
        $('#v-res', m).innerHTML = r.verificacion.coincide
          ? `<div class="alert ok"><b>✓ Coincidente</b>Hash calculado: <code>${esc(hash)}</code><br>Verificación ${esc(r.verificacion.codigo)} registrada con usuario, fecha y hora.</div>`
          : `<div class="alert error"><b>✕ No coincidente · posible alteración</b>Hash calculado: <code>${esc(hash)}</code><br>Se generó la alerta ${esc(r.alerta.codigo)}. El hash original no se reemplaza.</div>`;
        $$('button:not([data-close])', m).forEach(b => { b.disabled = true; });
        $('#v-file', m).disabled = true;
        if (onDone) onDone(r);
      };
      $('#v-file', m).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        $('#v-res', m).innerHTML = '<p class="muted small">Calculando SHA-256…</p>';
        run(await sha256File(file), file.name);
      });
      if (demo) {
        $('#v-ok', m).onclick = () => run(demoHash(demo, false), archivo.nombre + ' (copia de prueba)');
        $('#v-bad', m).onclick = () => run(demoHash(demo, true), archivo.nombre + ' (copia modificada de prueba)');
      }
    });
  }
  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // Redimensiona una fotografía para guardarla como miniatura
  function thumb(file, max) {
    max = max || 360;
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = reject;
        img.src = r.result;
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // Panel de firma electrónica simulada
  function signaturePad(canvas) {
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * ratio; canvas.height = h * ratio;
      ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#142f49';
    };
    resize();
    let drawing = false, dirty = false;
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => { drawing = true; dirty = true; ctx.beginPath(); ctx.moveTo(...pos(e)); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); });
    canvas.addEventListener('pointerup', () => { drawing = false; });
    return {
      clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
      value() { return dirty ? canvas.toDataURL('image/png') : null; }
    };
  }

  global.UI = {
    esc, fmt, fmtDate, fmtTime, fmtBytes, toLocalInput, shortHash, badge, sem, param, $, $$,
    toast, flash, go, modal, confirmar, pedirTexto, intentar, marcarInvalidos, formData, opts, lockedBtn,
    page, header, footer, notFound, hashFiles, demoContenido, demoHash, dialogoVerificacion, descargar, thumb, signaturePad, COLORS
  };
})(window);
