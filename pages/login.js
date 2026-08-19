import { useState } from 'react';
import { useRouter } from 'next/router';

// Login simplificado para la demo: sin SMS, sin cuentas.
// El coordinador entra con un botón. El conductor escribe su nombre
// (debe coincidir con el nombre que el coordinador usó al enviarle el contrato).
export default function Login() {
  const router = useRouter();
  const [nombreConductor, setNombreConductor] = useState('');
  const [error, setError] = useState('');

  function entrarComoJefe() {
    localStorage.setItem('hurgo_rol', 'jefe');
    localStorage.removeItem('hurgo_nombre');
    router.push('/jefe');
  }

  function entrarComoConductor(e) {
    e.preventDefault();
    if (!nombreConductor.trim()) {
      setError('Escribe tu nombre para continuar.');
      return;
    }
    localStorage.setItem('hurgo_rol', 'conductor');
    localStorage.setItem('hurgo_nombre', nombreConductor.trim());
    router.push('/conductor');
  }

  return (
    <div className="login-wrap">
      <div className="login-mark">H</div>
      <h1>Hurgo Contratos</h1>
      <p>¿Quién eres?</p>

      <div className="login-form">
        <button className="btn btn-primary" onClick={entrarComoJefe}>
          Soy el coordinador
        </button>

        <div style={{ height: 24 }} />

        <form onSubmit={entrarComoConductor}>
          <label>Soy conductor — mi nombre es</label>
          <input
            type="text"
            placeholder="Ej: Carlos Restrepo"
            value={nombreConductor}
            onChange={(e) => setNombreConductor(e.target.value)}
          />
          {error && <div className="error">{error}</div>}
          <button className="btn btn-stamp">Ver mis contratos</button>
        </form>
      </div>
    </div>
  );
}
