import { Logo } from '../components/Logo.jsx';
import { useSession } from '../state/SessionProvider.jsx';

/** Pantalla de bienvenida: conectar con Google o probar el modo demo. */
export function OnboardingScreen() {
  const { config, signInWithGoogle, enterDemo } = useSession();
  const canSignInWithGoogle = Boolean(config?.googleClientId);

  return (
    <section className="ob">
      <div className="ob-hero">
        <div className="mark mark-large">
          <Logo />
        </div>
        <h1>Tus gastos se registran solos.</h1>
        <p>
          Movo lee las notificaciones de tus bancos en Gmail y las convierte en movimientos ordenados por categoría. Sin
          teclear nada.
        </p>
      </div>
      <div className="ob-actions">
        <button type="button" className="cta light" disabled={!canSignInWithGoogle} onClick={signInWithGoogle}>
          Conectar con Google
        </button>
        <button type="button" className="ghost glass" onClick={enterDemo}>
          Ver el modo demo
        </button>
        <p className="ob-note">
          {canSignInWithGoogle
            ? ''
            : 'El servidor todavía no tiene configurado el inicio de sesión con Google. Puedes usar el modo demo.'}
        </p>
        <ul className="ob-list">
          <li>Tu correo se lee desde este teléfono, con permiso de solo lectura.</li>
          <li>Los correos nunca se envían al servidor.</li>
          <li>Código abierto: puedes revisar qué hace.</li>
        </ul>
      </div>
    </section>
  );
}
