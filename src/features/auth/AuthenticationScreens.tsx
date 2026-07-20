import {
  LoaderCircle,
  LogIn,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  createAuthenticationError,
  type AuthenticationErrorCategory,
} from '../../application/authentication/authenticationError';
import brandLogo from '../../shared/assets/brand/Fullstack-Garage-Logo-Transparent.png';
import styles from './AuthenticationScreens.module.css';

interface AuthenticationScreenLayoutProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly label: string;
  readonly title: string;
}

interface AuthenticationErrorScreenProps {
  readonly category: AuthenticationErrorCategory;
  readonly onRetry: () => void;
}

function AuthenticationScreenLayout({
  children,
  description,
  label,
  title,
}: AuthenticationScreenLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.brandPanel}>
          <img className={styles.logo} src={brandLogo} alt="Fullstack Garage" />
          <p className={styles.brandStatement}>
            A precise record of every Vehicle and every Service Record.
          </p>
        </header>
        <section className={styles.contentPanel} aria-labelledby="auth-screen-title">
          <p className={styles.eyebrow}>{label}</p>
          <h1 className={styles.title} id="auth-screen-title">{title}</h1>
          <p className={styles.description}>{description}</p>
          <div className={styles.actionArea}>{children}</div>
        </section>
      </div>
    </main>
  );
}

export function AuthenticationLoadingScreen() {
  return (
    <AuthenticationScreenLayout
      description="Verifying the current session before protected garage data is shown."
      label="Secure access"
      title="Preparing your garage"
    >
      <div
        aria-label="Loading Fullstack Garage"
        aria-live="polite"
        className={styles.status}
        role="status"
      >
        <LoaderCircle aria-hidden="true" className={styles.spinner} />
        <span>Restoring Garage Admin session…</span>
      </div>
    </AuthenticationScreenLayout>
  );
}

export function SignInScreen({ onSignIn }: { readonly onSignIn: () => void }) {
  return (
    <AuthenticationScreenLayout
      description="Continue with the approved Google identity for this garage."
      label="Secure access"
      title="Garage Admin sign in"
    >
      <button className={styles.primaryButton} onClick={onSignIn} type="button">
        <LogIn aria-hidden="true" className={styles.buttonIcon} />
        <span>Continue with Google</span>
      </button>
    </AuthenticationScreenLayout>
  );
}

export function AccessUnavailableScreen({
  onSignOut,
}: { readonly onSignOut: () => void }) {
  return (
    <AuthenticationScreenLayout
      description="This identity is signed in, but it does not have Garage Admin access to Fullstack Garage."
      label="Authorization required"
      title="Access unavailable"
    >
      <button className={styles.outlineButton} onClick={onSignOut} type="button">
        <LogOut aria-hidden="true" className={styles.buttonIcon} />
        <span>Sign out</span>
      </button>
    </AuthenticationScreenLayout>
  );
}

export function AuthenticationErrorScreen({
  category,
  onRetry,
}: AuthenticationErrorScreenProps) {
  const safeMessage = createAuthenticationError(category).message;

  return (
    <AuthenticationScreenLayout
      description="Protected garage data remains hidden until authentication recovers."
      label="Connection interrupted"
      title="Authentication unavailable"
    >
      <p className={styles.errorMessage} role="alert">{safeMessage}</p>
      <button className={styles.outlineButton} onClick={onRetry} type="button">
        <RotateCcw aria-hidden="true" className={styles.buttonIcon} />
        <span>Try again</span>
      </button>
    </AuthenticationScreenLayout>
  );
}
