import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../../../lib/supabaseClient';
import AppHeader from '../../../components/AppHeader';

export default function FirmarContrato() {
  const router = useRouter();
  const { id } = router.query;
  const sigPadRef = useRef(null);

  const [contrato, setContrato] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('hurgo_rol') !== 'conductor') { router.replace('/login'); return; }
    if (id) cargarContrato();
  }, [id]);

  async function cargarContrato() {
    const { data: c } = await supabase.from('contratos').select('*').eq('id', id).single();
    if (!c) return;
    setContrato(c);

    if (c.estado === 'pendiente') {
      await supabase.from('contratos')
        .update({ estado: 'visto', visto_en: new Date().toISOString() })
        .eq('id', id);
    }
  }

  async function confirmarFirma() {
    setError('');
    if (sigPadRef.current.isEmpty()) {
      setError('Dibuja tu firma antes de continuar.');
      return;
    }
    setEnviando(true);

    const firmaPng = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');

    let rutaArchivo = null;
    try {
      const resp = await fetch('/api/generar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratoId: contrato.id, firmaPng }),
      });
      const resultado = await resp.json();
      if (resp.ok) rutaArchivo = resultado.rutaArchivo;
    } catch (e) {
      // Si el PDF falla, igual dejamos registrada la firma para no frenar la demo.
    }

    const { error: updError } = await supabase.from('contratos').update({
      estado: 'firmado',
      firma_png: firmaPng,
      pdf_firmado_url: rutaArchivo,
      firmado_en: new Date().toISOString(),
    }).eq('id', contrato.id);

    setEnviando(false);
    if (updError) {
      setError('No se pudo guardar la firma: ' + updError.message);
      return;
    }
    router.push('/conductor');
  }

  if (!contrato) return (
    <>
      <AppHeader />
      <main className="page"><p className="page-sub">Cargando contrato…</p></main>
    </>
  );

  if (contrato.estado === 'firmado') {
    return (
      <>
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/conductor')}>← Volver</button>
        <h1 className="page-title">{contrato.titulo}</h1>
        <p className="page-sub">Firmado el {new Date(contrato.firmado_en).toLocaleString('es-CO')}</p>

        {contrato.pdf_firmado_url ? (
          <iframe src={contrato.pdf_firmado_url} title="Contrato firmado"
            style={{ width: '100%', height: 420, border: '1px solid var(--line)', borderRadius: 12, marginBottom: 20 }} />
        ) : contrato.contrato_original_url ? (
          <iframe src={contrato.contrato_original_url} title="Contrato"
            style={{ width: '100%', height: 420, border: '1px solid var(--line)', borderRadius: 12, marginBottom: 20 }} />
        ) : null}

        <div className="signed-block">
          <div className="lbl">Tu firma</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={contrato.firma_png} alt="Firma" style={{ maxHeight: 90 }} />
        </div>
        {contrato.pdf_firmado_url && (
          <a className="btn btn-ghost" href={contrato.pdf_firmado_url} target="_blank" rel="noreferrer">
            Descargar PDF firmado
          </a>
        )}
      </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="page">
        <button className="back-link" onClick={() => router.push('/conductor')}>← Volver</button>
        <h1 className="page-title">{contrato.titulo}</h1>
        <p className="page-sub">Lee el contrato completo antes de firmar.</p>

        {contrato.contrato_original_url ? (
          <iframe src={contrato.contrato_original_url} title="Contrato"
            style={{ width: '100%', height: 420, border: '1px solid var(--line)', borderRadius: 12, marginBottom: 20 }} />
        ) : (
          <div className="contract-paper">{contrato.contenido || 'Este contrato no tiene contenido cargado.'}</div>
        )}

        <label style={{ marginTop: 0 }}>Tu firma</label>
        <div className="sign-box">
          <SignatureCanvas
            ref={sigPadRef}
            penColor="#16215C"
            canvasProps={{ className: 'sig-canvas', width: 400, height: 180 }}
          />
        </div>
        <div className="sign-tools">
          <button className="link-btn" onClick={() => sigPadRef.current.clear()}>Borrar firma</button>
        </div>

        {error && <div className="error">{error}</div>}
        <button className="btn btn-stamp" onClick={confirmarFirma} disabled={enviando}>
          {enviando ? 'Guardando firma...' : 'Firmar y aceptar contrato'}
        </button>
      </main>
    </>
  );
}
