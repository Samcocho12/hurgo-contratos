// ============================================================
// /api/jefe/conductores   (solo coordinadores autenticados)
//
// GET                                  -> lista de conductores + su estado
// POST   { nombre, placa, cedula, celular } -> registra y devuelve el CODIGO
// PATCH  { placa, accion }             -> codigo | activar | desactivar |
//                                         revocar_dispositivos | borrar_pin
// DELETE { placa }                     -> elimina del registro
//
// El codigo de enrolamiento se muestra UNA SOLA VEZ: en la base solo
// queda su hash. Ni el coordinador ni el servidor pueden leerlo despues.
// ============================================================
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { exigirCoordinador } from '../../../lib/sesion';
import { registrar } from '../../../lib/auditoria';
import { normalizarPlaca } from '../../../lib/placa';

const HORAS_VIGENCIA = 72;
const soloDigitos = (v) => String(v || '').replace(/\D/g, '');

// Codigo de 6 digitos con generador criptografico (no Math.random).
function generarCodigo() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function asignarCodigo(placa) {
  const codigo = generarCodigo();
  const expira = new Date(Date.now() + HORAS_VIGENCIA * 3600_000).toISOString();

  const { error } = await supabaseAdmin
    .from('conductores')
    .update({
      enrolamiento_hash: await bcrypt.hash(codigo, 10),
      enrolamiento_expira: expira,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    })
    .eq('placa', placa);

  if (error) throw new Error(error.message);
  return { codigo, expira };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const coordinador = await exigirCoordinador(req, res);
  if (!coordinador) return;

  // ---------------------------------------------------------- GET
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('conductores')
      .select('placa, nombre, cedula, celular, creado_en, activo, enrolado_en, pin_hash, enrolamiento_hash, enrolamiento_expira, bloqueado_hasta')
      .order('creado_en', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const placas = (data || []).map((c) => c.placa);
    const { data: disp } = await supabaseAdmin
      .from('dispositivos')
      .select('conductor_placa')
      .in('conductor_placa', placas.length ? placas : ['__nada__'])
      .eq('revocado', false);

    const porPlaca = {};
    (disp || []).forEach((d) => { porPlaca[d.conductor_placa] = (porPlaca[d.conductor_placa] || 0) + 1; });

    // Nunca se devuelven hashes al navegador: solo banderas.
    const conductores = (data || []).map((c) => ({
      placa: c.placa,
      nombre: c.nombre,
      cedula: c.cedula,
      celular: c.celular,
      creado_en: c.creado_en,
      activo: c.activo !== false,
      enrolado: Boolean(c.enrolado_en),
      tienePin: Boolean(c.pin_hash),
      codigoPendiente: Boolean(c.enrolamiento_hash) &&
        new Date(c.enrolamiento_expira) > new Date(),
      codigoExpira: c.enrolamiento_expira,
      bloqueadoHasta: c.bloqueado_hasta,
      dispositivos: porPlaca[c.placa] || 0,
    }));

    return res.status(200).json({ conductores });
  }

  // ---------------------------------------------------------- POST
  if (req.method === 'POST') {
    const placa = normalizarPlaca(String(req.body?.placa || ''));
    const nombre = String(req.body?.nombre || '').trim().slice(0, 120);
    const cedula = soloDigitos(req.body?.cedula).slice(0, 15) || null;
    const celular = soloDigitos(req.body?.celular).slice(0, 15) || null;

    if (nombre.length < 3) return res.status(400).json({ error: 'Escribe el nombre del conductor.' });
    if (placa.length < 5) return res.status(400).json({ error: 'Ingresa la placa completa del vehiculo.' });

    const { data: existente } = await supabaseAdmin
      .from('conductores').select('placa').eq('placa', placa).maybeSingle();
    if (existente) {
      return res.status(409).json({ error: 'Esa placa ya esta registrada.' });
    }

    const { error } = await supabaseAdmin
      .from('conductores')
      .insert({ placa, nombre, cedula, celular, activo: true });
    if (error) return res.status(500).json({ error: error.message });

    const { codigo, expira } = await asignarCodigo(placa);

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'conductor_registrado', objetivo: placa,
    });

    return res.status(201).json({ ok: true, placa, codigo, expira });
  }

  // ---------------------------------------------------------- PATCH
  if (req.method === 'PATCH') {
    const placa = normalizarPlaca(String(req.body?.placa || ''));
    const accion = String(req.body?.accion || '');

    const { data: conductor } = await supabaseAdmin
      .from('conductores').select('placa').eq('placa', placa).maybeSingle();
    if (!conductor) return res.status(404).json({ error: 'Conductor no encontrado.' });

    if (accion === 'codigo') {
      const { codigo, expira } = await asignarCodigo(placa);
      await registrar(req, {
        actorTipo: 'coordinador', actorId: coordinador.email,
        accion: 'codigo_generado', objetivo: placa,
      });
      return res.status(200).json({ ok: true, codigo, expira });
    }

    if (accion === 'activar' || accion === 'desactivar') {
      const activo = accion === 'activar';
      await supabaseAdmin.from('conductores').update({ activo }).eq('placa', placa);
      await registrar(req, {
        actorTipo: 'coordinador', actorId: coordinador.email,
        accion: activo ? 'conductor_activado' : 'conductor_desactivado', objetivo: placa,
      });
      return res.status(200).json({ ok: true });
    }

    if (accion === 'revocar_dispositivos') {
      await supabaseAdmin.from('dispositivos').update({ revocado: true }).eq('conductor_placa', placa);
      await registrar(req, {
        actorTipo: 'coordinador', actorId: coordinador.email,
        accion: 'dispositivos_revocados', objetivo: placa,
      });
      return res.status(200).json({ ok: true });
    }

    if (accion === 'borrar_pin') {
      await supabaseAdmin.from('conductores')
        .update({ pin_hash: null, intentos_fallidos: 0, bloqueado_hasta: null })
        .eq('placa', placa);
      await registrar(req, {
        actorTipo: 'coordinador', actorId: coordinador.email,
        accion: 'pin_borrado', objetivo: placa,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Accion no reconocida.' });
  }

  // ---------------------------------------------------------- DELETE
  if (req.method === 'DELETE') {
    const placa = normalizarPlaca(String(req.body?.placa || ''));
    const { error } = await supabaseAdmin.from('conductores').delete().eq('placa', placa);
    if (error) return res.status(500).json({ error: error.message });

    await registrar(req, {
      actorTipo: 'coordinador', actorId: coordinador.email,
      accion: 'conductor_eliminado', objetivo: placa,
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
}
