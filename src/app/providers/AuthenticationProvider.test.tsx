import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticationResult } from '../../application/authentication/authenticationModels';
import type { AuthGateway } from '../../application/ports/authGateway';
import type { AuthenticationSessionEvents } from '../../application/ports/authenticationSessionEvents';
import type { AuthenticationSessionEvent } from '../../application/ports/authenticationSessionEvents';
import { AuthenticationController } from '../../application/use-cases/auth/authenticationController';
import type { AppUser } from '../../domain/users/appUser';
import { AuthenticationProvider } from './AuthenticationProvider';
import {
  useAuthentication,
  usePrivateStateCleanup,
} from './authenticationContext';

const appUser: AppUser = {
  id: '2dc6ce1b-03a9-4c79-a658-0459528a4d4c',
  displayName: 'Garage Operator',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

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

function createGateway(overrides: Partial<AuthGateway> = {}) {
  const gateway: AuthGateway = {
    restore: vi.fn().mockResolvedValue({ status: 'unauthenticated' }),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return gateway;
}

function createSessionEvents(): {
  readonly emit: (event?: AuthenticationSessionEvent) => void;
  readonly events: AuthenticationSessionEvents;
  readonly subscribe: ReturnType<typeof vi.fn>;
  readonly unsubscribe: ReturnType<typeof vi.fn>;
} {
  let listener: ((event: AuthenticationSessionEvent) => void) | undefined;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((nextListener: (event: AuthenticationSessionEvent) => void) => {
    listener = nextListener;
    return unsubscribe;
  });

  return {
    emit: (event = { type: 'session_changed' }) => listener?.(event),
    events: { subscribe },
    subscribe,
    unsubscribe,
  };
}

function AuthenticationProbe() {
  const authentication = useAuthentication();

  return (
    <div>
      <output aria-label="authentication status">
        {authentication.state.status}
      </output>
      <button
        onClick={() => {
          void authentication.signInWithGoogle('/vehicles/deep-link');
        }}
        type="button"
      >
        Sign in
      </button>
      <button
        onClick={() => {
          void authentication.signOut();
        }}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}

function PrivateStateCleanupProbe({
  cleanup,
}: {
  readonly cleanup: () => void | Promise<void>;
}) {
  usePrivateStateCleanup(cleanup);

  return null;
}

describe('AuthenticationProvider', () => {
  it('keeps initialization observable and restores once in StrictMode', async () => {
    const deferredRestore = createDeferred<AuthenticationResult>();
    const restore = vi.fn(() => deferredRestore.promise);
    const controller = new AuthenticationController(createGateway({ restore }));
    const { events, subscribe, unsubscribe } = createSessionEvents();
    const view = render(
      <StrictMode>
        <AuthenticationProvider controller={controller} sessionEvents={events}>
          <AuthenticationProbe />
        </AuthenticationProvider>
      </StrictMode>,
    );

    expect(screen.getByLabelText('authentication status')).toHaveTextContent('initializing');
    expect(restore).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledOnce();

    deferredRestore.resolve({ status: 'authenticated', user: appUser });
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('authenticated');
    });

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('exposes controller actions and their state transitions', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockResolvedValue(undefined);
    const controller = new AuthenticationController(createGateway({
      signInWithGoogle,
      signOut,
    }));
    const { events } = createSessionEvents();
    render(
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <AuthenticationProbe />
      </AuthenticationProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalledWith('/vehicles/deep-link');
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('initializing');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledOnce();
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
    });
  });

  it('restores through the controller after a recoverable session event', async () => {
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: appUser })
      .mockResolvedValueOnce({ status: 'unauthenticated' });
    const controller = new AuthenticationController(createGateway({ restore }));
    const { emit, events } = createSessionEvents();
    render(
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <AuthenticationProbe />
      </AuthenticationProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('authenticated');
    });

    act(() => {
      emit();
    });

    await waitFor(() => {
      expect(restore).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
    });
  });

  it('retains authenticated content through a session event and browser refocus', async () => {
    const reconciliation = createDeferred<AuthenticationResult>();
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: appUser })
      .mockImplementationOnce(() => reconciliation.promise)
      .mockResolvedValueOnce({ status: 'authenticated', user: appUser });
    const controller = new AuthenticationController(createGateway({ restore }));
    const { emit, events } = createSessionEvents();
    render(
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <AuthenticationProbe />
      </AuthenticationProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('authenticated');
    });

    act(() => {
      emit({ type: 'session_changed' });
    });
    expect(screen.getByLabelText('authentication status')).toHaveTextContent('authenticated');
    reconciliation.resolve({ status: 'authenticated', user: appUser });
    await waitFor(() => {
      expect(restore).toHaveBeenCalledTimes(2);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => {
      expect(restore).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByLabelText('authentication status')).toHaveTextContent('authenticated');
  });

  it('fails closed immediately on an access-lost event without waiting for restoration', async () => {
    const delayedRestore = createDeferred<AuthenticationResult>();
    const cleanup = vi.fn();
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: appUser })
      .mockImplementationOnce(() => delayedRestore.promise);
    const controller = new AuthenticationController(createGateway({ restore }));
    const { emit, events } = createSessionEvents();
    render(
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <AuthenticationProbe />
        <PrivateStateCleanupProbe cleanup={cleanup} />
      </AuthenticationProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('authenticated');
    });

    act(() => {
      emit({ type: 'session_changed' });
    });
    expect(restore).toHaveBeenCalledTimes(2);

    act(() => {
      emit({ type: 'access_lost' });
    });

    await waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
    });
    expect(restore).toHaveBeenCalledTimes(2);

    delayedRestore.resolve({ status: 'authenticated', user: appUser });
    await act(async () => {
      await delayedRestore.promise;
    });
    expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
  });

  it('does not let focus or session reconciliation restore access after access loss', async () => {
    const delayedRestore = createDeferred<AuthenticationResult>();
    const delayedCleanup = createDeferred<undefined>();
    const cleanup = vi.fn(() => delayedCleanup.promise);
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: appUser })
      .mockImplementationOnce(() => delayedRestore.promise);
    const controller = new AuthenticationController(createGateway({ restore }));
    const { emit, events } = createSessionEvents();
    render(
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <AuthenticationProbe />
        <PrivateStateCleanupProbe cleanup={cleanup} />
      </AuthenticationProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('authenticated');
    });

    act(() => {
      emit({ type: 'session_changed' });
      emit({ type: 'access_lost' });
    });
    await waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
    });

    act(() => {
      emit({ type: 'session_changed' });
      window.dispatchEvent(new Event('focus'));
    });

    expect(restore).toHaveBeenCalledTimes(2);
    delayedCleanup.resolve(undefined);
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
    });

    delayedRestore.resolve({ status: 'authenticated', user: appUser });
    await act(async () => {
      await delayedRestore.promise;
    });
    expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
  });

  it('lets a session event supersede a pending startup restore', async () => {
    const startupRestore = createDeferred<AuthenticationResult>();
    const recoveryRestore = createDeferred<AuthenticationResult>();
    const restore = vi.fn()
      .mockImplementationOnce(() => startupRestore.promise)
      .mockImplementationOnce(() => recoveryRestore.promise);
    const controller = new AuthenticationController(createGateway({ restore }));
    const { emit, events } = createSessionEvents();
    render(
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <AuthenticationProbe />
      </AuthenticationProvider>,
    );

    expect(restore).toHaveBeenCalledOnce();

    act(() => {
      emit();
    });
    expect(restore).toHaveBeenCalledTimes(2);

    recoveryRestore.resolve({ status: 'unauthenticated' });
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
    });

    startupRestore.resolve({ status: 'authenticated', user: appUser });
    await act(async () => {
      await startupRestore.promise;
    });

    expect(screen.getByLabelText('authentication status')).toHaveTextContent('unauthenticated');
  });

  it('unsubscribes from session events when unmounted', () => {
    const controller = new AuthenticationController(createGateway());
    const { events, unsubscribe } = createSessionEvents();
    const view = render(
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <AuthenticationProbe />
      </AuthenticationProvider>,
    );

    view.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('registers one active cleanup through StrictMode and unregisters on unmount', async () => {
    const cleanup = vi.fn();
    const restore = vi.fn().mockResolvedValue({
      status: 'authenticated',
      user: appUser,
    });
    const controller = new AuthenticationController(createGateway({ restore }));
    const register = vi.spyOn(controller, 'registerPrivateStateCleanup');
    const { events } = createSessionEvents();
    const view = render(
      <StrictMode>
        <AuthenticationProvider controller={controller} sessionEvents={events}>
          <AuthenticationProbe />
          <PrivateStateCleanupProbe cleanup={cleanup} />
        </AuthenticationProvider>
      </StrictMode>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText('authentication status')).toHaveTextContent(
        'authenticated',
      );
    });

    expect(register).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
      expect(screen.getByLabelText('authentication status')).toHaveTextContent(
        'unauthenticated',
      );
    });

    view.unmount();
    await controller.restoreAuthentication();
    await controller.signOut();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
