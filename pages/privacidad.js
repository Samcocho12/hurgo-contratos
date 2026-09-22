import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Privacidad() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Política de Privacidad · Hurgo Transporte</title>
        <meta name="description" content="Política de privacidad de la aplicación Hurgo Transporte - Contratos" />
      </Head>

      <div className="page">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Hurgo Transporte Logística" className="login-logo" style={{ margin: '0 auto 24px' }} />

        <h1 className="page-title" style={{ textAlign: 'center' }}>Política de Privacidad</h1>
        <p className="page-sub" style={{ textAlign: 'center' }}>
          Aplicación &quot;Hurgo Transporte — Contratos&quot; · Última actualización: 21 de septiembre de 2026
        </p>

        <div className="card" style={{ marginTop: 28, lineHeight: 1.8 }}>

          <h2 className="card-title">1. Responsable del tratamiento</h2>
          <p>
            HURGO TRANSPORTE Y LOGÍSTICA S.A.S., NIT 900958334-1 (en adelante, &quot;Hurgo&quot;), es la empresa responsable del
            tratamiento de los datos personales recolectados a través de esta aplicación.
            Para cualquier solicitud relacionada con tus datos puedes escribir a{' '}
            <strong>asistentegerencia@hurgotransporte.com.co</strong>.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>2. Alcance</h2>
          <p>
            La aplicación tiene dos partes. La parte privada es de uso laboral, para el personal
            de coordinación y los conductores vinculados a Hurgo: permite firmar digitalmente
            contratos de vinculación y gestionar guías de envío. La parte pública es el rastreo
            de envíos, donde cualquier persona con un número de guía puede consultar el estado de
            su envío. La aplicación no está dirigida a menores de 18 años.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>3. Datos que recolectamos</h2>
          <p>Recolectamos únicamente los datos necesarios para la gestión contractual y de los envíos:</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Datos de identificación:</strong> nombre completo y número de documento de identidad.</li>
            <li><strong>Datos de contacto:</strong> número de celular del conductor.</li>
            <li><strong>Datos laborales:</strong> placa del vehículo asignado y documentos contractuales asociados.</li>
            <li><strong>Firma digital:</strong> la imagen de la firma que el usuario traza dentro de la aplicación para suscribir un contrato.</li>
            <li><strong>Datos de los envíos:</strong> nombre, teléfono y dirección del remitente y del destinatario, ciudades de origen y destino, descripción del contenido y el nombre de quien recibe. Los registra el personal de coordinación al crear cada guía.</li>
            <li><strong>Datos de acceso de coordinación:</strong> correo electrónico y contraseña del personal autorizado.</li>
            <li><strong>Datos técnicos:</strong> registros de fecha y hora de acceso y de firma, con fines de trazabilidad y validez del documento.</li>
          </ul>
          <p>
            No recolectamos ubicación, contactos, fotos, micrófono, cámara ni datos de
            navegación. La aplicación no contiene publicidad ni herramientas de seguimiento
            con fines comerciales.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>4. Finalidad del tratamiento</h2>
          <p>
            Los datos se utilizan exclusivamente para generar, firmar y conservar los contratos de
            vinculación entre Hurgo y sus conductores, para gestionar y entregar los envíos, y para
            informar al destinatario el estado de su envío. En el rastreo público solo se muestran
            el estado, las ciudades de origen y destino, las fechas y el nombre abreviado de quien
            recibe (por ejemplo, &quot;Laura G.&quot;); nunca teléfonos, direcciones ni valores. No vendemos,
            alquilamos ni compartimos datos personales con terceros para fines publicitarios.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>5. Base legal</h2>
          <p>
            El tratamiento se realiza con fundamento en la ejecución de la relación contractual
            entre las partes y en el consentimiento expreso que el titular otorga al registrarse
            y al firmar cada documento, conforme a la Ley 1581 de 2012 de Protección de Datos
            Personales de Colombia y su Decreto Reglamentario 1377 de 2013.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>6. Almacenamiento y seguridad</h2>
          <p>
            La información se almacena en servidores de Supabase Inc. y la aplicación se
            distribuye mediante Vercel Inc., proveedores que actúan como encargados del
            tratamiento. Toda la comunicación entre el dispositivo y los servidores viaja
            cifrada mediante HTTPS/TLS. El personal de coordinación accede con correo y contraseña
            individuales, y cada conductor accede con su nombre y la placa de su vehículo para
            consultar únicamente sus propios contratos y guías.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>7. Conservación</h2>
          <p>
            Los contratos firmados se conservan durante el tiempo exigido por la legislación
            laboral y comercial colombiana. Una vez cumplido ese término, o ante una solicitud
            válida de supresión, los datos se eliminan de forma segura.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>8. Derechos del titular</h2>
          <p>
            Como titular de los datos puedes conocer, actualizar, rectificar y solicitar la
            supresión de tu información, así como revocar el consentimiento otorgado. Para
            ejercer estos derechos escribe a <strong>asistentegerencia@hurgotransporte.com.co</strong>.
            Responderemos la solicitud dentro de los plazos establecidos por la ley.
          </p>
          <p>
            Ten en cuenta que la supresión de datos vinculados a un contrato vigente puede estar
            limitada por obligaciones legales de conservación documental.
          </p>

          <h2 id="eliminar-datos" className="card-title" style={{ marginTop: 24 }}>Eliminar tu cuenta y tus datos</h2>
          <p>
            Para eliminar tu registro en la aplicación y los datos asociados, escribe a{' '}
            <strong>asistentegerencia@hurgotransporte.com.co</strong> con el asunto
            &quot;Eliminar mis datos&quot;, indicando tu nombre, tu número de cédula y la placa del
            vehículo. Eliminaremos tu registro de conductor, tu número de celular y tus datos de
            acceso en un plazo máximo de 15 días hábiles, y te confirmaremos por el mismo medio.
            Los contratos firmados y sus firmas pueden conservarse durante el tiempo que exige la
            ley colombiana, como se explica en la sección 7; una vez vencido ese plazo, también se
            eliminan.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>9. Cambios en esta política</h2>
          <p>
            Cualquier modificación se publicará en esta misma página, actualizando la fecha
            indicada en el encabezado. El uso continuado de la aplicación implica la aceptación
            de la versión vigente.
          </p>

          <h2 className="card-title" style={{ marginTop: 24 }}>10. Contacto</h2>
          <p>
            HURGO TRANSPORTE Y LOGÍSTICA S.A.S. — NIT 900958334-1<br />
            Correo: <strong>asistentegerencia@hurgotransporte.com.co</strong><br />
            Teléfono: <strong>300 596 6863</strong><br />
            Dirección: <strong>Cl. 24 #3-99 Local 2, Santa Marta, Magdalena</strong>
          </p>

        </div>

        <button
          className="btn btn-ghost"
          style={{ marginTop: 24 }}
          onClick={() => router.push('/')}
        >
          Volver
        </button>
      </div>
    </>
  );
}
