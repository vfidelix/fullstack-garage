import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { createAuthenticationError } from '../../application/authentication/authenticationError';
import type { AuthenticationState } from '../../application/authentication/authenticationModels';
import type { AuthGateway } from '../../application/ports/authGateway';
import type { AuthenticationSessionEvents } from '../../application/ports/authenticationSessionEvents';
import { AuthenticationController } from '../../application/use-cases/auth/authenticationController';
import type { AppUser } from '../../domain/users/appUser';
import { AuthenticationProvider } from '../providers/AuthenticationProvider';
import {
  AuthenticationContext,
  type AuthenticationContextValue,
} from '../providers/authenticationContext';
import { AppRoutes } from './AppRoutes';

const appUser: AppUser = {
  id: '2dc6ce1b-03a9-4c79-a658-0459528a4d4c',
  displayName: 'Garage Operator',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const authenticatedState: AuthenticationState = {
  status: 'authenticated',
  user: appUser,
};
const authenticatedMemberState: AuthenticationState = {
  status: 'authenticated',
  user: {
    ...appUser,
    id: 'b0f12693-0da7-4eb4-859c-2312a32f9c11',
    displayName: 'Reserved Member',
    role: 'member',
  },
};
const errorState: AuthenticationState = {
  status: 'error',
  error: createAuthenticationError('unexpected'),
};

function createAuthentication(
  state: AuthenticationState,
  overrides: Partial<AuthenticationContextValue> = {},
): AuthenticationContextValue {
  return {
    state,
    completeAuthenticationRedirect: vi.fn().mockResolvedValue(state),
    registerPrivateStateCleanup: vi.fn(() => vi.fn()),
    restoreAuthentication: vi.fn().mockResolvedValue(state),
    signInWithGoogle: vi.fn().mockResolvedValue(state),
    signOut: vi.fn().mockResolvedValue({ status: 'unauthenticated' }),
    ...overrides,
  };
}

function renderRoutes(
  initialEntry: string,
  authentication: AuthenticationContextValue,
  strict = false,
) {
  const content = (
    <AuthenticationContext.Provider value={authentication}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthenticationContext.Provider>
  );

  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}

function createSessionEvents(): AuthenticationSessionEvents {
  return { subscribe: vi.fn(() => vi.fn()) };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  if (resolvePromise === undefined) {
    throw new Error('Deferred promise was not initialized.');
  }

  return { promise, resolve: resolvePromise };
}

describe('protected application routes', () => {
  it('never renders protected content while authentication initializes', () => {
    renderRoutes(
      '/vehicles/garage?tab=history#latest-record',
      createAuthentication({ status: 'initializing' }),
    );

    expect(screen.getByLabelText('Loading Fullstack Garage')).toBeVisible();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders dashboard and deep-linked application content when authenticated', () => {
    const authentication = createAuthentication(authenticatedState);
    const dashboard = renderRoutes('/dashboard', authentication);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByLabelText('Current user')).toHaveTextContent(
      'Garage OperatorGarage Admin',
    );
    expect(screen.queryByText(/supabase|provider|token/iu)).not.toBeInTheDocument();
    dashboard.unmount();

    renderRoutes(
      '/vehicles/garage?tab=history#latest-record',
      authentication,
    );
    expect(screen.getByLabelText('Current application path')).toHaveTextContent(
      '/vehicles/garage?tab=history#latest-record',
    );
  });

  it('calls local sign-out once from the authenticated shell', () => {
    const signOut = vi.fn().mockResolvedValue({ status: 'unauthenticated' });
    renderRoutes(
      '/dashboard',
      createAuthentication(authenticatedState, { signOut }),
    );

    const button = screen.getByRole('button', {
      name: 'Sign out Garage Operator',
    });
    button.focus();
    expect(button).toHaveFocus();

    fireEvent.click(button);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it.each<AuthenticationState>([
    { status: 'initializing' },
    { status: 'unauthenticated' },
    { status: 'unauthorized' },
    errorState,
  ])('does not render the authenticated shell while $status', (state) => {
    renderRoutes('/dashboard', createAuthentication(state));

    expect(screen.queryByTestId('authenticated-shell')).not.toBeInTheDocument();
  });

  it('hides the authenticated shell as soon as controller sign-out begins', async () => {
    const pendingSignOut = createDeferred<undefined>();
    const signOut = vi.fn(() => pendingSignOut.promise);
    const gateway: AuthGateway = {
      restore: vi.fn().mockResolvedValue(authenticatedState),
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      signOut,
    };
    const controller = new AuthenticationController(gateway);

    render(
      <AuthenticationProvider
        controller={controller}
        sessionEvents={createSessionEvents()}
      >
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthenticationProvider>,
    );

    fireEvent.click(await screen.findByRole('button', {
      name: 'Sign out Garage Operator',
    }));

    expect(signOut).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByTestId('authenticated-shell')).not.toBeInTheDocument();
      expect(screen.getByRole('status', {
        name: 'Loading Fullstack Garage',
      })).toBeVisible();
    });
  });

  it('preserves a protected pathname, query, and hash for unauthenticated sign-in', () => {
    const signInWithGoogle = vi.fn().mockResolvedValue({ status: 'initializing' });
    renderRoutes(
      '/vehicles/garage?tab=history#latest-record',
      createAuthentication(
        { status: 'unauthenticated' },
        { signInWithGoogle },
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signInWithGoogle).toHaveBeenCalledWith(
      '/vehicles/garage?tab=history#latest-record',
    );
  });

  it('routes unauthorized users to access unavailable', () => {
    const signOut = vi.fn().mockResolvedValue({ status: 'unauthenticated' });
    renderRoutes(
      '/dashboard',
      createAuthentication({ status: 'unauthorized' }, { signOut }),
    );

    expect(screen.getByRole('heading', { name: 'Access unavailable' })).toBeVisible();
    expect(screen.getByText(/Garage Admin access/u)).toBeVisible();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('fails closed when an authenticated user is not a Garage Admin', () => {
    const signOut = vi.fn().mockResolvedValue({ status: 'unauthenticated' });
    renderRoutes(
      '/dashboard',
      createAuthentication(authenticatedMemberState, { signOut }),
    );

    expect(screen.getByRole('heading', { name: 'Access unavailable' })).toBeVisible();
    expect(screen.queryByLabelText('Current user')).not.toBeInTheDocument();
    expect(screen.queryByTestId('authenticated-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('offers a safe restore retry for protected-route authentication errors', () => {
    const restoreAuthentication = vi.fn().mockResolvedValue(authenticatedState);
    renderRoutes(
      '/dashboard',
      createAuthentication(errorState, { restoreAuthentication }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(restoreAuthentication).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});

describe('public authentication routes', () => {
  it('uses only a validated local returnPath for sign-in', () => {
    const signInWithGoogle = vi.fn().mockResolvedValue({ status: 'initializing' });
    renderRoutes(
      '/sign-in?returnPath=https%3A%2F%2Fattacker.example%2Fprivate&next=%2Fvehicles',
      createAuthentication(
        { status: 'unauthenticated' },
        { signInWithGoogle },
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signInWithGoogle).toHaveBeenCalledWith('/dashboard');
  });

  it('does not leave authenticated users on sign-in or access unavailable', () => {
    const authentication = createAuthentication(authenticatedState);
    const signIn = renderRoutes(
      '/sign-in?returnPath=%2Fvehicles%2Fgarage%3Ftab%3Dhistory%23latest',
      authentication,
    );

    expect(screen.getByLabelText('Current application path')).toHaveTextContent(
      '/vehicles/garage?tab=history#latest',
    );
    signIn.unmount();

    renderRoutes('/access-unavailable', authentication);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('does not leave an unauthenticated user on access unavailable', () => {
    renderRoutes(
      '/access-unavailable',
      createAuthentication({ status: 'unauthenticated' }),
    );

    expect(screen.getByRole('heading', { name: 'Garage Admin sign in' })).toBeVisible();
  });
});

describe('authentication callback route', () => {
  it('uses the provider startup restore once in StrictMode and navigates on success', async () => {
    const restore = vi.fn().mockResolvedValue(authenticatedState);
    const gateway: AuthGateway = {
      restore,
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthenticationController(gateway);

    render(
      <StrictMode>
        <AuthenticationProvider
          controller={controller}
          sessionEvents={createSessionEvents()}
        >
          <MemoryRouter
            initialEntries={[
              '/auth/callback?returnPath=%2Fvehicles%2Fgarage%3Ftab%3Dhistory%23latest',
            ]}
          >
            <AppRoutes />
          </MemoryRouter>
        </AuthenticationProvider>
      </StrictMode>,
    );

    expect(await screen.findByLabelText('Current application path')).toHaveTextContent(
      '/vehicles/garage?tab=history#latest',
    );
    expect(restore).toHaveBeenCalledOnce();
  });

  it('uses settled provider state to restore a validated deep link', async () => {
    const completeAuthenticationRedirect = vi.fn().mockResolvedValue(authenticatedState);
    renderRoutes(
      '/auth/callback?returnPath=%2Fvehicles%2Fgarage%3Ftab%3Dhistory%23latest&code=ignored',
      createAuthentication(authenticatedState, { completeAuthenticationRedirect }),
    );

    expect(await screen.findByLabelText('Current application path')).toHaveTextContent(
      '/vehicles/garage?tab=history#latest',
    );
    expect(completeAuthenticationRedirect).not.toHaveBeenCalled();
  });

  it('falls back to dashboard for a malicious callback return path', async () => {
    renderRoutes(
      '/auth/callback?returnPath=https%3A%2F%2Fattacker.example%2Fprivate',
      createAuthentication(authenticatedState),
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('routes an unauthorized callback result to access unavailable', async () => {
    const unauthorized = { status: 'unauthorized' } as const;
    renderRoutes('/auth/callback', createAuthentication(unauthorized));

    expect(
      await screen.findByRole('heading', { name: 'Access unavailable' }),
    ).toBeVisible();
  });

  it('routes an expired or absent callback session to sign-in with its return path', async () => {
    const unauthenticated = { status: 'unauthenticated' } as const;
    renderRoutes(
      '/auth/callback?returnPath=%2Fvehicles%2Fgarage%3Ftab%3Dhistory%23latest',
      createAuthentication(unauthenticated),
    );

    expect(
      await screen.findByRole('heading', { name: 'Garage Admin sign in' }),
    ).toBeVisible();
  });

  it('shows a safe callback error and allows an explicit retry', async () => {
    const completeAuthenticationRedirect = vi.fn().mockResolvedValue(errorState);
    renderRoutes(
      '/auth/callback?error_description=provider-secret',
      createAuthentication(errorState, { completeAuthenticationRedirect }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Authentication is temporarily unavailable. Please try again.',
    );
    expect(screen.queryByText('provider-secret')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(completeAuthenticationRedirect).toHaveBeenCalledOnce();
    });
  });
});
