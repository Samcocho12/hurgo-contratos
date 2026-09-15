import { useState } from 'react';
import { ESTADOS_CONDUCTOR, ESTADOS_GUIA, PASOS_RUTA } from '../lib/guias';

// Tres botones grandes: Recogiendo -> En camino -> Entregado.
// Solo se puede avanzar. onGuardar devuelve un mensaje de error o null.
export default function FormEstadoGuia({ estadoActual, onGuardar, permitirCancelar = false }) {
  const [elegido, setElegido] = useState(null);
  const [recibidoPor, setRecibidoPor] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const pasoActual = PASOS_RUTA.indexOf(estadoActual);

  function elegir(estado) {
    setError('');
    setAviso('');
    setElegido(estado);
  }

  async function guardar(payload) {
    setGuardando(true);
    const err = await onGuardar(payload);
    setGuardando(false);
    if (err) {
      setError(err);
      return false;
    }
    setAviso(`Marcado: ${ESTADOS_GUIA[payload.estado].label}.`);
    setElegido(null);
    setNota('');
    setRecibidoPor('');
    return true;
  }

  async function confirmar(e) {
    e.preventDefault();
    setError('');
    if (elegido === 'entregada' && !recibidoPor.trim()) {
      setError('Escribe el nombre de quien recibió el envío.');
      return;
    }
    await guardar({ estado: elegido, nota: nota.trim(), recibido_por: recibidoPor.trim() });
  }

  async function cancelarGuia() {
    if (!window.confirm('¿Cancelar esta guía? Ya no se podrá actualizar y el cliente la verá como cancelada.')) return;
    await guardar({ estado: 'cancelada', nota: '', recibido_por: '' });
  }

  return (
    <div className="panel">
      <h2 className="panel-titulo">Marcar estado</h2>

      <div className="estado-botones">
        {ESTADOS_CONDUCTOR.map((op) => {
          const paso = PASOS_RUTA.indexOf(op);
          const hecho = paso <= pasoActual;
          const clases = ['estado-btn'];
          if (hecho) clases.push('estado-btn-hecho');
          if (elegido === op) clases.push('estado-btn-elegido');
          return (
            <button key={op} type="button" className={clases.join(' ')}
              disabled={hecho || guardando} aria-pressed={elegido === op}
              onClick={() => elegir(op)}>
              <span className="estado-btn-num" aria-hidden="true">{hecho ? '✓' : paso}</span>
              <span className="estado-btn-txt">{ESTADOS_GUIA[op].label}</span>
            </button>
          );
        })}
      </div>

      {elegido && (
        <form className="estado-confirmar" onSubmit={confirmar}>
          {elegido === 'entregada' && (
            <>
              <label htmlFor="recibido-guia">¿Quién recibió?</label>
              <input id="recibido-guia" value={recibidoPor} onChange={(e) => setRecibidoPor(e.target.value)}
                placeholder="Nombre de quien recibe" maxLength={120} autoFocus />
            </>
          )}
          <label htmlFor="nota-guia">Nota para el cliente (opcional)</label>
          <input id="nota-guia" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300}
            placeholder={elegido === 'entregada' ? 'Ej: Se dejó en portería' : 'Ej: Llegada estimada 3 p. m.'} />
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn btn-stamp" disabled={guardando}>
            {guardando ? 'Guardando…' : `Confirmar: ${ESTADOS_GUIA[elegido].label}`}
          </button>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button type="button" className="link-btn" onClick={() => setElegido(null)}>No, volver</button>
          </div>
        </form>
      )}

      {!elegido && error && <div className="error" role="alert">{error}</div>}
      {aviso && <div className="aviso-ok" role="status">{aviso}</div>}

      {permitirCancelar && (
        <button type="button" className="btn btn-danger" style={{ marginTop: 16 }}
          onClick={cancelarGuia} disabled={guardando}>
          Cancelar guía
        </button>
      )}
    </div>
  );
}
