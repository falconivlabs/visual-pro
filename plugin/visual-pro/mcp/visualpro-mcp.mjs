#!/usr/bin/env node
// Cliente MCP de Visual PRO (sin dependencias). Habla con Claude por stdio y con
// el servidor de Visual PRO por HTTPS. Aquí NO hay contenido protegido.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const HOME = process.env.VISUALPRO_HOME || path.join(os.homedir(), 'VisualPRO');
const CONFIG = path.join(HOME, 'config.json');
const MOTOR = path.join(HOME, 'motor');
const ESTILOS = path.join(HOME, 'estilos');
const SERVIDOR_POR_DEFECTO = process.env.VISUALPRO_SERVER || 'https://visual-pro.falconi-vlabs.workers.dev';

// ---------- configuración ----------
function leerConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; }
}
function guardarConfig(c) {
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2), { mode: 0o600 });
}
function equipoId(c) {
  if (c.equipo) return c.equipo;
  c.equipo = crypto.randomUUID();
  guardarConfig(c);
  return c.equipo;
}
const servidor = (c) => (c.servidor || SERVIDOR_POR_DEFECTO).replace(/\/$/, '');

async function llamar(ruta, extra = {}, { binario = false } = {}) {
  const c = leerConfig();
  if (!c.clave) throw new Error('Visual PRO todavía no tiene tu clave. Dime tu clave (empieza por VP-) y la activo con la herramienta visualpro_activar.');
  let r;
  try {
    r = await fetch(servidor(c) + ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clave: c.clave, equipo: equipoId(c), nombre_equipo: os.hostname(), ...extra }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error('No puedo conectar con el servidor de Visual PRO. Comprueba tu conexión a internet e inténtalo de nuevo.');
  }
  if (binario && r.ok) return Buffer.from(await r.arrayBuffer());
  const data = await r.json().catch(() => ({ ok: false, error: `Respuesta inesperada (${r.status}).` }));
  if (!r.ok || data.ok === false) throw new Error(data.error || `Error ${r.status}`);
  return data;
}

// ---------- motor local ----------
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function prepararMotor(skill, ficheros, prefijo = '') {
  const dir = path.join(MOTOR, skill);
  const estilos = path.join(ESTILOS, skill);
  fs.mkdirSync(estilos, { recursive: true });
  if (!ficheros.length) return { dir, estilos, nuevos: 0 }; // puerta de entrada: nada que descargar ni limpiar
  const vigentes = new Set(ficheros.map((f) => f.ruta));
  let nuevos = 0;
  for (const f of ficheros) {
    const destino = path.join(dir, f.ruta);
    try { if (sha(fs.readFileSync(destino)) === f.sha256) continue; } catch { /* hay que bajarlo */ }
    const buf = await llamar('/v1/archivo', { skill, ruta: f.ruta }, { binario: true });
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, buf);
    if (/\.(py|sh|command)$/.test(f.ruta)) fs.chmodSync(destino, 0o755);
    nuevos++;
  }
  // limpia lo que ya no existe en la versión nueva
  const sobrantes = [];
  (function barrer(d, base = '') {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) barrer(path.join(d, e.name), rel);
      else if (!vigentes.has(rel) && (!prefijo || rel.startsWith(prefijo + '/'))) sobrantes.push(path.join(d, e.name));
    }
  })(dir);
  sobrantes.forEach((s) => fs.rmSync(s, { force: true }));
  return { dir, estilos, nuevos };
}

// ---------- herramientas ----------
const TOOLS = [
  {
    name: 'visualpro_activar',
    description: 'Activa Visual PRO con la clave de licencia del alumno (empieza por VP-). Úsala solo si el alumno te da su clave o si otra herramienta de Visual PRO dice que falta.',
    inputSchema: { type: 'object', properties: { clave: { type: 'string', description: 'Clave de licencia, p. ej. VP-XXXX-XXXX-XXXX-XXXX' } }, required: ['clave'] },
  },
  {
    name: 'visualpro_abrir',
    description: 'Abre una skill de Visual PRO: devuelve sus instrucciones (protegidas, solo con licencia) y deja listo el motor en este equipo. Llámala SIEMPRE al empezar una tarea de Visual PRO. La primera vez, sin módulo, devuelve la puerta de entrada que dice qué módulo abrir.',
    inputSchema: { type: 'object', properties: { skill: { type: 'string', description: 'visual-pro' }, modulo: { type: 'string', description: 'editor | reels (solo cuando la puerta de entrada lo indique)' } }, required: ['skill'] },
  },
  {
    name: 'visualpro_guia',
    description: 'Lee una guía de una skill de Visual PRO (p. ej. reference/carruseles.md) tal y como aparece en las instrucciones.',
    inputSchema: { type: 'object', properties: { skill: { type: 'string' }, modulo: { type: 'string', description: 'El mismo módulo con el que abriste la skill' }, ruta: { type: 'string', description: 'Ruta de la guía dentro del módulo' } }, required: ['skill', 'ruta'] },
  },
  {
    name: 'visualpro_estado',
    description: 'Muestra el estado de la licencia, la versión de Visual PRO y las carpetas del alumno (motor y biblioteca de estilos).',
    inputSchema: { type: 'object', properties: {} },
  },
];

const texto = (t) => ({ content: [{ type: 'text', text: t }] });

async function ejecutar(nombre, a = {}) {
  if (nombre === 'visualpro_activar') {
    const c = leerConfig();
    c.clave = String(a.clave || '').trim().toUpperCase();
    equipoId(c);
    guardarConfig(c);
    try {
      const r = await llamar('/v1/activar');
      fs.mkdirSync(ESTILOS, { recursive: true });
      return texto(`✅ Visual PRO activado para ${r.alumno.nombre}. Skills disponibles: ${Object.values(r.skills).join(', ')}. Tu biblioteca de estilos está en ${ESTILOS} y empieza vacía.`);
    } catch (e) {
      delete c.clave; guardarConfig(c);
      throw e;
    }
  }
  if (nombre === 'visualpro_abrir') {
    const r = await llamar('/v1/abrir', { skill: a.skill, modulo: a.modulo });
    const m = await prepararMotor(a.skill, r.motor, r.prefijo || '');
    const instr = r.instrucciones.split('{{MOTOR}}').join(m.dir).split('{{ESTILOS}}').join(m.estilos);
    return texto(instr + (m.nuevos ? `\n\n_(Motor actualizado: ${m.nuevos} archivos.)_` : ''));
  }
  if (nombre === 'visualpro_guia') {
    const r = await llamar('/v1/guia', { skill: a.skill, modulo: a.modulo, ruta: a.ruta });
    const dir = path.join(MOTOR, a.skill), est = path.join(ESTILOS, a.skill);
    return texto(r.texto.split('{{MOTOR}}').join(dir).split('{{ESTILOS}}').join(est));
  }
  if (nombre === 'visualpro_estado') {
    const c = leerConfig();
    if (!c.clave) return texto('Visual PRO no está activado todavía. Falta la clave de licencia.');
    const r = await llamar('/v1/activar');
    return texto(`Licencia activa para ${r.alumno.nombre}. Versión de contenido: ${r.version}.\nMotor: ${MOTOR}\nBiblioteca de estilos: ${ESTILOS}\nServidor: ${servidor(c)}`);
  }
  throw new Error(`Herramienta desconocida: ${nombre}`);
}

// ---------- protocolo MCP (JSON-RPC por stdio) ----------
const enviar = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (linea) => {
  let msg;
  try { msg = JSON.parse(linea); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return; // notificaciones
  try {
    if (method === 'initialize')
      return enviar({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'visual-pro', version: '1.0.0' } } });
    if (method === 'tools/list') return enviar({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      try {
        return enviar({ jsonrpc: '2.0', id, result: await ejecutar(params.name, params.arguments) });
      } catch (e) {
        return enviar({ jsonrpc: '2.0', id, result: { isError: true, ...texto(`❌ ${e.message}`) } });
      }
    }
    if (method === 'ping') return enviar({ jsonrpc: '2.0', id, result: {} });
    enviar({ jsonrpc: '2.0', id, error: { code: -32601, message: `Método no soportado: ${method}` } });
  } catch (e) {
    enviar({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
  }
});
