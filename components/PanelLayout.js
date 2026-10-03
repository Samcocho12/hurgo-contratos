import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import AppHeader from './AppHeader';
import JefeTabs from './JefeTabs';

// Envoltura del panel del coordinador.
//
// En escritorio (>=900px) dibuja una barra lateral fija y una barra
// superior con el titulo y las acciones.
// En celular no cambia nada: sigue saliendo el AppHeader y las pestanas,
// exactamente como hasta ahora.

const SECCIONES = [
  { href: '/jefe', label: 'Contratos' },
  { href: '/jefe/guias', label: 'Guías' },
  { href: '/jefe/conductores', label: 'Conductores' },
  { href: '/jefe/firmados', label: 'Firmados' },
  { href: '/jefe/usuarios', label: 'Usuarios' },
  { href: '/jefe/auditoria', label: 'Actividad' },
];

export default function PanelLayout({ activo, titulo, descripcion, acciones, children }) {
  const router = useRouter();

  async function salir() {
    await supabase.auth.signOut();
    localStorage.removeItem('hurgo_rol');
    router.push('/login');
  }

  return (
    <div className="panel">
      {/* ---------- Barra lateral (solo escritorio) ---------- */}
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
              {s.label}
            </Link>
          ))}
        </nav>

        <div className="panel-pie">
          <div className="panel-rol">Coordinación</div>
          <button className="panel-salir" onClick={salir}>Cambiar de usuario</button>
        </div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <div className="panel-main">
        {/* En celular se conserva la cabecera y las pestañas de siempre */}
        <div className="solo-movil">
          <AppHeader />
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
