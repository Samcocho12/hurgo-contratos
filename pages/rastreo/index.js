import RastreoMarco from '../../components/RastreoMarco';
import BuscadorGuia from '../../components/BuscadorGuia';

export default function Rastreo() {
  return (
    <RastreoMarco titulo="Rastrea tu envío · Hurgo Transporte">
      <section className="rastreo-portada">
        <h1>¿En qué va tu envío?</h1>
        <p>Escribe el número de guía que te compartió quien te envió el paquete.</p>
        <BuscadorGuia />
      </section>
    </RastreoMarco>
  );
}
