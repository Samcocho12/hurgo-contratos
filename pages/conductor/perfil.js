import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { llamarApiConductor } from '../../lib/apiConductor';
import AppHeader from '../../components/AppHeader';
import BarraConductor from '../../components/BarraConductor';
import { formatearPlaca } from '../../lib/placa';

export default function PerfilConductor() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');

  const [cambiando, setCambiando] = useState(false);
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinRepetido, setPinRepetido] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (localStorage.getItem('hurgo_rol') !== 'conductor') { router.replace('/login'); return; }
    cargar();
  }, []);

  async function cargar() {
    const { ok, datos } = await llamarApiConductor('/api/conductor/perfil');
    if (!ok) { setError(datos?.error || 'No se pudo cargar tu perfil.'); return; }
    setPerfil(datos.perfil);
  }

  async function cambiarPin(e) {
    e.preventDefault();
    setError(''); setAviso('');
    if (pinNuevo !== pinRepetido) { setError('Los dos PIN nuevos no coinciden.'); return; }

    setGuardando(true);
    const { ok, datos } = await llamarApiConductor('/api/conductor/perfil', {
      method: 'PATCH',
      body: JSON.stringify({ pinActual, pinNuevo }),
    });
    setGuardando(false);

    if (!ok) { setError(datos?.error || 'No se pudo cambiar el PIN.'); return; }
    setPinActual(''); setPinNuevo(''); setPinRepetido('');
    setCambiando(false);
    setAviso('Tu PIN quedó cambiado.');
    cargar();
  }

  function salir() {
    localStorage.removeItem('hurgo_rol');
    localStorage.removeItem('hurgo_nombre');
    localStorage.removeItem('hurgo_placa');
    router.push('/login');
  }

  const campoPin = (valor, set, etiqueta) => (
    <>
      <label>{etiqueta}</label>
      <input
        type="password" inputMode="numeric" maxLength={4} placeholder="••••"
        value={valor}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: '10px', textAlign: 'center' }}
      />
    </>
  );

  return (
    <div className="dashboard-bg con-barra">
      <AppHeader />
      <main className="page">
        <h1 className="page-title">Mi perfil</h1>
        <p className="page-sub">Tus datos y cómo entras a la app.</p>

        {error && <div className="error">{error}</div>}
        {aviso && <div className="card" style={{ background: '#E4F5EC', color: '#14633F' }}>{aviso}</div>}

        {perfil && (
          <>
            <div className="card">
              <span className="plate-badge">{formatearPlaca(perfil.placa)}</span>
              <div className="card-title" style={{ marginTop: 10 }}>{perfil.nombre || 'Sin nombre'}</div>
              {perfil.cedula && <div className="card-meta">C.C. {perfil.cedula}</div>}
              {perfil.celular && <div className="card-meta">{perfil.celular}</div>}
              {perfil.desde && (
                <div className="card-meta" style={{ marginTop: 6 }}>
                  Con Hurgo desde {new Date(perfil.desde).toLocaleDateString('es-CO', {
                    month: 'long', year: 'numeric' })}
                </div>
              )}
              <div className="card-meta" style={{ marginTop: 10 }}>
                Si algún dato está mal, pídele a tu coordinador que lo corrija.
              </div>
            </div>

            <h2 className="seccion-titulo">Cómo entras</h2>

            <div className="card">
              <div className="card-row">
                <div>
                  <div className="card-title" style={{ fontSize: 15 }}>Huella o rostro</div>
                  <div className="card-meta">
                    {perfil.huellas > 0
                      ? 'Registrada en este celular. No sale de aquí.'
                      : 'No tienes huella registrada.'}
                  </div>
                </div>
                <span className={`status status-${perfil.huellas > 0 ? 'firmado' : 'pendiente'}`}>
                  {perfil.huellas > 0 ? 'Activa' : 'Sin registrar'}
                </span>
              </div>
            </div>

            <div className="card">
              <div className="card-row">
                <div>
                  <div className="card-title" style={{ fontSize: 15 }}>PIN de respaldo</div>
                  <div className="card-meta">
                    Cuatro dígitos para cuando la huella no funcione. Solo sirve en
                    tu celular.
                  </div>
                </div>
                <span className={`status status-${perfil.tienePin ? 'firmado' : 'pendiente'}`}>
                  {perfil.tienePin ? 'Activo' : 'Sin definir'}
                </span>
              </div>

              {!cambiando ? (
                <div className="card-foot">
                  <button className="btn btn-ghost btn-sm" onClick={() => setCambiando(true)}>
                    {perfil.tienePin ? 'Cambiar mi PIN' : 'Definir mi PIN'}
                  </button>
                </div>
              ) : (
                <form onSubmit={cambiarPin} style={{ marginTop: 12 }}>
                  {perfil.tienePin && campoPin(pinActual, setPinActual, 'PIN actual')}
                  {campoPin(pinNuevo, setPinNuevo, 'PIN nuevo')}
                  {campoPin(pinRepetido, setPinRepetido, 'Repite el PIN nuevo')}

                  <button className="btn btn-stamp" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar PIN'}
                  </button>
                  <button type="button" className="link-btn" onClick={() => {
                    setCambiando(false); setPinActual(''); setPinNuevo(''); setPinRepetido(''); setError('');
                  }}>
                    Cancelar
                  </button>
                </form>
              )}
            </div>

            {perfil.dispositivos.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ fontSize: 15 }}>Celulares vinculados</div>
                {perfil.dispositivos.map((d, i) => (
                  <div className="card-meta" key={i} style={{ marginTop: 6 }}>
                    {d.etiqueta || 'Celular'}
                    {d.ultimo_uso && ` · último uso ${new Date(d.ultimo_uso).toLocaleDateString('es-CO')}`}
                  </div>
                ))}
                <div className="card-meta" style={{ marginTop: 10 }}>
                  ¿Perdiste un celular? Pídele a tu coordinador que lo desvincule.
                </div>
              </div>
            )}

            <button className="btn btn-ghost" onClick={salir}>Cerrar sesión</button>
          </>
        )}
      </main>

      <BarraConductor activo="/conductor/perfil" />
    </div>
  );
}
