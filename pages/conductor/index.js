import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { llamarApiConductor } from '../../lib/apiConductor';
import AppHeader from '../../components/AppHeader';
import BarraConductor from '../../components/BarraConductor';
import { formatearPlaca } from '../../lib/placa';
import { ESTADOS_GUIA } from '../../lib/guias';

const ESTADO_LABEL = { pendiente: 'Pendiente', visto: 'Visto', firmado: 'Firmado', rechazado: 'Rechazado' };

const ESTADO_ANTICIPO = {
  solicitado: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado',
  pagado: 'Pagado', legalizado: 'Cerrado',
};

const pesos = (v) => '$' + Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

const fecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '';

export default function ConductorDashboard() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [placa, setPlaca] = useState('');
  const [contratos, setContratos] = useState([]);
  const [guias, setGuias] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [pestana, setPestana] = useState('contratos');

  useEffect(() => {
    const rol = localStorage.getItem('hurgo_rol');
    const nombreGuardado = localStorage.getItem('hurgo_nombre');
    const placaGuardada = localStorage.getItem('hurgo_placa');
    if (rol !== 'conductor' || !placaGuardada) { router.replace('/login'); return; }
    setNombre(nombreGuardado || '');
    setPlaca(placaGuardada);
    cargar();
  }, []);

  async function cargar() {
    const resContratos = await llamarApiConductor('/api/conductor/contratos');
    if (!resContratos.ok) {
      setCargado(true);
      if (resContratos.datos?.pendienteAprobacion) setPendiente(true);
      return;
    }
    setContratos(resContratos.datos.contratos || []);

    // Guías y anticipos solo existen con contrato firmado; si no, devuelven
    // 403 y simplemente quedan vacíos.
    const [resGuias, resAnticipos] = await Promise.all([
      llamarApiConductor('/api/conductor/guias'),
      llamarApiConductor('/api/conductor/anticipos'),
    ]);
    if (resGuias.ok) setGuias(resGuias.datos.guias || []);
    if (resAnticipos.ok) setAnticipos(resAnticipos.datos.anticipos || []);

    setCargado(true);
  }

  const pendientes = contratos.filter((c) => c.estado === 'pendiente' || c.estado === 'visto').length;
  const firmados = contratos.filter((c) => c.estado === 'firmado').length;

  // ---------------------------------------------- Esperando aprobación
  if (pendiente) {
    return (
      <div className="dashboard-bg">
        <AppHeader />
        <main className="page">
          <div style={{ fontSize: 60, textAlign: 'center', marginTop: 30 }}>⏳</div>
          <h1 className="page-title" style={{ textAlign: 'center' }}>Casi listo</h1>
          <p className="page-sub" style={{ textAlign: 'center' }}>
            Tu registro quedó guardado. Tu coordinador debe confirmar que manejas
            este vehículo antes de que puedas ver tus contratos.
          </p>
          <button className="btn btn-ghost" onClick={() => location.reload()}>
            Ya me confirmaron, revisar
          </button>
        </main>
      </div>
    );
  }

  // ---------------------------------------------- Actividad reciente
  const actividad = {
    contratos: contratos.slice(0, 5).map((c) => ({
      id: c.id,
      href: `/conductor/contrato/${c.id}`,
      titulo: c.titulo,
      sub: fecha(c.firmado_en || c.creado_en),
      etiqueta: ESTADO_LABEL[c.estado] || c.estado,
      clase: c.estado,
    })),
    guias: guias.slice(0, 5).map((g) => ({
      id: g.numero,
      href: `/conductor/guias/${g.numero}`,
      titulo: g.numero,
      sub: `${g.origen_ciudad || ''} → ${g.destino_ciudad || ''}`,
      etiqueta: ESTADOS_GUIA[g.estado]?.corto || g.estado,
      clase: g.estado === 'entregada' ? 'firmado' : 'visto',
    })),
    anticipos: anticipos.slice(0, 5).map((a) => ({
      id: a.id,
      href: '/conductor/anticipos',
      titulo: pesos(a.monto_aprobado || a.monto_solicitado),
      sub: a.destino || a.motivo,
      etiqueta: ESTADO_ANTICIPO[a.estado] || a.estado,
      clase: a.estado === 'legalizado' ? 'firmado'
        : a.estado === 'rechazado' ? 'rechazado'
        : a.estado === 'solicitado' ? 'pendiente' : 'visto',
    })),
  };

  const filas = actividad[pestana] || [];

  return (
    <div className="dashboard-bg con-barra">
      <AppHeader />
      <main className="page">
        <div className="cond-saludo">
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Hola{nombre ? `, ${nombre.split(' ')[0]}` : ''}
            </h1>
            <p className="page-sub" style={{ margin: '4px 0 0' }}>Tu ruta, nuestro compromiso</p>
          </div>
          <span className="plate-badge">{formatearPlaca(placa)}</span>
        </div>

        <div className="stat-row">
          <div className="stat-chip stat-chip-navy">
            <div className="num">{contratos.length}</div><div className="lbl">Contratos</div>
          </div>
          <div className="stat-chip stat-chip-amber">
            <div className="num">{pendientes}</div><div className="lbl">Por firmar</div>
          </div>
          <div className="stat-chip stat-chip-green">
            <div className="num">{firmados}</div><div className="lbl">Firmados</div>
          </div>
        </div>

        {/* ---------------- accesos ---------------- */}
        {cargado && firmados > 0 ? (
          <div className="cond-tiles">
            <Link href="/conductor/guias" className="cond-tile cond-tile-navy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h11v8H3z" /><path d="M14 10h3.5l2.5 3v2H14z" />
                <circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" />
              </svg>
              <span className="cond-tile-titulo">Mis guías</span>
              <span className="cond-tile-sub">Consulta tus guías de envío</span>
              <span className="cond-tile-flecha" aria-hidden="true">›</span>
            </Link>

            <Link href="/conductor/anticipos" className="cond-tile cond-tile-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
                <circle cx="12" cy="12" r="2.4" /><path d="M6 10.5v3M18 10.5v3" />
              </svg>
              <span className="cond-tile-titulo">Anticipos</span>
              <span className="cond-tile-sub">Pide dinero por adelantado</span>
              <span className="cond-tile-flecha" aria-hidden="true">›</span>
            </Link>
          </div>
        ) : cargado && (
          <div className="guias-acceso guias-acceso-bloqueado">
            <span>
              <span className="guias-acceso-titulo">Guías y anticipos</span>
              <span className="guias-acceso-sub">Se activan cuando firmes tu contrato.</span>
            </span>
          </div>
        )}

        {/* ---------------- actividad ---------------- */}
        <section className="cond-actividad">
          <h2 className="seccion-titulo" style={{ margin: '0 0 10px' }}>Mi actividad</h2>

          <div className="cond-pestanas">
            {[
              ['contratos', 'Contratos'],
              ['guias', 'Guías'],
              ['anticipos', 'Anticipos'],
            ].map(([id, texto]) => (
              <button
                key={id}
                className={`cond-pestana${pestana === id ? ' cond-pestana-activa' : ''}`}
                onClick={() => setPestana(id)}
              >
                {texto}
              </button>
            ))}
          </div>

          {filas.length === 0 ? (
            <p className="cond-vacio">
              {!cargado ? 'Cargando…'
                : pestana === 'contratos' ? 'Aún no tienes contratos.'
                : pestana === 'guias' ? 'Aún no tienes guías asignadas.'
                : 'Aún no has pedido anticipos.'}
            </p>
          ) : (
            filas.map((f) => (
              <Link href={f.href} key={f.id} className="cond-fila">
                <span className="cond-fila-txt">
                  <span className="cond-fila-titulo">{f.titulo}</span>
                  <span className="cond-fila-sub">{f.sub}</span>
                </span>
                <span className={`status status-${f.clase}`}>{f.etiqueta}</span>
              </Link>
            ))
          )}
        </section>
      </main>

      <BarraConductor activo="/conductor" />
    </div>
  );
}
