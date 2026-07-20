import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationContext } from './app/providers/authenticationContext';
import type { AuthenticationContextValue } from './app/providers/authenticationContext';
import type { AppUser } from './domain/users/appUser';
import { App } from './App';

const appUser: AppUser = {
  id: '2dc6ce1b-03a9-4c79-a658-0459528a4d4c',
  displayName: 'Garage Operator',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

describe('App', () => {
  it('renders the protected dashboard for an authenticated user', () => {
    const state = { status: 'authenticated', user: appUser } as const;
    const authentication: AuthenticationContextValue = {
      state,
      completeAuthenticationRedirect: vi.fn().mockResolvedValue(state),
      registerPrivateStateCleanup: vi.fn(() => vi.fn()),
      restoreAuthentication: vi.fn().mockResolvedValue(state),
      signInWithGoogle: vi.fn().mockResolvedValue(state),
      signOut: vi.fn().mockResolvedValue({ status: 'unauthenticated' }),
    };

    render(
      <AuthenticationContext.Provider value={authentication}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      </AuthenticationContext.Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
