import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { llamarApiJefe } from '../../lib/apiJefe';
import PanelLayout from '../../components/PanelLayout';

// Texto legible para cada accion registrada.
const ETIQUETAS = {
  ingreso_ok: 'Ingresó',
  ingreso_fallido: 'Intento de ingreso fallido',
  registro_nuevo: 'Se registró',
  registro_duplicado: 'Intento de registro con placa existente',
  enrolamiento_ok: 'Canjeó su código',
  enrolamiento_fallido: 'Código incorrecto',
  pin_definido: 'Definió su PIN',
  login_pin: 'Ingresó con PIN',
  pin_fallido: 'PIN incorrecto',
  pin_rechazado: 'PIN desde celular no autorizado',
  firma: 'Firmó un contrato',
  firma_rechazada: 'Intentó firmar un contrato ajeno',
  acceso_denegado: 'Intentó abrir un contrato ajeno',
  codigo_generado: 'Le generaron un código',
  conductor_registrado: 'Registró un conductor',
  conductor_eliminado: 'Eliminó un conductor',
  conductor_activado: 'Reactivó un conductor',
  conductor_desactivado: 'Desactivó un conductor',
  dispositivos_revocados: 'Desvinculó celulares',
  pin_borrado: 'Borró un PIN',
};

// Las que conviene mirar de cerca.
const SOSPECHOSAS = new Set([
  'firma_rechazada', 'acceso_denegado', 'pin_rechazado',
  'enrolamiento_fallido', 'pin_fallido', 'ingreso_fallido',
  'registro_duplicado',
]);

export default function Auditoria() {
  const router = useRouter();
  const [eventos, setEventos] = useState([]);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => { verificarAcceso(); }, []);

  async function verificarAcceso() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || localStorage.getItem('hurgo_rol') !== 'jefe') {
      router.replace('/login');
      return;
    }
    cargar();
  }

  async function cargar() {
    setCargando(true);
    const { ok, datos } = await llamarApiJefe('/api/jefe/auditoria?limite=200');
    setCargando(false);
    if (!ok) { setError(datos.error || 'No se pudo cargar el registro.'); return; }
    setEventos(datos.eventos || []);
  }

  const visibles = soloAlertas ? eventos.filter((e) => SOSPECHOSAS.has(e.accion)) : eventos;
  const alertas = eventos.filter((e) => SOSPECHOSAS.has(e.accion)).length;

  return (
    <PanelLayout
      activo="/jefe/auditoria"
      titulo="Registro de actividad"
      descripcion="Quién entró, quién firmó y desde dónde. No se puede editar ni borrar."
      acciones={
        <button
          className={soloAlertas ? 'btn btn-stamp' : 'btn btn-ghost'}
          onClick={() => setSoloAlertas(!soloAlertas)}
        >
          {soloAlertas ? 'Ver todo' : `Solo alertas (${alertas})`}
        </button>
      }
    >
      <button className="back-link solo-movil" onClick={() => router.push('/jefe/contratos')}>← Volver a contratos</button>

      <button className="solo-movil"

          className={soloAlertas ? 'btn btn-stamp' : 'btn btn-ghost'}
          onClick={() => setSoloAlertas(!soloAlertas)}
        >
          {soloAlertas ? 'Ver todo' : `Ver solo alertas (${alertas})`}
        </button>

        {error && <div className="error">{error}</div>}
        {cargando && <p className="page-sub">Cargando…</p>}

        {!cargando && visibles.length === 0 && (
          <div className="empty">
            <div className="empty-title">Sin actividad registrada</div>
            <div className="empty-sub">Aquí van a aparecer los ingresos y las firmas</div>
          </div>
        )}

        {/* ---------- escritorio: tabla ---------- */}
        {visibles.length > 0 && (
          <div className="solo-escritorio">
            <div className="tabla-caja">
              <table className="tabla">
                <thead>
                  <tr><th>Cuándo</th><th>Quién</th><th>Qué hizo</th><th>Sobre</th><th className="td-fin">IP</th></tr>
                </thead>
                <tbody>
                  {visibles.map((e) => (
                    <tr key={e.id} className={SOSPECHOSAS.has(e.accion) ? 'fila-alerta' : undefined}>
                      <td className="td-suave">{new Date(e.ocurrido_en).toLocaleString('es-CO')}</td>
                      <td>{e.actor_tipo === 'coordinador' ? '👤 ' : '🚚 '}{e.actor_id || '—'}</td>
                      <td className="td-doc">
                        {SOSPECHOSAS.has(e.accion) && '⚠️ '}{ETIQUETAS[e.accion] || e.accion}
                        {e.detalle?.motivo && <div className="td-nota">{e.detalle.motivo}</div>}
                      </td>
                      <td className="td-suave">{e.objetivo || '—'}</td>
                      <td className="td-fin td-suave">{e.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="solo-movil">
        {visibles.map((e) => {
          const alerta = SOSPECHOSAS.has(e.accion);
          return (
            <div
              className="card"
              key={e.id}
              style={alerta ? { borderLeft: '3px solid #e5484d' } : undefined}
            >
              <div className="card-title" style={{ fontSize: 15 }}>
                {alerta && '⚠️ '}{ETIQUETAS[e.accion] || e.accion}
              </div>
              <div className="card-meta" style={{ marginTop: 4 }}>
                {e.actor_tipo === 'coordinador' ? '👤 ' : '🚚 '}{e.actor_id || 'desconocido'}
                {e.objetivo && ` → ${e.objetivo}`}
              </div>
              <div className="card-meta">
                {new Date(e.ocurrido_en).toLocaleString('es-CO')}
                {e.ip && ` · IP ${e.ip}`}
              </div>
              {e.detalle?.motivo && (
                <div className="card-meta">Motivo: {e.detalle.motivo}</div>
              )}
            </div>
          );
        })}
        </div>
    </PanelLayout>
  );
}
