import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';
import AppHeader from '../../../components/AppHeader';
import { formatearFecha, generarNumeroGuia, validarDatosGuia } from '../../../lib/guias';
import { formatearPlaca } from '../../../lib/placa';

const FORM_VACIO = {
  remitente_nombre: '', remitente_telefono: '', origen_ciudad: '', origen_direccion: '',
  destinatario_nombre: '', destinatario_telefono: '', destino_ciudad: '', destino_direccion: '',
  contenido: '', unidades: '1', peso_kg: '', valor_declarado: '', observaciones: '',
};

export default function NuevaGuia() {
  const router = useRouter();
  const [contratos, setContratos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [contratoId, setContratoId] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    verificarAcceso();
  }, [router.isReady]);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    setCorreo(data.user.email || '');

    const { data: lista, error: err } = await supabase
      .from('contratos')
      .select('id, titulo, conductor_placa, conductor_nombre, firmado_en')
      .eq('estado', 'firmado')
      .not('conductor_placa', 'is', null)
      .order('firmado_en', { ascending: false });
    if (err) setError('No se pudieron cargar los contratos: ' + err.message);
    setContratos(lista || []);
    setCargado(true);

    const pedido = typeof router.query.contrato === 'string' ? router.query.contrato : '';
    if (pedido && (lista || []).some((c) => c.id === pedido)) elegirContrato(pedido);
    else if ((lista || []).length === 1) elegirContrato(lista[0].id);
  }

  // Al elegir la ruta, se prellenan las ciudades de la última guía de ese contrato.
  async function elegirContrato(id) {
    setContratoId(id);
    if (!id) return;
    const { data } = await supabase
      .from('guias')
      .select('origen_ciudad, destino_ciudad')
      .eq('contrato_id', id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    setForm((f) => ({
      ...f,
      origen_ciudad: data?.origen_ciudad || '',
      destino_ciudad: data?.destino_ciudad || '',
    }));
  }

  function campo(nombre) {
    return {
      id: `f-${nombre}`,
      value: form[nombre],
      onChange: (e) => setForm((f) => ({ ...f, [nombre]: e.target.value })),
    };
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    const contrato = contratos.find((c) => c.id === contratoId);
    if (!contrato) {
      setError('Selecciona la ruta (contrato firmado) a la que va esta guía.');
      return;
    }
    const { guia, error: errValidacion } = validarDatosGuia(form);
    if (errValidacion) {
      setError(errValidacion);
      return;
    }

    setGuardando(true);
    let creada = null;
    let ultimoError = null;
    // Reintenta si por casualidad el número aleatorio ya existe.
    for (let intento = 0; intento < 5 && !creada; intento++) {
      const { data, error: err } = await supabase
        .from('guias')
        .insert({
          ...guia,
          numero: generarNumeroGuia(),
          contrato_id: contrato.id,
          ruta_nombre: contrato.titulo,
          conductor_placa: contrato.conductor_placa,
          conductor_nombre: contrato.conductor_nombre,
          estado: 'creada',
        })
        .select('id, numero')
        .single();
      if (!err) creada = data;
      else {
        ultimoError = err;
        if (err.code !== '23505') break;
      }
    }
    if (!creada) {
      setGuardando(false);
      setError('No se pudo crear la guía: ' + (ultimoError?.message || 'error desconocido'));
      return;
    }

    await supabase.from('guia_eventos').insert({
      guia_id: creada.id,
      estado: 'creada',
      ubicacion: guia.origen_ciudad,
      autor: 'coordinador',
      autor_detalle: correo,
    });
    router.push(`/jefe/guias/${creada.numero}?nueva=1`);
  }

  const contrato = contratos.find((c) => c.id === contratoId);

  return (
    <div className="dashboard-bg">
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/jefe/guias')}>← Guías</button>
        <h1 className="page-title">Nueva guía</h1>
        <p className="page-sub">La guía le aparece al conductor del contrato elegido para que vaya marcando el estado.</p>

        {cargado && contratos.length === 0 && (
          <div className="empty">
            <div className="empty-title">No hay contratos firmados</div>
            <div className="empty-sub">Cada guía va sobre el contrato firmado de un conductor, que define su ruta.</div>
          </div>
        )}

        {contratos.length > 0 && (
          <form onSubmit={crear}>
            <fieldset className="form-seccion">
              <legend>Ruta y conductor</legend>
              <label htmlFor="f-contrato">Contrato firmado</label>
              <select id="f-contrato" value={contratoId} onChange={(e) => elegirContrato(e.target.value)}>
                <option value="">Selecciona la ruta…</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo} · {formatearPlaca(c.conductor_placa)}
                  </option>
                ))}
              </select>
              {contrato && (
                <div className="ruta-elegida">
                  {contrato.titulo}
                  <div className="ruta-elegida-meta">
                    <span className="plate-badge plate-sm">{formatearPlaca(contrato.conductor_placa)}</span>{' '}
                    {contrato.conductor_nombre} · firmado el {formatearFecha(contrato.firmado_en, false)}
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="form-seccion">
              <legend>Quién envía</legend>
              <label htmlFor="f-remitente_nombre">Nombre o empresa</label>
              <input {...campo('remitente_nombre')} placeholder="Ej: Distribuidora El Rodadero" maxLength={120} />
              <label htmlFor="f-remitente_telefono">Celular (opcional)</label>
              <input {...campo('remitente_telefono')} type="tel" inputMode="tel" placeholder="Ej: 3001234567" maxLength={20} />
              <label htmlFor="f-origen_ciudad">Ciudad de origen</label>
              <input {...campo('origen_ciudad')} placeholder="Ej: Santa Marta" maxLength={80} />
              <label htmlFor="f-origen_direccion">Dirección de recogida (opcional)</label>
              <input {...campo('origen_direccion')} placeholder="Ej: Cra 5 # 20-15" maxLength={200} />
            </fieldset>

            <fieldset className="form-seccion">
              <legend>Quién recibe</legend>
              <label htmlFor="f-destinatario_nombre">Nombre</label>
              <input {...campo('destinatario_nombre')} placeholder="Ej: Laura Gómez" maxLength={120} />
              <label htmlFor="f-destinatario_telefono">Celular</label>
              <input {...campo('destinatario_telefono')} type="tel" inputMode="tel" placeholder="Ej: 3109876543" maxLength={20} />
              <label htmlFor="f-destino_ciudad">Ciudad de destino</label>
              <input {...campo('destino_ciudad')} placeholder="Ej: Barranquilla" maxLength={80} />
              <label htmlFor="f-destino_direccion">Dirección de entrega</label>
              <input {...campo('destino_direccion')} placeholder="Ej: Calle 72 # 45-10, apto 302" maxLength={200} />
            </fieldset>

            <fieldset className="form-seccion">
              <legend>Qué se envía</legend>
              <label htmlFor="f-contenido">Contenido</label>
              <input {...campo('contenido')} placeholder="Ej: 3 cajas de repuestos" maxLength={200} />
              <div className="form-fila">
                <div>
                  <label htmlFor="f-unidades">Unidades</label>
                  <input {...campo('unidades')} type="number" min="1" step="1" inputMode="numeric" />
                </div>
                <div>
                  <label htmlFor="f-peso_kg">Peso kg (opcional)</label>
                  <input {...campo('peso_kg')} type="number" min="0" step="0.1" inputMode="decimal" placeholder="Ej: 12.5" />
                </div>
              </div>
              <label htmlFor="f-valor_declarado">Valor declarado en pesos (opcional)</label>
              <input {...campo('valor_declarado')} inputMode="numeric" placeholder="Ej: 250000" maxLength={14} />
              <label htmlFor="f-observaciones">Observaciones (opcional)</label>
              <textarea {...campo('observaciones')} rows={3} style={{ minHeight: 80 }} maxLength={500}
                placeholder="Ej: Frágil, entregar en portería" />
            </fieldset>

            {error && <div className="error error-claro" role="alert">{error}</div>}
            <button className="btn btn-stamp" disabled={guardando}>
              {guardando ? 'Creando guía…' : 'Crear y asignar guía'}
            </button>
          </form>
        )}

        {cargado && contratos.length === 0 && error && <div className="error error-claro">{error}</div>}
      </main>
    </div>
  );
}
