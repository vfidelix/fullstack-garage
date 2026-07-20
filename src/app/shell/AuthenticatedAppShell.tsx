import { LayoutDashboard, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { AppUser } from '../../domain/users/appUser';
import brandLogo from '../../shared/assets/brand/Fullstack-Garage-Logo-Transparent.png';
import { DASHBOARD_PATH } from '../routes/routePaths';
import styles from './AuthenticatedAppShell.module.css';

interface AuthenticatedAppShellProps {
  readonly children: ReactNode;
  readonly onSignOut: () => void;
  readonly user: AppUser;
}

export function AuthenticatedAppShell({
  children,
  onSignOut,
  user,
}: AuthenticatedAppShellProps) {
  return (
    <div className={styles.shell} data-testid="authenticated-shell">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NavLink
            aria-label="Fullstack Garage dashboard"
            className={styles.brandLink ?? ''}
            to={DASHBOARD_PATH}
          >
            <img className={styles.logo} src={brandLogo} alt="Fullstack Garage" />
          </NavLink>
          <nav aria-label="Primary navigation" className={styles.navigation}>
            <NavLink
              className={({ isActive }) => (
                isActive
                  ? `${styles.navLink ?? ''} ${styles.navLinkActive ?? ''}`
                  : (styles.navLink ?? '')
              )}
              end
              to={DASHBOARD_PATH}
            >
              <LayoutDashboard aria-hidden="true" className={styles.icon} />
              <span>Dashboard</span>
            </NavLink>
          </nav>
          <div className={styles.accountArea}>
            <div aria-label="Current user" className={styles.identity}>
              <span className={styles.displayName}>{user.displayName}</span>
              <span className={styles.role}>Garage Admin</span>
            </div>
            <button
              aria-label={`Sign out ${user.displayName}`}
              className={styles.signOutButton}
              onClick={onSignOut}
              type="button"
            >
              <LogOut aria-hidden="true" className={styles.icon} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
