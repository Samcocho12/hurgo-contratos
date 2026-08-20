import { supabaseAdmin } from '../../lib/supabaseAdmin';

// Verifica que quien llama esta ruta tenga una sesión válida de coordinador
// (revisa el token que manda el navegador, usando la clave service_role
// que solo existe en el servidor).
async function verificarSesion(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  const usuarioActual = await verificarSesion(req);
  if (!usuarioActual) {
    return res.status(401).json({ error: 'No autorizado. Vuelve a iniciar sesión.' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    const usuarios = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      creado_en: u.created_at,
      esUsuarioActual: u.id === usuarioActual.id,
    }));
    return res.status(200).json({ usuarios });
  }

  if (req.method === 'POST') {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Falta correo o contraseña.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta el id del usuario.' });
    if (id === usuarioActual.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    }
    const { data: listado } = await supabaseAdmin.auth.admin.listUsers();
    if (listado?.users?.length <= 1) {
      return res.status(400).json({ error: 'Debe quedar al menos un usuario coordinador.' });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
