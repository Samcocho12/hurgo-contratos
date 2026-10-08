import { useState } from 'react';
import { useRouter } from 'next/router';
import { esNumeroGuiaValido, normalizarNumeroGuia } from '../lib/guias';

export default function BuscadorGuia({ valorInicial = '', compacto = false }) {
  const router = useRouter();
  const [valor, setValor] = useState(valorInicial);
  const [error, setError] = useState('');

  function buscar(e) {
    e.preventDefault();
    const numero = normalizarNumeroGuia(valor);
    if (!esNumeroGuiaValido(numero)) {
      setError('Escribe el número completo: HG seguido de 10 dígitos.');
      return;
    }
    setError('');
    router.push(`/rastreo/${numero}`);
  }

  return (
    <form className={`buscador${compacto ? ' buscador-compacto' : ''}`} onSubmit={buscar} role="search">
      <label htmlFor="numero-guia">Número de guía</label>
      <div className="buscador-fila">
        <input id="numero-guia" value={valor} onChange={(e) => setValor(e.target.value)}
          placeholder="HG 1234 5678 90" autoComplete="off" autoCapitalize="characters"
          spellCheck={false} inputMode="text" />
        <button className="btn btn-stamp">Rastrear</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}
