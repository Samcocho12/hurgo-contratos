import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import AppHeader from './AppHeader';
import JefeTabs from './JefeTabs';

// Iconos de linea, dibujados a mano para no sumar una libreria entera
// por seis dibujos. Heredan el color del texto del menu.
const Ico = ({ d, children }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children || <path d={d} />}
  </svg>
);

const ICONOS = {
  resumen: (
    <Ico><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></Ico>
  ),
  contratos: (
    <Ico><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></Ico>
  ),
  guias: (
    <Ico><path d="M3 7h11v9H3z" /><path d="M14 10h3.5l2.5 3v3H14z" />
      <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></Ico>
  ),
  conductores: (
    <Ico><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 11.5a3 3 0 0 0 0-6" /><path d="M18 20a5 5 0 0 0-2.2-4.1" /></Ico>
  ),
  firmados: (
    <Ico><path d="M20 6 9 17l-5-5" /></Ico>
  ),
  anticipos: (
    <Ico><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" /></Ico>
  ),
  usuarios: (
    <Ico><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></Ico>
  ),
  actividad: (
    <Ico><path d="M3 17l5-6 4 4 4-7 5 6" /></Ico>
  ),
  seguridad: (
    <Ico><path d="M12 3.2 19 6v5.4c0 4-2.8 7.5-7 8.6-4.2-1.1-7-4.6-7-8.6V6z" />
      <path d="m9.2 12 2 2 3.6-3.8" /></Ico>
  ),
  salir: (
    <Ico><path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
      <path d="M19 12H9m10 0-3-3m3 3-3 3" /></Ico>
  ),
};

const SECCIONES = [
  { href: '/jefe', label: 'Resumen', ico: 'resumen' },
  { href: '/jefe/contratos', label: 'Contratos', ico: 'contratos' },
  { href: '/jefe/guias', label: 'Guías', ico: 'guias' },
  { href: '/jefe/conductores', label: 'Conductores', ico: 'conductores' },
  { href: '/jefe/firmados', label: 'Firmados', ico: 'firmados' },
  { href: '/jefe/anticipos', label: 'Anticipos', ico: 'anticipos' },
  { href: '/jefe/usuarios', label: 'Usuarios', ico: 'usuarios' },
  { href: '/jefe/seguridad', label: 'Seguridad', ico: 'seguridad' },
  { href: '/jefe/auditoria', label: 'Actividad', ico: 'actividad' },
];

export default function PanelLayout({ activo, titulo, descripcion, acciones, children }) {
  const router = useRouter();
  const [correo, setCorreo] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCorreo(data?.user?.email || ''));
  }, []);

  // Marca el documento mientras el panel esta montado. Asi el fondo de
  // html y body se pinta azul sin depender de :has(), que no todos los
  // navegadores aplican igual, y no queda ninguna franja clara al borde.
  useEffect(() => {
    document.documentElement.classList.add('con-panel');
    document.body.classList.add('con-panel');
    return () => {
      document.documentElement.classList.remove('con-panel');
      document.body.classList.remove('con-panel');
    };
  }, []);

  async function salir() {
    await supabase.auth.signOut();
    localStorage.removeItem('hurgo_rol');
    router.push('/login');
  }

  const iniciales = (correo || '?').slice(0, 2).toUpperCase();

  return (
    <div className="consola">
      {/* ---------------- Barra lateral (escritorio) ---------------- */}
      <aside className="panel-nav solo-escritorio">
        <Link href="/jefe" className="panel-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo-hurgo-blanco.svg" alt="Hurgo Transporte Logística" />
        </Link>

        <nav className="panel-menu">
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`panel-menu-item${activo === s.href ? ' panel-menu-activo' : ''}`}
            >
              {ICONOS[s.ico]}
              <span>{s.label}</span>
            </Link>
          ))}
        </nav>

        <div className="panel-pie">
          <button className="panel-menu-item panel-salir" onClick={salir}>
            {ICONOS.salir}
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ---------------- Contenido ---------------- */}
      <div className="panel-main">
        <div className="solo-movil">
          <AppHeader />
        </div>

        {/* barra superior con el usuario */}
        <div className="panel-barra solo-escritorio">
          <div className="panel-usuario">
            <div className="panel-avatar">{iniciales}</div>
            <div>
              <div className="panel-usuario-nombre">{correo || '—'}</div>
              <div className="panel-usuario-rol">Coordinación</div>
            </div>
          </div>
        </div>

        <header className="panel-top solo-escritorio">
          <div>
            <h1 className="panel-top-titulo">{titulo}</h1>
            {descripcion && <p className="panel-top-sub">{descripcion}</p>}
          </div>
          {acciones && <div className="panel-top-acciones">{acciones}</div>}
        </header>

        <main className="panel-cuerpo">
          <div className="solo-movil">
            <h1 className="page-title">{titulo}</h1>
            {descripcion && <p className="page-sub">{descripcion}</p>}
            <JefeTabs activo={activo} />
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
