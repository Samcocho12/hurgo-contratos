import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Redirige según lo que ya haya elegido la persona (guardado en el navegador).
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const rol = typeof window !== 'undefined' ? localStorage.getItem('hurgo_rol') : null;
    if (rol === 'jefe') { router.replace('/jefe'); return; }
    if (rol === 'conductor') { router.replace('/conductor'); return; }
    router.replace('/login');
  }, []);

  return null;
}
