import Link from 'next/link';

// Barra inferior fija del conductor. Cuatro destinos, los que de verdad
// existen: inicio, guias, anticipos y su perfil.
const Ico = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const DESTINOS = [
  {
    href: '/conductor', label: 'Inicio',
    ico: <Ico><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></Ico>,
  },
  {
    href: '/conductor/guias', label: 'Guías',
    ico: <Ico><path d="M3 7h11v8H3z" /><path d="M14 10h3.5l2.5 3v2H14z" />
      <circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></Ico>,
  },
  {
    href: '/conductor/anticipos', label: 'Anticipos',
    ico: <Ico><rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.4" /><path d="M6 10.5v3M18 10.5v3" /></Ico>,
  },
  {
    href: '/conductor/perfil', label: 'Perfil',
    ico: <Ico><circle cx="12" cy="8.5" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></Ico>,
  },
];

export default function BarraConductor({ activo }) {
  return (
    <nav className="barra-cond" aria-label="Secciones">
      {DESTINOS.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          className={`barra-cond-item${activo === d.href ? ' barra-cond-activo' : ''}`}
        >
          {d.ico}
          <span>{d.label}</span>
        </Link>
      ))}
    </nav>
  );
}
