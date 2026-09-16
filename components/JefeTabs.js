import { useRouter } from 'next/router';

const TABS = [
  { href: '/jefe', label: 'Contratos' },
  { href: '/jefe/guias', label: 'Guías' },
  { href: '/jefe/conductores', label: 'Conductores' },
  { href: '/jefe/firmados', label: 'Firmados' },
  { href: '/jefe/usuarios', label: 'Usuarios' },
];

export default function JefeTabs({ activo, contadores = {} }) {
  const router = useRouter();
  return (
    <nav className="tab-row" aria-label="Secciones">
      {TABS.map((t) => {
        const extra = contadores[t.href] ? ` (${contadores[t.href]})` : '';
        return (
          <button
            key={t.href}
            type="button"
            className={`tab-item${t.href === activo ? ' tab-active' : ''}`}
            aria-current={t.href === activo ? 'page' : undefined}
            onClick={() => t.href !== activo && router.push(t.href)}
          >
            {t.label}{extra}
          </button>
        );
      })}
    </nav>
  );
}
