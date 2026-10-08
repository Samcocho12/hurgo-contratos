import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { llamarApiJefe } from '../../lib/apiJefe';
import PanelLayout from '../../components/PanelLayout';
import { formatearPlaca } from '../../lib/placa';

const ESTADO_LABEL = { pendiente: 'Pendiente', visto: 'Visto', firmado: 'Firmado', rechazado: 'Rechazado' };

// Tarjeta de cifra. El pie muestra un dato real (cuántos van este mes),
// no un porcentaje de variación: con pocos registros, "+100%" engaña más
// de lo que informa.
function Cifra({ icono, color, titulo, valor, pie }) {
  return (
    <div className={`kpi kpi-${color}`}>
      <div className="kpi-ico">{icono}</div>
      <div className="kpi-cuerpo">
        <div className="kpi-titulo">{titulo}</div>
        <div className="kpi-valor">{valor}</div>
        {pie && <div className="kpi-pie">{pie}</div>}
      </div>
    </div>
  );
}

// Dona dibujada con un solo círculo SVG y trazos discontinuos.
function Dona({ partes, total }) {
  const radio = 54;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  return (
    <div className="dona-caja">
      <svg viewBox="0 0 140 140" className="dona">
        <circle cx="70" cy="70" r={radio} fill="none" stroke="#EDF0F6" strokeWidth="18" />
        {total > 0 && partes.filter((p) => p.valor > 0).map((p) => {
          const largo = (p.valor / total) * circunferencia;
          const trazo = (
            <circle
              key={p.id}
              cx="70" cy="70" r={radio} fill="none"
              stroke={p.color} strokeWidth="18"
              strokeDasharray={`${largo} ${circunferencia - largo}`}
              strokeDashoffset={-acumulado}
              transform="rotate(-90 70 70)"
            />
          );
          acumulado += largo;
          return trazo;
        })}
        <text x="70" y="66" textAnchor="middle" className="dona-num">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="dona-lbl">
          {total === 1 ? 'contrato' : 'contratos'}
        </text>
      </svg>

      <ul className="dona-leyenda">
        {partes.map((p) => (
          <li key={p.id}>
            <span className="punto" style={{ background: p.color }} />
            <span className="dona-nombre">{p.nombre}</span>
            <span className="dona-valor">{p.valor}</span>
            <span className="dona-pct">{total ? Math.round((p.valor / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Resumen() {
  const router = useRouter();
  const [contratos, setContratos] = useState([]);
  const [conductores, setConductores] = useState([]);
  const [guias, setGuias] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [sinDobleFactor, setSinDobleFactor] = useState(false);

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
    const [respContratos, respConductores] = await Promise.all([
      llamarApiJefe('/api/jefe/contratos?vista=resumen'),
      llamarApiJefe('/api/jefe/conductores'),
    ]);
    setContratos(respContratos.ok ? (respContratos.datos.contratos || []) : []);
    setGuias(respContratos.ok ? (respContratos.datos.guias || []) : []);
    setConductores(respConductores.ok ? (respConductores.datos.conductores || []) : []);

    const seguridad = await llamarApiJefe('/api/jefe/seguridad');
    if (seguridad.ok && !seguridad.datos.activo) setSinDobleFactor(true);

    setCargado(true);
  }

  const firmados = contratos.filter((c) => c.estado === 'firmado').length;
  const pendientes = contratos.filter((c) => c.estado === 'pendiente' || c.estado === 'visto').length;
  const rechazados = contratos.filter((c) => c.estado === 'rechazado').length;

  const activos = conductores.filter((c) => c.aprobado && c.activo).length;
  const solicitudes = conductores.filter((c) => !c.aprobado).length;
  const sinEnrolar = conductores.filter((c) => c.aprobado && !c.enrolado).length;

  const enCamino = guias.filter((g) => g.estado === 'recogiendo' || g.estado === 'en_camino').length;

  const mesActual = new Date().getMonth();
  const anioActual = new Date().getFullYear();
  const esteMes = contratos.filter((c) => {
    const f = new Date(c.creado_en);
    return f.getMonth() === mesActual && f.getFullYear() === anioActual;
  }).length;

  const recientes = contratos.slice(0, 6);

  return (
    <PanelLayout
      activo="/jefe"
      titulo="Resumen"
      descripcion="Cómo van los contratos, los conductores y los envíos."
      acciones={
        <Link href="/jefe/contratos" className="btn btn-stamp">Nuevo contrato</Link>
      }
    >
      {/* ---------- aviso de seguridad ---------- */}
      {sinDobleFactor && (
        <Link href="/jefe/seguridad" className="aviso-accion">
          <strong>Tu cuenta no tiene verificación en dos pasos</strong>
          <span>Desde aquí se aprueban conductores y dinero · activarla →</span>
        </Link>
      )}

      {/* ---------- aviso de solicitudes ---------- */}
      {solicitudes > 0 && (
        <Link href="/jefe/conductores" className="aviso-accion">
          <strong>
            {solicitudes} conductor{solicitudes > 1 ? 'es' : ''} esperando confirmación
          </strong>
          <span>Revisa las solicitudes antes de darles acceso →</span>
        </Link>
      )}

      {/* ---------- cifras ---------- */}
      <div className="kpis">
        <Cifra color="azul" titulo="Contratos enviados" valor={contratos.length}
          pie={`${esteMes} este mes`}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
            </svg>} />

        <Cifra color="ambar" titulo="Pendientes por firmar" valor={pendientes}
          pie={pendientes === 0 ? 'Todo al día' : 'Esperando al conductor'}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>} />

        <Cifra color="verde" titulo="Firmados" valor={firmados}
          pie={`${guias.length} guía${guias.length === 1 ? '' : 's'} creadas`}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" />
            </svg>} />

        <Cifra color="morado" titulo="Conductores activos" valor={activos}
          pie={sinEnrolar > 0 ? `${sinEnrolar} sin enrolar` : 'Todos enrolados'}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
              <path d="M16 11.5a3 3 0 0 0 0-6" />
            </svg>} />
      </div>

      {/* ---------- bloques ---------- */}
      <div className="bloques">
        <section className="bloque">
          <div className="bloque-top"><h2>Estado de contratos</h2></div>
          {contratos.length === 0 ? (
            <p className="bloque-vacio">Todavía no has enviado contratos.</p>
          ) : (
            <Dona
              total={contratos.length}
              partes={[
                { id: 'f', nombre: 'Firmados', valor: firmados, color: '#1E9E5A' },
                { id: 'p', nombre: 'Por firmar', valor: pendientes, color: '#E8A32B' },
                { id: 'r', nombre: 'Rechazados', valor: rechazados, color: '#D4484D' },
              ]}
            />
          )}
        </section>

        <section className="bloque">
          <div className="bloque-top">
            <h2>Últimos movimientos</h2>
            <Link href="/jefe/auditoria" className="bloque-link">Ver actividad →</Link>
          </div>

          {recientes.length === 0 ? (
            <p className="bloque-vacio">Aquí van a aparecer los contratos que envíes.</p>
          ) : (
            <ul className="lista-mov">
              {recientes.map((c) => (
                <li key={c.id}>
                  <span className={`punto-estado punto-${c.estado}`} />
                  <div className="mov-texto">
                    <div className="mov-titulo">{c.titulo}</div>
                    <div className="mov-sub">{c.conductor_nombre}</div>
                  </div>
                  <div className="mov-fecha">
                    {new Date(c.creado_en).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </div>
                  <span className={`status status-${c.estado}`}>{ESTADO_LABEL[c.estado]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- tabla reciente ---------- */}
      <section className="bloque bloque-ancho">
        <div className="bloque-top">
          <h2>Contratos recientes</h2>
          <Link href="/jefe/contratos" className="bloque-link">Ver todos →</Link>
        </div>

        {recientes.length === 0 ? (
          <p className="bloque-vacio">
            {cargado ? 'No hay contratos todavía.' : 'Cargando…'}
          </p>
        ) : (
          <div className="tabla-caja" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Placa</th><th>Documento</th><th>Conductor</th>
                  <th>Enviado</th><th className="td-fin">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((c) => (
                  <tr key={c.id}>
                    <td><span className="plate-badge">{formatearPlaca(c.conductor_placa)}</span></td>
                    <td className="td-doc">{c.titulo}</td>
                    <td>{c.conductor_nombre}</td>
                    <td className="td-suave">
                      {new Date(c.creado_en).toLocaleDateString('es-CO', {
                        day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="td-fin">
                      <span className={`status status-${c.estado}`}>{ESTADO_LABEL[c.estado]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {enCamino > 0 && (
        <p className="nota-pie">
          {enCamino} envío{enCamino > 1 ? 's' : ''} en camino ahora mismo ·{' '}
          <Link href="/jefe/guias">ver guías</Link>
        </p>
      )}
    </PanelLayout>
  );
}
