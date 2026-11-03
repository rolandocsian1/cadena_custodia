/*
 * Capa de datos y reglas de negocio.
 * Representa las tablas del modelo entidad-relación (Fase 3) y aplica las
 * reglas RN-01 a RN-30. Los datos se guardan en el navegador (localStorage),
 * por lo que todas las pantallas comparten la misma información.
 *
 * Cada operación valida permisos y reglas: si no se cumplen lanza un Error
 * con el motivo, aunque el botón se haya ocultado en la interfaz.
 */
(function (global) {
  const DB_KEY = 'custodia_db_v1';
  const SESSION_KEY = 'custodia_sesion_v1';
  const CLAVE_DEMO = 'Custodia2026';
  const ITERACIONES = 1000;

  // ---------------------------------------------------------------- Catálogos
  const ROLES = [
    { id_rol: 1, nombre: 'Reportante', descripcion: 'Registra el incidente inicial.' },
    { id_rol: 2, nombre: 'Recolector', descripcion: 'Obtiene, identifica y registra la evidencia.' },
    { id_rol: 3, nombre: 'Custodio', descripcion: 'Controla almacenamiento, ubicación y transferencias.' },
    { id_rol: 4, nombre: 'Analista forense', descripcion: 'Examina copias autorizadas y documenta resultados.' },
    { id_rol: 5, nombre: 'Supervisor', descripcion: 'Autoriza accesos, transferencias, alertas y cierres.' },
    { id_rol: 6, nombre: 'Auditor', descripcion: 'Consulta la trazabilidad sin modificar registros.' },
    { id_rol: 7, nombre: 'Administrador', descripcion: 'Gestiona usuarios, roles, permisos y catálogos.' }
  ];

  // fijo: roles a los que la regla de negocio limita el permiso (no editable)
  const PERMISOS = [
    { codigo: 'INC_CREAR', nombre: 'Registrar incidentes', escritura: true },
    { codigo: 'INC_VER', nombre: 'Consultar incidentes' },
    { codigo: 'EVD_CREAR', nombre: 'Registrar y entregar evidencias', escritura: true },
    { codigo: 'EVD_VER', nombre: 'Consultar evidencias' },
    { codigo: 'CUS_VER', nombre: 'Consultar custodia y transferencias' },
    { codigo: 'CUS_GESTIONAR', nombre: 'Recibir, ubicar y transferir evidencias', escritura: true },
    { codigo: 'TRF_AUTORIZAR', nombre: 'Autorizar transferencias', escritura: true, fijo: [5], regla: 'RN-21' },
    { codigo: 'ACC_SOLICITAR', nombre: 'Solicitar acceso a evidencias', escritura: true },
    { codigo: 'ACC_AUTORIZAR', nombre: 'Aprobar o rechazar accesos', escritura: true, fijo: [5], regla: 'RN-19' },
    { codigo: 'ANA_REGISTRAR', nombre: 'Registrar análisis forenses', escritura: true },
    { codigo: 'INT_VERIFICAR', nombre: 'Verificar integridad (hash)', escritura: true },
    { codigo: 'ALE_VER', nombre: 'Consultar alertas' },
    { codigo: 'ALE_RESOLVER', nombre: 'Revisar y resolver alertas', escritura: true, fijo: [5], regla: 'RN-15' },
    { codigo: 'SEG_VER', nombre: 'Consultar línea de tiempo' },
    { codigo: 'BIT_VER', nombre: 'Consultar bitácora de auditoría' },
    { codigo: 'INF_GENERAR', nombre: 'Generar informes de trazabilidad' },
    { codigo: 'CAS_CERRAR', nombre: 'Autorizar cierre y archivo de casos', escritura: true, fijo: [5], regla: 'RN-28' },
    { codigo: 'AUD_CONSULTAR', nombre: 'Consulta general de solo lectura' },
    { codigo: 'ADM_GESTIONAR', nombre: 'Administrar usuarios, permisos y catálogos', escritura: true, fijo: [7], regla: 'RF-03' }
  ];

  const ROL_PERMISO_INICIAL = {
    1: ['INC_CREAR', 'INC_VER'],
    2: ['INC_VER', 'EVD_CREAR', 'EVD_VER', 'CUS_VER', 'SEG_VER'],
    3: ['INC_VER', 'EVD_VER', 'CUS_VER', 'CUS_GESTIONAR', 'INT_VERIFICAR', 'ALE_VER', 'SEG_VER'],
    4: ['INC_VER', 'EVD_VER', 'ACC_SOLICITAR', 'ANA_REGISTRAR', 'INT_VERIFICAR', 'ALE_VER', 'SEG_VER'],
    5: ['INC_VER', 'EVD_VER', 'CUS_VER', 'TRF_AUTORIZAR', 'ACC_AUTORIZAR', 'INT_VERIFICAR', 'ALE_VER', 'ALE_RESOLVER', 'SEG_VER', 'BIT_VER', 'INF_GENERAR', 'CAS_CERRAR'],
    6: ['INC_VER', 'EVD_VER', 'CUS_VER', 'ALE_VER', 'SEG_VER', 'BIT_VER', 'INF_GENERAR', 'AUD_CONSULTAR'],
    7: ['ADM_GESTIONAR']
  };

  const TIPOS_INICIALES = [
    ['Archivo digital', 'digital', 'Documentos y archivos obtenidos mediante copia controlada.'],
    ['Correo electrónico', 'digital', 'Mensajes exportados con encabezados y adjuntos.'],
    ['Fotografía / video', 'digital', 'Imágenes o grabaciones relacionadas con el caso.'],
    ['Captura de pantalla', 'digital', 'Apoyo visual; no sustituye al archivo original.'],
    ['Registro del sistema (log)', 'digital', 'Registros exportados de servidores, aplicaciones o red.'],
    ['Captura de tráfico de red', 'digital', 'Archivo de captura de comunicaciones.'],
    ['Copia de seguridad', 'digital', 'Respaldo o imagen de información.'],
    ['Dispositivo físico', 'dispositivo', 'Computadoras, teléfonos, memorias USB o discos.'],
    ['Documento físico', 'documento', 'Documentos impresos con carátula de identificación.']
  ];

  const UBICACIONES_INICIALES = [
    ['Área de recolección', 'Ubicación temporal antes de la entrega al custodio.'],
    ['Bodega · estante B-04', 'Bodega de evidencias, segundo nivel.'],
    ['Bodega segura · estante C-02', 'Bodega con acceso restringido y sello.'],
    ['Repositorio digital seguro', 'Almacenamiento protegido para archivos digitales.'],
    ['Laboratorio de análisis', 'Estación para copias de trabajo autorizadas.']
  ];

  const MEDIOS = [
    'Copia controlada de archivos', 'Imagen forense del medio', 'Exportación de correo con encabezados',
    'Exportación de registros (logs)', 'Captura de pantalla', 'Captura de tráfico de red',
    'Retiro y embalaje controlado', 'Escaneo de documento', 'Fotografía del lugar'
  ];
  const TIPOS_INCIDENTE = ['Acceso no autorizado', 'Phishing', 'Malware', 'Fuga de información', 'Fraude', 'Denegación de servicio', 'Otro'];
  const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];

  // Contenido de los archivos ficticios usados en las pruebas de integridad
  const DEMO = {
    usb: 'IMAGEN FORENSE SIMULADA\nEvidencia: EVD-2026-0001 (memoria USB Kingston 32 GB)\nHerramienta: duplicador ficticio v1.0\nSectores: 62521344\nContenido de prueba. Sin datos reales.\n',
    correo: 'From: "Soporte Banco" <soporte@banco-falso.example>\nTo: contabilidad@institucion.gt\nSubject: Actualice sus credenciales hoy\nDate: Tue, 20 Oct 2026 09:12:44 -0600\nMessage-ID: <0001@banco-falso.example>\n\nEstimado usuario, ingrese al enlace para evitar la suspensión de su cuenta.\n(Correo ficticio para pruebas)\n'
  };

  // ---------------------------------------------------------------- Utilidades
  const nowISO = () => new Date().toISOString();
  const year = () => new Date().getFullYear();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const hashClave = (sal, clave) => {
    let h = sal + ':' + clave;
    for (let i = 0; i < ITERACIONES; i++) h = sha256(sal + h);
    return h;
  };
  const randomSalt = () => {
    const a = new Uint8Array(8);
    (global.crypto || {}).getRandomValues ? global.crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  let db = null;

  function save() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function load() {
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || db.version !== 1) { db = seed(); save(); }
    return db;
  }
  function nextId(table) { return db[table].reduce((m, r) => Math.max(m, r.id), 0) + 1; }
  function nextCode(prefix) {
    const y = year();
    const key = prefix + '-' + y;
    db.seq[key] = (db.seq[key] || 0) + 1;
    return `${prefix}-${y}-${String(db.seq[key]).padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------- Sesión
  function sessionUser() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { s = null; }
    if (!s) return null;
    const u = db.usuarios.find(x => x.id === s.id);
    return u && u.estado === 'Activo' ? u : null;
  }
  function me() { return sessionUser(); }
  function rolDe(u) { return ROLES.find(r => r.id_rol === u.id_rol); }
  function nombre(u) { return u ? `${u.nombres} ${u.apellidos}` : '—'; }
  function userById(id) { return db.usuarios.find(u => u.id === id); }
  function userName(id) { return nombre(userById(id)); }
  function can(perm, u) {
    u = u || me();
    if (!u) return false;
    return db.rol_permiso.some(rp => rp.id_rol === u.id_rol && rp.codigo === perm);
  }
  function canAny(perms, u) { return !perms || perms.some(p => can(p, u)); }
  function requiere(perm, accion) {
    const u = me();
    if (!u) throw new Error('Debe iniciar sesión.');
    if (!can(perm, u)) {
      log('Operación denegada', 'PERMISO', perm, `Intento de "${accion}" sin el permiso ${perm}.`);
      save();
      throw new Error(`Su rol (${rolDe(u).nombre}) no tiene permiso para: ${accion}.`);
    }
    return u;
  }

  // ---------------------------------------------------------------- Bitácora (inalterable)
  function entryHash(prev, e) {
    return sha256([prev, e.id, e.fecha, e.id_usuario, e.accion, e.entidad, e.referencia, e.detalle].join('|'));
  }
  function log(accion, entidad, referencia, detalle, refs, actor) {
    const u = actor === undefined ? me() : actor;
    const last = db.bitacora[db.bitacora.length - 1];
    const e = {
      id: db.bitacora.length + 1,
      fecha: (refs && refs.fecha) || nowISO(),
      id_usuario: u ? u.id : null,
      usuario: u ? nombre(u) : 'Sistema',
      rol: u ? rolDe(u).nombre : '—',
      accion, entidad, referencia: referencia || '', detalle: detalle || '',
      id_incidente: refs && refs.inc || null,
      id_evidencia: refs && refs.ev || null,
      ip: u ? `10.10.1.${20 + u.id}` : '10.10.1.250',
      hash_prev: last ? last.hash : '0'.repeat(64)
    };
    e.hash = entryHash(e.hash_prev, e);
    db.bitacora.push(e);
    return e;
  }
  // Recalcula la cadena de hashes; cualquier cambio en un registro rompe la cadena
  function verificarBitacora(lista) {
    lista = lista || db.bitacora;
    let prev = '0'.repeat(64);
    for (let i = 0; i < lista.length; i++) {
      const e = lista[i];
      if (e.hash_prev !== prev || entryHash(prev, e) !== e.hash) return { ok: false, posicion: i + 1, total: lista.length };
      prev = e.hash;
    }
    return { ok: true, total: lista.length };
  }

  // ---------------------------------------------------------------- Datos de prueba (Escenario A)
  function seed() {
    db = {
      version: 1, creado: nowISO(), seq: {},
      roles: clone(ROLES),
      permisos: clone(PERMISOS),
      rol_permiso: [],
      usuarios: [], tipos: [], ubicaciones: [],
      incidentes: [], evidencias: [], archivos: [], transferencias: [], solicitudes: [],
      analisis: [], verificaciones: [], alertas: [], bitacora: [], informes: [], pruebas: {}
    };
    Object.entries(ROL_PERMISO_INICIAL).forEach(([r, ps]) => ps.forEach(codigo => db.rol_permiso.push({ id_rol: +r, codigo })));
    TIPOS_INICIALES.forEach(([n, c, d], i) => db.tipos.push({ id: i + 1, nombre: n, categoria: c, descripcion: d, estado: true }));
    UBICACIONES_INICIALES.forEach(([n, d], i) => db.ubicaciones.push({ id: i + 1, nombre: n, descripcion: d, estado: true }));

    const t = (h) => new Date(Date.now() + h * 3600000).toISOString();
    const users = [
      ['Sofía', 'Herrera', 'sherrera', 1], ['Carlos', 'Méndez', 'cmendez', 2], ['María', 'López', 'mlopez', 3],
      ['Diego', 'Ruiz', 'druiz', 3], ['Jorge', 'Salazar', 'jsalazar', 4], ['Ana', 'Ramírez', 'aramirez', 5],
      ['Elena', 'Ruiz', 'eruiz', 6], ['Luis', 'Pérez', 'lperez', 7], ['Pedro', 'Gómez', 'pgomez', 2]
    ];
    users.forEach(([n, a, c, r], i) => {
      const sal = sha256('sal-' + c).slice(0, 16);
      db.usuarios.push({
        id: i + 1, nombres: n, apellidos: a, correo: c + '@institucion.gt', id_rol: r, sal,
        clave_hash: hashClave(sal, CLAVE_DEMO), estado: c === 'pgomez' ? 'Inactivo' : 'Activo',
        intentos: 0, fecha_creacion: t(-240), ultimo_acceso: null
      });
    });
    const U = (c) => db.usuarios.find(u => u.correo.startsWith(c));
    const sofia = U('sherrera'), carlos = U('cmendez'), maria = U('mlopez'), diego = U('druiz'), jorge = U('jsalazar'), ana = U('aramirez');

    // INC-0001
    const inc1 = { id: 1, codigo: nextCode('INC'), id_reportante: sofia.id, descripcion: 'Acceso no autorizado a equipo institucional', fecha_incidente: t(-6.2), fecha_registro: t(-6), ubicacion: 'Oficina administrativa', tipo: 'Acceso no autorizado', prioridad: 'Alta', estado: 'En investigación', id_supervisor_cierre: null, fecha_cierre: null, fecha_archivo: null };
    db.incidentes.push(inc1);
    log('Registró incidente', 'INCIDENTE', inc1.codigo, inc1.descripcion, { inc: 1, fecha: t(-6) }, sofia);

    const ev1 = {
      id: 1, codigo: nextCode('EVD'), id_incidente: 1, id_tipo: 8, id_recolector: carlos.id, id_responsable: maria.id, id_ubicacion: 2,
      descripcion: 'Memoria USB Kingston 32 GB', origen: 'Equipo de la oficina administrativa', lugar: 'Oficina administrativa, escritorio 3',
      medio: 'Retiro y embalaje controlado', fecha_recoleccion: t(-5.3), fecha_registro: t(-5.2), estado: 'Almacenada',
      dispositivo: { marca: 'Kingston', modelo: 'DataTraveler', serie: 'USB-001', estado_fisico: 'Sin daños visibles', encendido: 'No aplica', accesorios: 'Ninguno', embalaje: 'Bolsa antiestática sellada' },
      documento: null, fotos: [], observaciones: ''
    };
    ev1.referencia_qr = qrRef(ev1);
    db.evidencias.push(ev1);
    db.archivos.push({ id: 1, id_evidencia: 1, nombre: 'imagen_usb_001.img', extension: 'img', tamano: new TextEncoder().encode(DEMO.usb).length, tipo_archivo: 'Imagen del dispositivo', ruta_segura: 'repositorio://evidencias/2026/EVD-2026-0001/imagen_usb_001.img', hash_original: sha256(DEMO.usb), algoritmo: 'SHA-256', es_copia: false, id_origen: null, id_solicitud: null, fecha_registro: t(-5.2), id_usuario: carlos.id, contenido_demo: DEMO.usb });
    log('Registró evidencia', 'EVIDENCIA', ev1.codigo, `${ev1.descripcion} · hash SHA-256 de imagen_usb_001.img registrado`, { inc: 1, ev: 1, fecha: t(-5.2) }, carlos);

    const tr1 = { id: 1, codigo: nextCode('TR'), tipo: 'Entrega inicial', id_evidencia: 1, id_entrega: carlos.id, id_recibe: maria.id, id_autoriza: null, id_ubicacion_origen: 1, id_ubicacion_destino: 2, motivo: 'Entrega al custodio después del registro', observacion: '', fecha_solicitud: t(-5), fecha_autorizacion: null, fecha_recepcion: t(-4.5), estado: 'Completada', firma: null, firma_nombre: 'María López' };
    db.transferencias.push(tr1);
    log('Entregó evidencia al custodio', 'TRANSFERENCIA', tr1.codigo, 'Carlos Méndez → María López', { inc: 1, ev: 1, fecha: t(-5) }, carlos);
    db.verificaciones.push({ id: 1, codigo: nextCode('VER'), id_archivo: 1, id_usuario: maria.id, hash_referencia: sha256(DEMO.usb), hash_calculado: sha256(DEMO.usb), coincide: true, fecha: t(-4.5), archivo_verificado: 'imagen_usb_001.img' });
    log('Confirmó recepción', 'TRANSFERENCIA', tr1.codigo, 'Ubicación: Bodega · estante B-04. Firma electrónica simulada.', { inc: 1, ev: 1, fecha: t(-4.5) }, maria);
    log('Verificó integridad', 'VERIFICACION', 'VER-' + year() + '-0001', 'imagen_usb_001.img · coincidente', { inc: 1, ev: 1, fecha: t(-4.5) }, maria);

    const al1 = { id: 1, codigo: nextCode('ALT'), tipo: 'Seguridad', id_verificacion: null, id_evidencia: 1, id_incidente: 1, descripcion: 'Una cuenta sin autorización intentó abrir el archivo imagen_usb_001.img. El acceso fue bloqueado y no se entregó su contenido.', estado: 'Pendiente', id_supervisor: null, resolucion: '', fecha_generacion: t(-4), fecha_revision: null, fecha_resolucion: null };
    db.alertas.push(al1);
    log('Acceso denegado', 'ARCHIVO', 'imagen_usb_001.img', 'Cuenta sin permiso (pgomez) intentó abrir el archivo original', { inc: 1, ev: 1, fecha: t(-4) }, U('pgomez'));
    log('Generó alerta', 'ALERTA', al1.codigo, 'Intento de acceso no autorizado bloqueado', { inc: 1, ev: 1, fecha: t(-4) }, null);

    const sol1 = { id: 1, codigo: nextCode('SOL'), id_evidencia: 1, id_solicitante: jorge.id, motivo: 'Examinar archivos de una copia autorizada.', fecha_solicitud: t(-3.5), inicio: t(-0.1), fin: t(4), id_supervisor: null, decision: 'Pendiente', observacion: '', fecha_decision: null, fecha_finalizacion: null, id_copia: null };
    db.solicitudes.push(sol1);
    log('Solicitó acceso', 'SOLICITUD_ACCESO', sol1.codigo, 'Copia para análisis de EVD-2026-0001', { inc: 1, ev: 1, fecha: t(-3.5) }, jorge);

    const tr2 = { id: 2, codigo: nextCode('TR'), tipo: 'Traslado', id_evidencia: 1, id_entrega: maria.id, id_recibe: diego.id, id_autoriza: null, id_ubicacion_origen: 2, id_ubicacion_destino: 3, motivo: 'Reubicación de almacenamiento', observacion: '', fecha_solicitud: t(-3), fecha_autorizacion: null, fecha_recepcion: null, estado: 'Pendiente de autorización', firma: null };
    db.transferencias.push(tr2);
    log('Solicitó transferencia', 'TRANSFERENCIA', tr2.codigo, 'María López → Diego Ruiz · Bodega segura · estante C-02', { inc: 1, ev: 1, fecha: t(-3) }, maria);

    // INC-0002
    const inc2 = { id: 2, codigo: nextCode('INC'), id_reportante: sofia.id, descripcion: 'Correo de phishing recibido por personal de contabilidad', fecha_incidente: t(-30), fecha_registro: t(-29.5), ubicacion: 'Departamento de contabilidad', tipo: 'Phishing', prioridad: 'Media', estado: 'En investigación', id_supervisor_cierre: null, fecha_cierre: null, fecha_archivo: null };
    db.incidentes.push(inc2);
    log('Registró incidente', 'INCIDENTE', inc2.codigo, inc2.descripcion, { inc: 2, fecha: t(-29.5) }, sofia);

    const ev2 = { id: 2, codigo: nextCode('EVD'), id_incidente: 2, id_tipo: 2, id_recolector: carlos.id, id_responsable: diego.id, id_ubicacion: 4, descripcion: 'Correo exportado con encabezados completos', origen: 'Buzón contabilidad@institucion.gt', lugar: 'Servidor de correo institucional', medio: 'Exportación de correo con encabezados', fecha_recoleccion: t(-28), fecha_registro: t(-27.8), estado: 'Almacenada', dispositivo: null, documento: null, fotos: [], observaciones: '' };
    ev2.referencia_qr = qrRef(ev2);
    db.evidencias.push(ev2);
    db.archivos.push({ id: 2, id_evidencia: 2, nombre: 'correo_phishing.eml', extension: 'eml', tamano: new TextEncoder().encode(DEMO.correo).length, tipo_archivo: 'Correo exportado (.eml)', ruta_segura: 'repositorio://evidencias/2026/EVD-2026-0002/correo_phishing.eml', hash_original: sha256(DEMO.correo), algoritmo: 'SHA-256', es_copia: false, id_origen: null, id_solicitud: null, fecha_registro: t(-27.8), id_usuario: carlos.id, contenido_demo: DEMO.correo });
    log('Registró evidencia', 'EVIDENCIA', ev2.codigo, ev2.descripcion + ' · hash SHA-256 registrado', { inc: 2, ev: 2, fecha: t(-27.8) }, carlos);
    const tr3 = { id: 3, codigo: nextCode('TR'), tipo: 'Entrega inicial', id_evidencia: 2, id_entrega: carlos.id, id_recibe: diego.id, id_autoriza: null, id_ubicacion_origen: 1, id_ubicacion_destino: 4, motivo: 'Entrega al custodio después del registro', observacion: '', fecha_solicitud: t(-27.5), fecha_autorizacion: null, fecha_recepcion: t(-27), estado: 'Completada', firma: null, firma_nombre: 'Diego Ruiz' };
    db.transferencias.push(tr3);
    log('Entregó evidencia al custodio', 'TRANSFERENCIA', tr3.codigo, 'Carlos Méndez → Diego Ruiz', { inc: 2, ev: 2, fecha: t(-27.5) }, carlos);
    log('Confirmó recepción', 'TRANSFERENCIA', tr3.codigo, 'Ubicación: Repositorio digital seguro', { inc: 2, ev: 2, fecha: t(-27) }, diego);

    const ev3 = { id: 3, codigo: nextCode('EVD'), id_incidente: 2, id_tipo: 9, id_recolector: carlos.id, id_responsable: carlos.id, id_ubicacion: 1, descripcion: 'Nota impresa con instrucciones de transferencia bancaria', origen: 'Escritorio del puesto de contabilidad 2', lugar: 'Departamento de contabilidad', medio: 'Retiro y embalaje controlado', fecha_recoleccion: t(-26), fecha_registro: t(-25.8), estado: 'Registrada', dispositivo: null, documento: { paginas: 1, digitalizado: false, motivo_pendiente: 'El escáner del área no estaba disponible al momento de la recolección.', estado_fisico: 'Hoja doblada, sin manchas' }, fotos: [], observaciones: '' };
    ev3.referencia_qr = qrRef(ev3);
    db.evidencias.push(ev3);
    log('Registró evidencia', 'EVIDENCIA', ev3.codigo, ev3.descripcion + ' · pendiente de digitalización', { inc: 2, ev: 3, fecha: t(-25.8) }, carlos);

    return db;
  }

  function qrRef(ev) {
    return `CUSTODIA|${ev.codigo}|${sha256('ref:' + ev.codigo + ':' + ev.id).slice(0, 12)}`;
  }

  // ---------------------------------------------------------------- Consultas
  const tipoDe = (ev) => db.tipos.find(t => t.id === ev.id_tipo) || { nombre: '—', categoria: 'digital' };
  const ubicName = (id) => (db.ubicaciones.find(u => u.id === id) || {}).nombre || '—';
  const incDe = (ev) => db.incidentes.find(i => i.id === ev.id_incidente);
  const archivosDe = (idEv, copias) => db.archivos.filter(a => a.id_evidencia === idEv && (copias ? a.es_copia : !a.es_copia));

  function estadoAcceso(s) {
    if (s.decision === 'Pendiente') return 'Pendiente';
    if (s.decision === 'Rechazada') return 'Rechazada';
    if (s.fecha_finalizacion) return 'Finalizada';
    const n = Date.now();
    if (n < new Date(s.inicio).getTime()) return 'Programada';
    if (n > new Date(s.fin).getTime()) return 'Vencida';
    return 'Vigente';
  }
  function transferenciaPendiente(idEv) {
    return db.transferencias.find(t => t.id_evidencia === idEv && (t.estado === 'Pendiente de autorización' || t.estado === 'Pendiente de recepción'));
  }
  function ultimaVerificacion(idArchivo) {
    const v = db.verificaciones.filter(x => x.id_archivo === idArchivo);
    return v[v.length - 1] || null;
  }
  function alertasAbiertas(idEv) {
    return db.alertas.filter(a => a.id_evidencia === idEv && a.estado !== 'Resuelta');
  }

  // Estado de custodia
  function estadoEvidencia(ev) {
    if (ev.estado === 'Archivada') return 'Archivada';
    const tp = transferenciaPendiente(ev.id);
    if (tp) return tp.tipo === 'Entrega inicial' ? 'En entrega al custodio' : tp.estado === 'Pendiente de autorización' ? 'Transferencia por autorizar' : 'Transferida (pendiente de recepción)';
    if (db.solicitudes.some(s => s.id_evidencia === ev.id && estadoAcceso(s) === 'Vigente')) return 'En análisis';
    return ev.estado;
  }

  // Integridad de los archivos: considera la última verificación de cada archivo
  function integridad(ev) {
    const files = db.archivos.filter(a => a.id_evidencia === ev.id);
    if (!files.length) return { color: 'gray', texto: 'Sin archivo digital' };
    let fallo = null, verificado = false;
    files.forEach(f => {
      const v = ultimaVerificacion(f.id);
      if (v) verificado = true;
      if (v && !v.coincide) fallo = { f, v };
    });
    if (fallo) {
      const al = db.alertas.find(a => a.id_verificacion === fallo.v.id);
      return al && al.estado === 'Resuelta'
        ? { color: 'yellow', texto: 'No coincidente · alerta resuelta' }
        : { color: 'red', texto: 'Hash no coincidente' };
    }
    return verificado ? { color: 'green', texto: 'Hash coincidente' } : { color: 'green', texto: 'Hash registrado' };
  }

  // Semáforo de integridad y custodia
  function semaforo(ev) {
    if (ev.estado === 'Archivada') return { color: 'gray', texto: 'Archivada' };
    const abiertas = alertasAbiertas(ev.id);
    if (abiertas.length) return { color: 'red', texto: abiertas.length === 1 ? 'Alerta pendiente' : `${abiertas.length} alertas pendientes` };
    if (integridad(ev).color === 'red') return { color: 'red', texto: 'Posible alteración' };
    const est = estadoEvidencia(ev);
    if (est !== 'Almacenada') return { color: 'yellow', texto: est };
    return { color: 'green', texto: 'Íntegra y bajo custodia' };
  }

  function evidenciasVisibles(u) {
    u = u || me();
    return db.evidencias.filter(ev => {
      if (can('EVD_VER', u) || can('AUD_CONSULTAR', u)) return true;
      return ev.id_recolector === u.id;
    });
  }
  function incidentesVisibles(u) {
    u = u || me();
    if (u.id_rol === 1) return db.incidentes.filter(i => i.id_reportante === u.id);
    return db.incidentes.slice();
  }

  // ---------------------------------------------------------------- Validación
  function obligatorio(obj, campos) {
    const faltan = campos.filter(([k]) => obj[k] === undefined || obj[k] === null || String(obj[k]).trim() === '');
    if (faltan.length) {
      const err = new Error('Complete los campos obligatorios: ' + faltan.map(f => f[1]).join(', ') + '.');
      err.campos = faltan.map(f => f[0]);
      throw err;
    }
  }

  // ---------------------------------------------------------------- Autenticación
  function login(correo, clave) {
    const generico = 'Correo o contraseña incorrectos.';
    const u = db.usuarios.find(x => x.correo.toLowerCase() === String(correo).trim().toLowerCase());
    if (!u) { log('Inicio de sesión fallido', 'USUARIO', String(correo).trim(), 'Cuenta inexistente', null, null); save(); throw new Error(generico); }
    if (u.estado !== 'Activo') {
      log('Inicio de sesión rechazado', 'USUARIO', u.correo, `Cuenta en estado ${u.estado}`, null, u); save();
      throw new Error(generico);
    }
    if (hashClave(u.sal, clave) !== u.clave_hash) {
      u.intentos = (u.intentos || 0) + 1;
      let det = `Contraseña incorrecta (intento ${u.intentos} de 5)`;
      if (u.intentos >= 5) { u.estado = 'Bloqueado'; det += ' · cuenta bloqueada'; }
      log('Inicio de sesión fallido', 'USUARIO', u.correo, det, null, u); save();
      throw new Error(generico);
    }
    u.intentos = 0;
    u.ultimo_acceso = nowISO();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, inicio: nowISO() }));
    log('Inició sesión', 'USUARIO', u.correo, '', null, u);
    save();
    return u;
  }
  function logout() {
    const u = me();
    if (u) { log('Cerró sesión', 'USUARIO', u.correo, ''); save(); }
    localStorage.removeItem(SESSION_KEY);
  }
  function denegarModulo(modulo) {
    log('Acceso denegado', 'MODULO', modulo, 'Intento de abrir un módulo no autorizado para el rol');
    save();
  }

  // ---------------------------------------------------------------- Incidentes
  function crearIncidente(d) {
    const u = requiere('INC_CREAR', 'registrar incidentes');
    obligatorio(d, [['descripcion', 'Descripción'], ['fecha_incidente', 'Fecha del incidente'], ['ubicacion', 'Lugar'], ['tipo', 'Tipo'], ['prioridad', 'Prioridad']]);
    if (new Date(d.fecha_incidente) > new Date()) throw new Error('La fecha del incidente no puede ser futura.');
    const inc = {
      id: nextId('incidentes'), codigo: nextCode('INC'), id_reportante: u.id,
      descripcion: d.descripcion.trim(), fecha_incidente: new Date(d.fecha_incidente).toISOString(), fecha_registro: nowISO(),
      ubicacion: d.ubicacion.trim(), tipo: d.tipo, prioridad: d.prioridad, detalle: (d.detalle || '').trim(),
      estado: 'Abierto', id_supervisor_cierre: null, fecha_cierre: null, fecha_archivo: null
    };
    db.incidentes.push(inc);
    log('Registró incidente', 'INCIDENTE', inc.codigo, inc.descripcion, { inc: inc.id });
    save();
    return inc;
  }

  // ---------------------------------------------------------------- Evidencias
  function crearEvidencia(d, archivos) {
    const u = requiere('EVD_CREAR', 'registrar evidencias');
    obligatorio(d, [['id_incidente', 'Incidente'], ['id_tipo', 'Tipo'], ['descripcion', 'Descripción'], ['origen', 'Origen'], ['lugar', 'Lugar de recolección'], ['medio', 'Medio de recolección'], ['fecha_recoleccion', 'Fecha de recolección']]);
    const inc = db.incidentes.find(i => i.id === +d.id_incidente);
    if (!inc) throw new Error('La evidencia debe asociarse con un incidente registrado.');
    if (inc.estado === 'Cerrado' || inc.estado === 'Archivado') throw new Error(`El incidente ${inc.codigo} está ${inc.estado.toLowerCase()}; no admite nuevas evidencias.`);
    const tipo = db.tipos.find(t => t.id === +d.id_tipo);
    if (new Date(d.fecha_recoleccion) > new Date()) throw new Error('La fecha de recolección no puede ser futura.');
    archivos = archivos || [];
    if (tipo.categoria === 'digital' && !archivos.length) throw new Error('Las evidencias digitales requieren al menos un archivo con su hash.');
    if (tipo.categoria === 'dispositivo') obligatorio(d.dispositivo || {}, [['marca', 'Marca'], ['modelo', 'Modelo'], ['estado_fisico', 'Estado físico'], ['embalaje', 'Embalaje']]);
    if (tipo.categoria === 'documento') {
      obligatorio(d.documento || {}, [['paginas', 'Cantidad de páginas'], ['estado_fisico', 'Estado físico del documento']]);
      if (!d.documento.digitalizado) obligatorio(d.documento, [['motivo_pendiente', 'Motivo de digitalización pendiente']]);
      if (d.documento.digitalizado && !archivos.length) throw new Error('Adjunte el archivo escaneado o marque el documento como pendiente de digitalización.');
    }
    const ev = {
      id: nextId('evidencias'), codigo: nextCode('EVD'), id_incidente: inc.id, id_tipo: tipo.id,
      id_recolector: u.id, id_responsable: u.id, id_ubicacion: 1,
      descripcion: d.descripcion.trim(), origen: d.origen.trim(), lugar: d.lugar.trim(), medio: d.medio,
      fecha_recoleccion: new Date(d.fecha_recoleccion).toISOString(), fecha_registro: nowISO(), estado: 'Registrada',
      dispositivo: tipo.categoria === 'dispositivo' ? d.dispositivo : null,
      documento: tipo.categoria === 'documento' ? d.documento : null,
      fotos: d.fotos || [], observaciones: (d.observaciones || '').trim()
    };
    ev.referencia_qr = qrRef(ev);
    db.evidencias.push(ev);
    archivos.forEach(a => agregarArchivo(ev, a, u, false));
    if (inc.estado === 'Abierto') inc.estado = 'En investigación';
    log('Registró evidencia', 'EVIDENCIA', ev.codigo, `${ev.descripcion} · ${tipo.nombre} · ${archivos.length} archivo(s) con hash`, { inc: inc.id, ev: ev.id });
    log('Generó código y QR', 'EVIDENCIA', ev.codigo, 'Referencia protegida: ' + ev.referencia_qr, { inc: inc.id, ev: ev.id });
    save();
    return ev;
  }
  function agregarArchivo(ev, a, u, escaneo) {
    const f = {
      id: nextId('archivos'), id_evidencia: ev.id, nombre: a.nombre, extension: (a.nombre.split('.').pop() || '').toLowerCase(),
      tamano: a.tamano, tipo_archivo: a.tipo_archivo || (escaneo ? 'Documento escaneado' : 'Archivo digital'),
      ruta_segura: `repositorio://evidencias/${year()}/${ev.codigo}/${a.nombre}`,
      hash_original: a.hash, algoritmo: 'SHA-256', es_copia: false, id_origen: null, id_solicitud: null,
      es_escaneo: !!escaneo, fecha_registro: nowISO(), id_usuario: u.id, contenido_demo: a.contenido_demo || null
    };
    db.archivos.push(f);
    return f;
  }
  function adjuntarEscaneo(idEv, a) {
    const u = me();
    const ev = db.evidencias.find(e => e.id === idEv);
    if (!ev || !ev.documento) throw new Error('La evidencia no es un documento físico.');
    if (!(can('EVD_CREAR', u) || can('CUS_GESTIONAR', u))) { requiere('EVD_CREAR', 'adjuntar documentos escaneados'); }
    if (ev.estado === 'Archivada') throw new Error('La evidencia está archivada.');
    const f = agregarArchivo(ev, a, u, true);
    ev.documento.digitalizado = true;
    ev.documento.fecha_digitalizacion = nowISO();
    log('Asoció documento escaneado', 'ARCHIVO', a.nombre, `Mismo registro ${ev.codigo} · hash ${a.hash.slice(0, 12)}…`, { inc: ev.id_incidente, ev: ev.id });
    save();
    return f;
  }

  // ---------------------------------------------------------------- Custodia y transferencias
  function entregarACustodio(idEv, idCustodio, motivo) {
    const u = requiere('EVD_CREAR', 'entregar evidencias al custodio');
    const ev = db.evidencias.find(e => e.id === idEv);
    if (ev.estado !== 'Registrada') throw new Error('La evidencia ya fue entregada al custodio.');
    if (ev.id_responsable !== u.id) throw new Error('Solo el responsable actual puede entregar la evidencia.');
    if (transferenciaPendiente(idEv)) throw new Error('Ya existe una entrega pendiente de recepción.');
    const rec = userById(+idCustodio);
    if (!rec || rec.estado !== 'Activo' || !can('CUS_GESTIONAR', rec)) throw new Error('Seleccione un custodio activo.');
    if (rec.id === u.id) throw new Error('Un usuario no puede transferirse una evidencia a sí mismo.');
    const tr = { id: nextId('transferencias'), codigo: nextCode('TR'), tipo: 'Entrega inicial', id_evidencia: ev.id, id_entrega: u.id, id_recibe: rec.id, id_autoriza: null, id_ubicacion_origen: ev.id_ubicacion, id_ubicacion_destino: null, motivo: motivo || 'Entrega al custodio después del registro', observacion: '', fecha_solicitud: nowISO(), fecha_autorizacion: null, fecha_recepcion: null, estado: 'Pendiente de recepción', firma: null };
    db.transferencias.push(tr);
    log('Entregó evidencia al custodio', 'TRANSFERENCIA', tr.codigo, `${nombre(u)} → ${nombre(rec)} · pendiente de confirmación`, { inc: ev.id_incidente, ev: ev.id });
    save();
    return tr;
  }

  function solicitarTraslado(idEv, idRecibe, idDestino, motivo) {
    const u = requiere('CUS_GESTIONAR', 'solicitar transferencias');
    obligatorio({ idRecibe, idDestino, motivo }, [['idRecibe', 'Recibe'], ['idDestino', 'Destino'], ['motivo', 'Motivo']]);
    const ev = db.evidencias.find(e => e.id === idEv);
    if (ev.estado === 'Archivada') throw new Error('La evidencia está archivada.');
    if (ev.estado === 'Registrada') throw new Error('La evidencia aún no ha sido recibida por un custodio.');
    if (ev.id_responsable !== u.id) throw new Error('Solo el responsable actual puede entregar la evidencia.');
    if (+idRecibe === u.id) throw new Error('Un usuario no puede transferirse una evidencia a sí mismo.');
    if (transferenciaPendiente(idEv)) throw new Error('Existe otra transferencia pendiente de recepción para esta evidencia.');
    if (+idDestino === ev.id_ubicacion && +idRecibe === ev.id_responsable) throw new Error('El destino y el receptor son iguales a los actuales.');
    const rec = userById(+idRecibe);
    if (!rec || rec.estado !== 'Activo') throw new Error('El receptor debe ser un usuario activo.');
    const tr = { id: nextId('transferencias'), codigo: nextCode('TR'), tipo: 'Traslado', id_evidencia: ev.id, id_entrega: u.id, id_recibe: rec.id, id_autoriza: null, id_ubicacion_origen: ev.id_ubicacion, id_ubicacion_destino: +idDestino, motivo: motivo.trim(), observacion: '', fecha_solicitud: nowISO(), fecha_autorizacion: null, fecha_recepcion: null, estado: 'Pendiente de autorización', firma: null };
    db.transferencias.push(tr);
    log('Solicitó transferencia', 'TRANSFERENCIA', tr.codigo, `${nombre(u)} → ${nombre(rec)} · ${ubicName(+idDestino)} · ${tr.motivo}`, { inc: ev.id_incidente, ev: ev.id });
    save();
    return tr;
  }

  function decidirTraslado(idTr, aprobar, observacion) {
    requiere('TRF_AUTORIZAR', 'autorizar transferencias');
    const tr = db.transferencias.find(t => t.id === idTr);
    if (tr.estado !== 'Pendiente de autorización') throw new Error('La transferencia no está pendiente de autorización.');
    if (!aprobar && !String(observacion || '').trim()) throw new Error('Indique el motivo del rechazo.');
    const u = me();
    const ev = db.evidencias.find(e => e.id === tr.id_evidencia);
    tr.id_autoriza = u.id; tr.fecha_autorizacion = nowISO(); tr.observacion = (observacion || '').trim();
    tr.estado = aprobar ? 'Pendiente de recepción' : 'Rechazada';
    log(aprobar ? 'Autorizó transferencia' : 'Rechazó transferencia', 'TRANSFERENCIA', tr.codigo, tr.observacion || (aprobar ? 'Habilita la recepción' : ''), { inc: ev.id_incidente, ev: ev.id });
    save();
  }

  function confirmarRecepcion(idTr, datos) {
    const u = requiere('CUS_GESTIONAR', 'confirmar recepciones');
    const tr = db.transferencias.find(t => t.id === idTr);
    const ev = db.evidencias.find(e => e.id === tr.id_evidencia);
    if (tr.id_recibe !== u.id) throw new Error('Solo el receptor designado puede confirmar la recepción.');
    if (tr.estado === 'Pendiente de autorización') throw new Error('La transferencia aún no ha sido autorizada por el supervisor; no puede confirmarse.');
    if (tr.estado !== 'Pendiente de recepción') throw new Error('La transferencia no está pendiente de recepción.');
    if (!datos.codigoOk || !datos.embalajeOk) throw new Error('Confirme la revisión del código y del embalaje, o reporte una inconsistencia.');
    if (!datos.firma) throw new Error('Registre la firma de recepción.');
    const destino = tr.id_ubicacion_destino || +datos.id_ubicacion;
    if (!destino) throw new Error('Seleccione la ubicación de almacenamiento.');
    tr.id_ubicacion_destino = destino;
    tr.fecha_recepcion = nowISO();
    tr.estado = 'Completada';
    tr.firma = datos.firma;
    tr.firma_nombre = nombre(u);
    // el responsable y la ubicación cambian solo al confirmar
    ev.id_responsable = u.id;
    ev.id_ubicacion = destino;
    if (ev.estado === 'Registrada') ev.estado = 'Almacenada';
    log('Confirmó recepción', 'TRANSFERENCIA', tr.codigo, `Responsable: ${nombre(u)} · Ubicación: ${ubicName(destino)} · firma electrónica simulada`, { inc: ev.id_incidente, ev: ev.id });
    save();
  }

  function reportarInconsistencia(idTr, detalle) {
    const u = requiere('CUS_GESTIONAR', 'reportar inconsistencias de recepción');
    const tr = db.transferencias.find(t => t.id === idTr);
    const ev = db.evidencias.find(e => e.id === tr.id_evidencia);
    if (tr.id_recibe !== u.id) throw new Error('Solo el receptor designado puede reportar la recepción.');
    if (tr.estado !== 'Pendiente de recepción') throw new Error('La transferencia no está pendiente de recepción.');
    if (!String(detalle || '').trim()) throw new Error('Describa la inconsistencia encontrada.');
    tr.estado = 'Con inconsistencia';
    tr.observacion = detalle.trim();
    tr.fecha_recepcion = nowISO();
    const al = crearAlerta('Recepción', ev, `Inconsistencia al recibir ${tr.codigo}: ${detalle.trim()}`, null);
    log('Reportó inconsistencia de recepción', 'TRANSFERENCIA', tr.codigo, detalle.trim() + ' · ' + al.codigo, { inc: ev.id_incidente, ev: ev.id });
    save();
    return al;
  }

  // ---------------------------------------------------------------- Accesos y análisis
  function solicitarAcceso(idEv, motivo, inicio, fin) {
    const u = requiere('ACC_SOLICITAR', 'solicitar acceso');
    obligatorio({ idEv, motivo, inicio, fin }, [['idEv', 'Evidencia'], ['motivo', 'Motivo'], ['inicio', 'Inicio'], ['fin', 'Fin']]);
    const ev = db.evidencias.find(e => e.id === +idEv);
    if (!archivosDe(ev.id).length) throw new Error('La evidencia no tiene archivos digitales para generar una copia.');
    if (ev.estado === 'Archivada') throw new Error('La evidencia está archivada.');
    if (new Date(fin) <= new Date(inicio)) throw new Error('La fecha de fin debe ser posterior al inicio.');
    if (db.solicitudes.some(s => s.id_evidencia === ev.id && s.id_solicitante === u.id && ['Pendiente', 'Vigente', 'Programada'].includes(estadoAcceso(s))))
      throw new Error('Ya tiene una solicitud pendiente o vigente para esta evidencia.');
    const s = { id: nextId('solicitudes'), codigo: nextCode('SOL'), id_evidencia: ev.id, id_solicitante: u.id, motivo: motivo.trim(), fecha_solicitud: nowISO(), inicio: new Date(inicio).toISOString(), fin: new Date(fin).toISOString(), id_supervisor: null, decision: 'Pendiente', observacion: '', fecha_decision: null, fecha_finalizacion: null, id_copia: null };
    db.solicitudes.push(s);
    log('Solicitó acceso', 'SOLICITUD_ACCESO', s.codigo, `Copia de ${ev.codigo} · ${s.motivo}`, { inc: ev.id_incidente, ev: ev.id });
    save();
    return s;
  }

  function decidirAcceso(idSol, aprobar, observacion, inicio, fin) {
    const u = requiere('ACC_AUTORIZAR', 'aprobar o rechazar accesos');
    const s = db.solicitudes.find(x => x.id === idSol);
    if (s.decision !== 'Pendiente') throw new Error('La solicitud ya fue resuelta.');
    if (s.id_solicitante === u.id) throw new Error('Nadie puede aprobar su propia solicitud.');
    if (!aprobar && !String(observacion || '').trim()) throw new Error('Indique el motivo del rechazo.');
    const ev = db.evidencias.find(e => e.id === s.id_evidencia);
    const ini = inicio ? new Date(inicio) : new Date(s.inicio), f = fin ? new Date(fin) : new Date(s.fin);
    if (aprobar && (isNaN(ini) || isNaN(f) || f <= ini)) throw new Error('El periodo aprobado no es válido: el fin debe ser posterior al inicio.');
    if (aprobar && f <= new Date()) throw new Error('El periodo aprobado ya venció; ajuste la fecha de fin.');
    s.id_supervisor = u.id; s.fecha_decision = nowISO(); s.observacion = (observacion || '').trim();
    s.decision = aprobar ? 'Aprobada' : 'Rechazada';
    if (aprobar) {
      s.inicio = ini.toISOString();
      s.fin = f.toISOString();
      // se prepara una copia autorizada vinculada con su archivo de origen
      const origen = archivosDe(ev.id)[0];
      const codCopia = nextCode('COP');
      const copia = { id: nextId('archivos'), codigo: codCopia, id_evidencia: ev.id, nombre: `${codCopia}_${origen.nombre}`, extension: origen.extension, tamano: origen.tamano, tipo_archivo: 'Copia de trabajo autorizada', ruta_segura: `laboratorio://copias/${codCopia}/${origen.nombre}`, hash_original: origen.hash_original, algoritmo: 'SHA-256', es_copia: true, id_origen: origen.id, id_solicitud: s.id, fecha_registro: nowISO(), id_usuario: u.id, contenido_demo: origen.contenido_demo };
      db.archivos.push(copia);
      s.id_copia = copia.id;
      log('Aprobó acceso', 'SOLICITUD_ACCESO', s.codigo, `Copia ${codCopia} de ${origen.nombre} · periodo hasta ${new Date(s.fin).toLocaleString('es-GT')}${s.observacion ? ' · ' + s.observacion : ''}`, { inc: ev.id_incidente, ev: ev.id });
    } else {
      log('Rechazó acceso', 'SOLICITUD_ACCESO', s.codigo, s.observacion, { inc: ev.id_incidente, ev: ev.id });
    }
    save();
  }

  function finalizarAcceso(idSol) {
    const u = me();
    const s = db.solicitudes.find(x => x.id === idSol);
    if (s.id_solicitante !== u.id && !can('ACC_AUTORIZAR', u)) throw new Error('Solo el solicitante o el supervisor pueden finalizar el acceso.');
    if (s.decision !== 'Aprobada' || s.fecha_finalizacion) throw new Error('El acceso no está activo.');
    const an = db.analisis.find(a => a.id_solicitud === s.id && a.estado === 'Iniciado');
    if (an) throw new Error('Finalice o guarde el análisis antes de cerrar el acceso.');
    s.fecha_finalizacion = nowISO();
    const ev = db.evidencias.find(e => e.id === s.id_evidencia);
    log('Finalizó acceso', 'SOLICITUD_ACCESO', s.codigo, 'La copia de trabajo deja de estar disponible', { inc: ev.id_incidente, ev: ev.id });
    save();
  }

  function crearAlerta(tipo, ev, descripcion, idVer) {
    const al = { id: nextId('alertas'), codigo: nextCode('ALT'), tipo, id_verificacion: idVer, id_evidencia: ev.id, id_incidente: ev.id_incidente, descripcion, estado: 'Pendiente', id_supervisor: null, resolucion: '', fecha_generacion: nowISO(), fecha_revision: null, fecha_resolucion: null };
    db.alertas.push(al);
    log('Generó alerta', 'ALERTA', al.codigo, `${tipo}: ${descripcion}`, { inc: ev.id_incidente, ev: ev.id }, null);
    return al;
  }

  // Compara el hash calculado con el registrado inicialmente
  function verificarIntegridad(idArchivo, hashCalculado, nombreVerificado) {
    const u = requiere('INT_VERIFICAR', 'verificar integridad');
    const f = db.archivos.find(a => a.id === idArchivo);
    const ev = db.evidencias.find(e => e.id === f.id_evidencia);
    if (f.es_copia) {
      const s = db.solicitudes.find(x => x.id === f.id_solicitud);
      if (s.id_solicitante !== u.id && !can('ACC_AUTORIZAR', u)) throw new Error('La copia pertenece a otra solicitud de acceso.');
      if (s.id_solicitante === u.id && estadoAcceso(s) !== 'Vigente') throw new Error(`El acceso no está vigente (estado: ${estadoAcceso(s)}).`);
    }
    const coincide = hashCalculado === f.hash_original;
    const v = { id: nextId('verificaciones'), codigo: nextCode('VER'), id_archivo: f.id, id_usuario: u.id, hash_referencia: f.hash_original, hash_calculado: hashCalculado, coincide, fecha: nowISO(), archivo_verificado: nombreVerificado || f.nombre };
    db.verificaciones.push(v);
    log('Verificó integridad', 'VERIFICACION', v.codigo, `${f.nombre} · ${coincide ? 'coincidente' : 'NO coincidente'}`, { inc: ev.id_incidente, ev: ev.id });
    let alerta = null;
    if (!coincide) {
      alerta = crearAlerta('Integridad', ev, `El hash de ${f.nombre} no coincide con el registrado. Referencia ${f.hash_original.slice(0, 8)}…${f.hash_original.slice(-4)}, calculado ${hashCalculado.slice(0, 8)}…${hashCalculado.slice(-4)}.`, v.id);
      db.analisis.filter(a => a.id_archivo === f.id && a.estado === 'Iniciado').forEach(a => {
        a.estado = 'Suspendido';
        log('Suspendió análisis', 'ANALISIS_FORENSE', a.codigo, 'Hash de la copia no coincidente · ' + alerta.codigo, { inc: ev.id_incidente, ev: ev.id });
      });
    }
    save();
    return { verificacion: v, alerta };
  }

  function puedeAnalizar(s) {
    const copia = db.archivos.find(a => a.id === s.id_copia);
    const v = copia && ultimaVerificacion(copia.id);
    return { copia, verificacion: v, ok: !!(v && v.coincide && estadoAcceso(s) === 'Vigente') };
  }

  function guardarAnalisis(idSol, d, finalizar) {
    const u = requiere('ANA_REGISTRAR', 'registrar análisis');
    const s = db.solicitudes.find(x => x.id === idSol);
    if (s.id_solicitante !== u.id) throw new Error('Solo el analista solicitante puede registrar el análisis de esta copia.');
    if (estadoAcceso(s) !== 'Vigente') throw new Error(`El acceso no está vigente (estado: ${estadoAcceso(s)}).`);
    const p = puedeAnalizar(s);
    if (!p.ok) throw new Error('Verifique primero la integridad de la copia autorizada; el hash debe coincidir.');
    obligatorio(d, [['procedimiento', 'Procedimiento']]);
    if (finalizar) obligatorio(d, [['resultado', 'Resultados'], ['conclusion', 'Conclusiones']]);
    const ev = db.evidencias.find(e => e.id === s.id_evidencia);
    let an = db.analisis.find(a => a.id_solicitud === s.id && a.estado !== 'Finalizado');
    if (!an) {
      an = { id: nextId('analisis'), codigo: nextCode('AN'), id_evidencia: ev.id, id_analista: u.id, id_solicitud: s.id, id_archivo: p.copia.id, procedimiento: '', resultado: '', conclusion: '', fecha_inicio: nowISO(), fecha_fin: null, estado: 'Iniciado' };
      db.analisis.push(an);
    }
    an.procedimiento = d.procedimiento.trim(); an.resultado = (d.resultado || '').trim(); an.conclusion = (d.conclusion || '').trim();
    an.estado = finalizar ? 'Finalizado' : 'Iniciado';
    if (finalizar) an.fecha_fin = nowISO();
    log(finalizar ? 'Finalizó análisis' : 'Guardó análisis', 'ANALISIS_FORENSE', an.codigo, `Sobre ${p.copia.nombre}`, { inc: ev.id_incidente, ev: ev.id });
    save();
    return an;
  }

  // Intento de abrir el archivo original de una evidencia
  function abrirOriginal(idArchivo) {
    const u = me();
    const f = db.archivos.find(a => a.id === idArchivo);
    const ev = db.evidencias.find(e => e.id === f.id_evidencia);
    if (ev.id_responsable === u.id && can('CUS_GESTIONAR', u)) {
      log('Consultó archivo original', 'ARCHIVO', f.nombre, 'Consulta controlada del custodio responsable', { inc: ev.id_incidente, ev: ev.id });
      save();
      return { permitido: true };
    }
    log('Acceso denegado', 'ARCHIVO', f.nombre, `${nombre(u)} (${rolDe(u).nombre}) intentó abrir el archivo original`, { inc: ev.id_incidente, ev: ev.id });
    const al = crearAlerta('Seguridad', ev, `${nombre(u)} (${rolDe(u).nombre}) intentó abrir el archivo original ${f.nombre}. El acceso fue bloqueado.`, null);
    save();
    return { permitido: false, alerta: al };
  }

  // ---------------------------------------------------------------- Alertas
  function revisarAlerta(id) {
    const u = requiere('ALE_RESOLVER', 'revisar alertas');
    const al = db.alertas.find(a => a.id === id);
    if (al.estado !== 'Pendiente') throw new Error('La alerta ya está en revisión o resuelta.');
    al.estado = 'En revisión'; al.id_supervisor = u.id; al.fecha_revision = nowISO();
    log('Marcó alerta en revisión', 'ALERTA', al.codigo, '', { inc: al.id_incidente, ev: al.id_evidencia });
    save();
  }
  function resolverAlerta(id, resolucion) {
    const u = requiere('ALE_RESOLVER', 'resolver alertas');
    const al = db.alertas.find(a => a.id === id);
    if (al.estado === 'Resuelta') throw new Error('La alerta ya fue resuelta.');
    if (!String(resolucion || '').trim() || resolucion.trim().length < 10) throw new Error('Documente la revisión y las medidas adoptadas (mínimo 10 caracteres).');
    al.estado = 'Resuelta'; al.id_supervisor = u.id; al.resolucion = resolucion.trim(); al.fecha_resolucion = nowISO();
    if (!al.fecha_revision) al.fecha_revision = al.fecha_resolucion;
    log('Resolvió alerta', 'ALERTA', al.codigo, al.resolucion, { inc: al.id_incidente, ev: al.id_evidencia });
    save();
  }

  // ---------------------------------------------------------------- Cierre
  function checksCierre(idInc) {
    const inc = db.incidentes.find(i => i.id === idInc);
    const evs = db.evidencias.filter(e => e.id_incidente === idInc);
    const ids = evs.map(e => e.id);
    const cod = (idEv) => db.evidencias.find(e => e.id === idEv).codigo;
    const trs = db.transferencias.filter(t => ids.includes(t.id_evidencia) && (t.estado === 'Pendiente de autorización' || t.estado === 'Pendiente de recepción'));
    const sols = db.solicitudes.filter(s => ids.includes(s.id_evidencia) && ['Pendiente', 'Vigente', 'Programada'].includes(estadoAcceso(s)));
    const als = db.alertas.filter(a => a.id_incidente === idInc && a.estado !== 'Resuelta');
    const sinCustodia = evs.filter(e => e.estado === 'Registrada');
    const ans = db.analisis.filter(a => ids.includes(a.id_evidencia) && a.estado !== 'Finalizado');
    const docs = evs.filter(e => e.documento && !e.documento.digitalizado);
    return [
      { nombre: 'Evidencias registradas', ok: evs.length > 0, detalle: evs.length ? [] : ['El caso no tiene evidencias registradas.'] },
      { nombre: 'Transferencias completadas', ok: !trs.length, detalle: trs.map(t => `${t.codigo} · ${cod(t.id_evidencia)} · ${t.estado}`) },
      { nombre: 'Solicitudes y accesos finalizados', ok: !sols.length, detalle: sols.map(s => `${s.codigo} · ${cod(s.id_evidencia)} · ${estadoAcceso(s)}`) },
      { nombre: 'Alertas resueltas', ok: !als.length, detalle: als.map(a => `${a.codigo} · ${a.tipo} · ${a.estado}`) },
      { nombre: 'Responsables y ubicaciones registrados', ok: !sinCustodia.length, detalle: sinCustodia.map(e => `${e.codigo} · aún no entregada al custodio`) },
      { nombre: 'Análisis requeridos finalizados', ok: !ans.length, detalle: ans.map(a => `${a.codigo} · ${cod(a.id_evidencia)} · ${a.estado}`) },
      { nombre: 'Documentos físicos digitalizados', ok: !docs.length, detalle: docs.map(e => `${e.codigo} · pendiente: ${e.documento.motivo_pendiente}`), aviso: true }
    ].map(c => Object.assign(c, { inc }));
  }
  function puedeCerrar(idInc) {
    return checksCierre(idInc).every(c => c.ok || c.aviso);
  }
  function cerrarCaso(idInc, comentario) {
    const u = requiere('CAS_CERRAR', 'autorizar el cierre de casos');
    const inc = db.incidentes.find(i => i.id === idInc);
    if (inc.estado === 'Cerrado' || inc.estado === 'Archivado') throw new Error('El caso ya fue cerrado.');
    const pend = checksCierre(idInc).filter(c => !c.ok && !c.aviso);
    if (pend.length) {
      log('Cierre bloqueado', 'INCIDENTE', inc.codigo, 'Pendientes: ' + pend.map(p => p.nombre).join(', '), { inc: inc.id });
      save();
      throw new Error('El cierre está bloqueado: ' + pend.map(p => p.nombre.toLowerCase()).join(', ') + '.');
    }
    inc.estado = 'Cerrado'; inc.id_supervisor_cierre = u.id; inc.fecha_cierre = nowISO(); inc.comentario_cierre = (comentario || '').trim();
    log('Autorizó cierre del caso', 'INCIDENTE', inc.codigo, inc.comentario_cierre || 'Sin asuntos pendientes', { inc: inc.id });
    save();
  }
  function archivarCaso(idInc) {
    requiere('CAS_CERRAR', 'archivar casos');
    const inc = db.incidentes.find(i => i.id === idInc);
    if (inc.estado !== 'Cerrado') throw new Error('Solo pueden archivarse casos cerrados.');
    inc.estado = 'Archivado'; inc.fecha_archivo = nowISO();
    db.evidencias.filter(e => e.id_incidente === idInc).forEach(e => { e.estado = 'Archivada'; });
    log('Archivó caso', 'INCIDENTE', inc.codigo, 'La información se conserva para consultas y auditorías', { inc: inc.id });
    save();
  }
  function intentarEliminarEvidencia(idEv) {
    const ev = db.evidencias.find(e => e.id === idEv);
    log('Eliminación rechazada', 'EVIDENCIA', ev.codigo, 'Las evidencias no se eliminan; solo cambian de estado', { inc: ev.id_incidente, ev: ev.id });
    save();
    throw new Error('Una evidencia registrada no puede eliminarse; únicamente puede cambiar de estado.');
  }

  function generarInforme(idInc) {
    const u = requiere('INF_GENERAR', 'generar informes');
    const inc = db.incidentes.find(i => i.id === idInc);
    const inf = { id: nextId('informes'), codigo: nextCode('INF'), id_incidente: idInc, id_usuario: u.id, tipo: inc.estado === 'Cerrado' || inc.estado === 'Archivado' ? 'Cierre' : 'Cadena de custodia', fecha: nowISO() };
    db.informes.push(inf);
    log('Generó informe', 'INFORME_TRAZABILIDAD', inf.codigo, `${inf.tipo} · ${inc.codigo}`, { inc: idInc });
    save();
    return inf;
  }

  // ---------------------------------------------------------------- Administración
  function guardarUsuario(d) {
    requiere('ADM_GESTIONAR', 'administrar usuarios');
    obligatorio(d, [['nombres', 'Nombres'], ['apellidos', 'Apellidos'], ['correo', 'Correo'], ['id_rol', 'Rol']]);
    const correo = d.correo.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error('El correo no tiene un formato válido.');
    if (db.usuarios.some(u => u.correo === correo && u.id !== d.id)) throw new Error('Ya existe un usuario con ese correo.');
    if (d.id) {
      const u = userById(d.id);
      const antes = `${nombre(u)} · ${rolDe(u).nombre}`;
      u.nombres = d.nombres.trim(); u.apellidos = d.apellidos.trim(); u.correo = correo; u.id_rol = +d.id_rol;
      if (d.clave) { if (d.clave.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.'); u.sal = randomSalt(); u.clave_hash = hashClave(u.sal, d.clave); }
      log('Modificó usuario', 'USUARIO', correo, `${antes} → ${nombre(u)} · ${rolDe(u).nombre}`);
      save();
      return u;
    }
    if (!d.clave || d.clave.length < 8) throw new Error('La contraseña temporal debe tener al menos 8 caracteres.');
    const sal = randomSalt();
    const u = { id: nextId('usuarios'), nombres: d.nombres.trim(), apellidos: d.apellidos.trim(), correo, id_rol: +d.id_rol, sal, clave_hash: hashClave(sal, d.clave), estado: 'Activo', intentos: 0, fecha_creacion: nowISO(), ultimo_acceso: null };
    db.usuarios.push(u);
    log('Creó usuario', 'USUARIO', correo, `${nombre(u)} · ${rolDe(u).nombre}`);
    save();
    return u;
  }
  function cambiarEstadoUsuario(id, estado) {
    const adm = requiere('ADM_GESTIONAR', 'activar o desactivar usuarios');
    const u = userById(id);
    if (u.id === adm.id && estado !== 'Activo') throw new Error('No puede desactivar su propia cuenta.');
    u.estado = estado;
    if (estado === 'Activo') u.intentos = 0;
    log(estado === 'Activo' ? 'Activó usuario' : 'Desactivó usuario', 'USUARIO', u.correo, 'El historial del usuario se conserva');
    save();
  }
  function permisoEditable(id_rol, codigo) {
    const p = PERMISOS.find(x => x.codigo === codigo);
    if (p.fijo) return { editable: false, motivo: `Exclusivo de ${p.fijo.map(r => ROLES.find(x => x.id_rol === r).nombre).join(', ')}` };
    if (id_rol === 6 && p.escritura) return { editable: false, motivo: 'El auditor solo consulta' };
    if (codigo === 'AUD_CONSULTAR' && id_rol !== 6) return { editable: true };
    return { editable: true };
  }
  function setPermiso(id_rol, codigo, activo) {
    requiere('ADM_GESTIONAR', 'asignar permisos');
    const e = permisoEditable(id_rol, codigo);
    if (!e.editable) throw new Error(e.motivo);
    const i = db.rol_permiso.findIndex(rp => rp.id_rol === id_rol && rp.codigo === codigo);
    if (activo && i < 0) db.rol_permiso.push({ id_rol, codigo });
    if (!activo && i >= 0) db.rol_permiso.splice(i, 1);
    log(activo ? 'Asignó permiso' : 'Retiró permiso', 'ROL_PERMISO', codigo, ROLES.find(r => r.id_rol === id_rol).nombre);
    save();
  }
  function guardarCatalogo(tabla, d) {
    requiere('ADM_GESTIONAR', 'administrar catálogos');
    obligatorio(d, [['nombre', 'Nombre']]);
    if (db[tabla].some(x => x.nombre.toLowerCase() === d.nombre.trim().toLowerCase())) throw new Error('Ya existe un registro con ese nombre.');
    const r = Object.assign({ id: nextId(tabla), estado: true }, d, { nombre: d.nombre.trim() });
    db[tabla].push(r);
    log('Agregó registro de catálogo', tabla === 'tipos' ? 'TIPO_EVIDENCIA' : 'UBICACION', r.nombre, r.descripcion || '');
    save();
  }
  function toggleCatalogo(tabla, id) {
    requiere('ADM_GESTIONAR', 'administrar catálogos');
    const r = db[tabla].find(x => x.id === id);
    r.estado = !r.estado;
    log(r.estado ? 'Activó registro de catálogo' : 'Desactivó registro de catálogo', tabla === 'tipos' ? 'TIPO_EVIDENCIA' : 'UBICACION', r.nombre, '');
    save();
  }

  function guardarPrueba(codigo, d) {
    db.pruebas[codigo] = Object.assign({}, d, { fecha: nowISO(), responsable: nombre(me()) });
    save();
  }

  function reset() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
    load();
  }

  load();

  global.Store = {
    get db() { return db; },
    CLAVE_DEMO, ROLES, PERMISOS, MEDIOS, TIPOS_INCIDENTE, PRIORIDADES, DEMO,
    load, save, reset, me, can, canAny, rolDe, nombre, userById, userName, ubicName, tipoDe, incDe, archivosDe,
    login, logout, denegarModulo, log,
    estadoAcceso, estadoEvidencia, integridad, semaforo, transferenciaPendiente, ultimaVerificacion, alertasAbiertas,
    evidenciasVisibles, incidentesVisibles,
    crearIncidente, crearEvidencia, adjuntarEscaneo, entregarACustodio, solicitarTraslado, decidirTraslado,
    confirmarRecepcion, reportarInconsistencia, solicitarAcceso, decidirAcceso, finalizarAcceso,
    verificarIntegridad, puedeAnalizar, guardarAnalisis, abrirOriginal, revisarAlerta, resolverAlerta,
    checksCierre, puedeCerrar, cerrarCaso, archivarCaso, intentarEliminarEvidencia, generarInforme,
    guardarUsuario, cambiarEstadoUsuario, permisoEditable, setPermiso, guardarCatalogo, toggleCatalogo,
    verificarBitacora, guardarPrueba
  };
})(window);
