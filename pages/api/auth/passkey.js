// ============================================================
// POST /api/auth/passkey   { accion }
//
//   registro-opciones   -> reto para registrar la huella (sesion requerida)
//   registro-verificar  -> guarda la llave publica del celular
//   login-opciones      -> reto para entrar  { placa }
//   login-verificar     -> valida la firma y abre sesion FUERTE
//
// La llave privada nunca sale del celular. Aqui solo se guarda la
// publica, que por si sola no sirve para suplantar a nadie.
// ============================================================
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  RP_ID, NOMBRE_APP, origenesPermitidos,
  guardarReto, leerReto, borrarReto,
  aBase64Url, deBase64Url, etiquetaDispositivo,
} from '../../../lib/webauthn';
import { leerSesion, crearSesionConductor, vincularDispositivo } from '../../../lib/sesion';
import { registrar, estaBloqueado, registrarFallo, limpiarFallos } from '../../../lib/auditoria';
import { normalizarPlaca } from '../../../lib/placa';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const { accion } = req.body || {};

  try {
    // ======================================================
    // REGISTRO - paso 1: pedir el reto
    // Requiere sesion (la provisional que deja /api/auth/enrolar)
    // ======================================================
    if (accion === 'registro-opciones') {
      const sesion = await leerSesion(req);
      if (!sesion || sesion.rol !== 'conductor') {
        return res.status(401).json({ error: 'Sesion no valida.' });
      }

      const { data: yaTiene } = await supabaseAdmin
        .from('passkeys')
        .select('credential_id, transports')
        .eq('conductor_placa', sesion.placa);

      const opciones = await generateRegistrationOptions({
        rpName: NOMBRE_APP,
        rpID: RP_ID,
        userName: sesion.placa,
        userID: new TextEncoder().encode(sesion.placa),
        attestationType: 'none',
        // Evita registrar dos veces la misma huella en el mismo celular.
        excludeCredentials: (yaTiene || []).map((p) => ({
          id: p.credential_id,
          transports: p.transports || undefined,
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'required', // exige huella/rostro/PIN del celular
        },
      });

      await guardarReto(res, { reto: opciones.challenge, placa: sesion.placa, tipo: 'registro' });
      return res.status(200).json({ opciones });
    }

    // ======================================================
    // REGISTRO - paso 2: verificar y guardar
    // ======================================================
    if (accion === 'registro-verificar') {
      const sesion = await leerSesion(req);
      if (!sesion || sesion.rol !== 'conductor') {
        return res.status(401).json({ error: 'Sesion no valida.' });
      }

      const guardado = await leerReto(req, 'registro');
      if (!guardado || guardado.placa !== sesion.placa) {
        return res.status(400).json({ error: 'El proceso tardo demasiado. Intenta de nuevo.' });
      }

      const verificacion = await verifyRegistrationResponse({
        response: req.body.respuesta,
        expectedChallenge: guardado.reto,
        expectedOrigin: origenesPermitidos(),
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });

      borrarReto(res);

      if (!verificacion.verified || !verificacion.registrationInfo) {
        return res.status(400).json({ error: 'No se pudo registrar la huella.' });
      }

      const { credential } = verificacion.registrationInfo;

      const { error } = await supabaseAdmin.from('passkeys').insert({
        conductor_placa: sesion.placa,
        credential_id: credential.id,
        public_key: aBase64Url(credential.publicKey),
        counter: credential.counter || 0,
        transports: credential.transports || null,
        dispositivo: etiquetaDispositivo(req.headers['user-agent']),
      });
      if (error) return res.status(500).json({ error: 'No se pudo guardar la huella.' });

      await vincularDispositivo(req, res, sesion.placa, req.headers['user-agent']);
      await registrar(req, {
        actorTipo: 'conductor', actorId: sesion.placa, accion: 'passkey_registrada',
      });

      return res.status(200).json({ ok: true });
    }

    // ======================================================
    // LOGIN - paso 1: pedir el reto
    // ======================================================
    if (accion === 'login-opciones') {
      const placa = normalizarPlaca(String(req.body?.placa || ''));
      if (placa.length < 5) return res.status(400).json({ error: 'Escribe tu placa.' });

      const minutos = await estaBloqueado(placa);
      if (minutos) {
        return res.status(429).json({ error: `Demasiados intentos. Espera ${minutos} minuto(s).` });
      }

      const { data: llaves } = await supabaseAdmin
        .from('passkeys')
        .select('credential_id, transports')
        .eq('conductor_placa', placa);

      if (!llaves || llaves.length === 0) {
        return res.status(404).json({
          error: 'Esta placa no tiene huella registrada en este sistema.',
          sinPasskey: true,
        });
      }

      const opciones = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: 'required',
        allowCredentials: llaves.map((l) => ({
          id: l.credential_id,
          transports: l.transports || undefined,
        })),
      });

      await guardarReto(res, { reto: opciones.challenge, placa, tipo: 'login' });
      return res.status(200).json({ opciones });
    }

    // ======================================================
    // LOGIN - paso 2: verificar la firma
    // ======================================================
    if (accion === 'login-verificar') {
      const guardado = await leerReto(req, 'login');
      if (!guardado) {
        return res.status(400).json({ error: 'El proceso tardo demasiado. Intenta de nuevo.' });
      }
      const placa = guardado.placa;

      const idRecibido = req.body?.respuesta?.id;
      const { data: llave } = await supabaseAdmin
        .from('passkeys')
        .select('*')
        .eq('conductor_placa', placa)
        .eq('credential_id', idRecibido)
        .maybeSingle();

      if (!llave) {
        await registrarFallo(placa);
        return res.status(401).json({ error: 'Huella no reconocida.' });
      }

      const { data: conductor } = await supabaseAdmin
        .from('conductores').select('activo, nombre').eq('placa', placa).maybeSingle();
      if (!conductor || conductor.activo === false) {
        return res.status(403).json({ error: 'Tu acceso esta desactivado. Habla con tu coordinador.' });
      }

      const verificacion = await verifyAuthenticationResponse({
        response: req.body.respuesta,
        expectedChallenge: guardado.reto,
        expectedOrigin: origenesPermitidos(),
        expectedRPID: RP_ID,
        requireUserVerification: true,
        credential: {
          id: llave.credential_id,
          publicKey: deBase64Url(llave.public_key),
          counter: Number(llave.counter) || 0,
          transports: llave.transports || undefined,
        },
      });

      borrarReto(res);

      if (!verificacion.verified) {
        await registrarFallo(placa);
        await registrar(req, {
          actorTipo: 'conductor', actorId: placa, accion: 'passkey_fallida',
        });
        return res.status(401).json({ error: 'No se pudo verificar tu huella.' });
      }

      // El contador detecta credenciales clonadas: si no avanza, algo raro pasa.
      await supabaseAdmin
        .from('passkeys')
        .update({
          counter: verificacion.authenticationInfo.newCounter,
          ultimo_uso: new Date().toISOString(),
        })
        .eq('id', llave.id);

      await limpiarFallos(placa);
      await vincularDispositivo(req, res, placa, req.headers['user-agent']);
      // Sesion FUERTE: habilita firmar contratos.
      await crearSesionConductor(res, placa, { provisional: false, debil: false });

      await registrar(req, {
        actorTipo: 'conductor', actorId: placa, accion: 'login_passkey',
      });

      return res.status(200).json({
        ok: true,
        conductor: { placa, nombre: conductor.nombre || '' },
      });
    }

    return res.status(400).json({ error: 'Accion no reconocida.' });
  } catch (err) {
    console.error('passkey:', err);
    return res.status(500).json({ error: 'No se pudo completar la operacion.' });
  }
}
