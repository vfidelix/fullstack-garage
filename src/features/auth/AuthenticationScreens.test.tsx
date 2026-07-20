import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AccessUnavailableScreen,
  AuthenticationErrorScreen,
  AuthenticationLoadingScreen,
  SignInScreen,
} from './AuthenticationScreens';

describe('AuthenticationScreens', () => {
  it('announces loading without exposing protected content', () => {
    render(<AuthenticationLoadingScreen />);

    const status = screen.getByRole('status', { name: 'Loading Fullstack Garage' });

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Restoring Garage Admin session');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('offers Google as the single sign-in option with native button semantics', () => {
    const onSignIn = vi.fn();
    render(<SignInScreen onSignIn={onSignIn} />);

    const button = screen.getByRole('button', { name: 'Continue with Google' });

    expect(screen.getByText(
      'A precise record of every Vehicle and every Service Record.',
    )).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(button).toHaveAttribute('type', 'button');
    expect(screen.queryByText(/register|password|sign up/iu)).not.toBeInTheDocument();

    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('explains Garage Admin authorization and provides local sign-out', () => {
    const onSignOut = vi.fn();
    render(<AccessUnavailableScreen onSignOut={onSignOut} />);

    expect(screen.getByRole('heading', { name: 'Access unavailable' })).toBeVisible();
    expect(screen.getByText(/Garage Admin access/u)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('renders only app-owned safe error copy and a retry action', () => {
    const onRetry = vi.fn();
    render(
      <AuthenticationErrorScreen
        category="invalid_callback"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The sign-in link is invalid or has expired. Please try again.',
    );
    expect(screen.queryByText(/provider|token|callback query/iu)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
