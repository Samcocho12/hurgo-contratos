import { useState } from 'react';
import { copiarTexto, linkWhatsAppRastreo, urlRastreo } from '../lib/guias';

export default function CompartirGuia({ numero, destinatarioNombre, destinatarioTelefono }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const ok = await copiarTexto(urlRastreo(numero));
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    }
  }

  return (
    <div className="panel">
      <h2 className="panel-titulo">Compartir rastreo</h2>
      <p className="panel-texto">El destinatario puede ver en qué va su envío sin instalar nada.</p>
      <a className="btn btn-whatsapp" target="_blank" rel="noreferrer"
        href={linkWhatsAppRastreo({ numero, destinatarioNombre, destinatarioTelefono })}>
        Enviar por WhatsApp al destinatario
      </a>
      <button type="button" className="btn btn-ghost" onClick={copiar}>
        {copiado ? 'Enlace copiado' : 'Copiar enlace de rastreo'}
      </button>
    </div>
  );
}
