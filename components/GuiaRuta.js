import { ESTADOS_GUIA, PASOS_RUTA, pasoActual } from '../lib/guias';

// "Carretera" con los pasos del envío. El camión marca dónde va la guía.
export default function GuiaRuta({ eventos, estado }) {
  const cancelada = estado === 'cancelada';
  const paso = pasoActual(eventos);
  const avance = paso / (PASOS_RUTA.length - 1);

  return (
    <ol className={`ruta${cancelada ? ' ruta-cancelada' : ''}`}
      style={{ '--avance': avance, '--pasos': PASOS_RUTA.length }}
      aria-label="Progreso del envío">
      <span className="ruta-via" aria-hidden="true" />
      <span className="ruta-avance" aria-hidden="true" />
      {PASOS_RUTA.map((p, i) => {
        const final = p === 'entregada';
        const actual = i === paso && !cancelada && !final;
        const hecho = i < paso || (i === paso && final);
        const clase = ['ruta-paso', hecho ? 'hecho' : '', actual ? 'actual' : ''].join(' ');
        return (
          <li key={p} className={clase} aria-current={i === paso ? 'step' : undefined}>
            <span className="ruta-punto">{actual ? <Camion /> : hecho ? <Check /> : null}</span>
            <span className="ruta-etiqueta">{ESTADOS_GUIA[p].corto}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Camion() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M2 6.5A1.5 1.5 0 0 1 3.5 5h9A1.5 1.5 0 0 1 14 6.5V15H2z" />
      <path fill="currentColor" d="M15 9h3.2a1 1 0 0 1 .8.4l2.8 3.4a1 1 0 0 1 .2.6V15h-7z" />
      <circle cx="6.5" cy="17" r="2.2" fill="currentColor" stroke="var(--navy)" strokeWidth="1.2" />
      <circle cx="17.5" cy="17" r="2.2" fill="currentColor" stroke="var(--navy)" strokeWidth="1.2" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
