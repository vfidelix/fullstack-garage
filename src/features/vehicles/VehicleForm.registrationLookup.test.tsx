import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthenticationContext,
  type AuthenticationContextValue,
} from '../../app/providers/authenticationContext';
import type {
  RegistrationLookupInput,
  RegistrationLookupResult,
  VehicleRegistrationSuggestion,
} from '../../domain/vehicles/registrationLookup';
import type { CreateVehicle } from '../../domain/vehicles/vehicle';
import { CloudflareVehicleRegistrationLookup } from '../../infrastructure/cloudflare/CloudflareVehicleRegistrationLookup';
import { VehicleForm } from './VehicleForm';

function authentication(): AuthenticationContextValue {
  const state = {
    status: 'authenticated',
    user: {
      id: 'owner',
      displayName: 'Admin',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  } as const;
  return {
    state,
    completeAuthenticationRedirect: vi.fn(),
    registerPrivateStateCleanup: vi.fn(() => vi.fn()),
    restoreAuthentication: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };
}

function found(
  suggestion: VehicleRegistrationSuggestion,
  ...alternatives: readonly VehicleRegistrationSuggestion[]
): RegistrationLookupResult {
  return { status: 'found', suggestions: [suggestion, ...alternatives] };
}

function renderForm(
  lookup: (input: RegistrationLookupInput) => Promise<RegistrationLookupResult>,
  onSubmit: (input: CreateVehicle) => Promise<void> = vi.fn(),
) {
  render(
    <AuthenticationContext.Provider value={authentication()}>
      <VehicleForm
        lookupRegistration={lookup}
        onSubmit={onSubmit}
        submitLabel="Add Vehicle"
      />
    </AuthenticationContext.Provider>,
  );
}

async function runLookup(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('Registration'), 'ABC 123');
  await user.selectOptions(screen.getByLabelText('Registration state'), 'WA');
  await user.click(screen.getByRole('button', { name: 'Lookup registration' }));
}

async function applyLookup(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await runLookup(user);
  await user.click(await screen.findByRole('button', { name: 'Apply selected Vehicle' }));
}

describe('VehicleForm registration lookup', () => {
  it('keeps manual Vehicle creation available before lookup', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn());
    await user.type(screen.getByLabelText('Make'), 'Ferrari');
    await user.type(screen.getByLabelText('Model'), 'Roma');
    expect(screen.getByRole('button', { name: 'Add Vehicle' })).toBeEnabled();
  });

  it('restores lookup readiness with a safe error after token retrieval rejects', async () => {
    const user = userEvent.setup();
    const lookup = new CloudflareVehicleRegistrationLookup({
      getAccessToken: vi.fn().mockRejectedValue(new Error('private vendor detail')),
    });
    renderForm((input) => lookup.lookup(input));

    await runLookup(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Registration lookup is temporarily unavailable. Manual entry remains available.',
    );
    expect(screen.getByRole('button', { name: 'Lookup registration' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Looking up…' })).not.toBeInTheDocument();
  });

  it('fills all supported fields and locks only provider-filled lockable fields', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn().mockResolvedValue(found({
      make: 'Ferrari',
      model: 'Roma',
      year: '2018-2021',
      engine: 'V8',
      body: 'Coupe',
      registrationState: 'WA',
    })));

    await runLookup(user);
    expect(screen.getByLabelText('Make')).not.toHaveValue('Ferrari');
    await user.click(screen.getByRole('button', { name: 'Apply selected Vehicle' }));

    const lockedInputs = ['Make', 'Model', 'Engine', 'Body'].map((label) => (
      screen.getByLabelText(label)
    ));
    const firstLockedInput = lockedInputs[0];
    if (firstLockedInput === undefined) throw new Error('Expected a locked input.');
    const lockedClass = firstLockedInput.className;
    expect(lockedClass).toContain('lookupLocked');
    for (const input of lockedInputs) {
      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveClass(lockedClass);
    }
    expect(screen.getByLabelText('Year')).toHaveValue('2018-2021');
    expect(screen.getByLabelText('Year')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Year')).not.toHaveClass(lockedClass);
    expect(screen.getByLabelText('Body')).toHaveValue('Coupe');
    expect(screen.getByLabelText('Notes')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Notes')).not.toHaveClass(lockedClass);
  });

  it('does not lock or replace lockable fields absent from the suggestion', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn().mockResolvedValue(found({
      make: 'Ferrari',
      year: '2021',
      registrationState: 'WA',
    })));
    await user.type(screen.getByLabelText('Model'), 'Manual model');
    await user.type(screen.getByLabelText('Engine'), 'Manual engine');
    await user.type(screen.getByLabelText('Body'), 'Manual body');

    await applyLookup(user);

    expect(screen.getByLabelText('Make')).toHaveAttribute('readonly');
    for (const [label, value] of [
      ['Model', 'Manual model'],
      ['Engine', 'Manual engine'],
      ['Body', 'Manual body'],
    ] as const) {
      expect(screen.getByLabelText(label)).toHaveValue(value);
      expect(screen.getByLabelText(label)).not.toHaveAttribute('readonly');
      expect(screen.getByLabelText(label).className).not.toContain('lookupLocked');
    }
  });

  it('accepts an untouched provider Year range and submits it as text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(vi.fn().mockResolvedValue(found({
      make: 'Ferrari',
      model: 'Roma',
      year: '2018-2021',
      body: 'Coupe',
      registrationState: 'WA',
    })), onSubmit);

    await applyLookup(user);
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        year: '2018-2021',
        body: 'Coupe',
      }));
    });
  });

  it('switches provider Year permanently to strict manual validation on first edit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(vi.fn().mockResolvedValue(found({
      make: 'Ferrari',
      model: 'Roma',
      year: '2018-2021',
      registrationState: 'WA',
    })), onSubmit);

    await applyLookup(user);
    const year = screen.getByLabelText('Year');
    await user.type(year, 'x');
    await user.clear(year);
    await user.type(year, '2018-2021');
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('Year must be exactly four digits from 1900 to 9999.'))
      .toBeVisible();

    await user.clear(year);
    await user.type(year, '2026');
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ year: '2026' }));
    });
  });

  it('does not bypass manual Year validation when the applied suggestion has no Year', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(vi.fn().mockResolvedValue(found({
      make: 'Ferrari',
      model: 'Roma',
      registrationState: 'WA',
    })), onSubmit);
    await user.type(screen.getByLabelText('Year'), '2018-2021');

    await applyLookup(user);
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('Year must be exactly four digits from 1900 to 9999.'))
      .toBeVisible();
  });

  it.each([
    ['', 'Detailed vehicle description', 'Detailed vehicle description'],
    [
      'Garage note',
      '  Detailed vehicle description  ',
      'Garage note\n\nDetailed vehicle description',
    ],
    [
      'Garage note with DETAILED VEHICLE DESCRIPTION already present',
      'detailed vehicle description',
      'Garage note with DETAILED VEHICLE DESCRIPTION already present',
    ],
    ['Garage note', '   ', 'Garage note'],
  ])(
    'applies detailed description without rewriting or duplicating existing Notes',
    async (initialNotes, detailedDescription, expectedNotes) => {
      const user = userEvent.setup();
      renderForm(vi.fn().mockResolvedValue(found({
        make: 'Ferrari',
        model: 'Roma',
        detailedDescription,
        registrationState: 'WA',
      })));
      if (initialNotes !== '') await user.type(screen.getByLabelText('Notes'), initialNotes);

      await applyLookup(user);

      expect(screen.getByLabelText('Notes')).toHaveValue(expectedNotes);
      expect(screen.getByLabelText('Notes')).not.toHaveAttribute('readonly');
    },
  );

  it('does not duplicate detailed description when the same lookup is applied repeatedly', async () => {
    const user = userEvent.setup();
    const lookup = vi.fn().mockResolvedValue(found({
      make: 'Ferrari',
      model: 'Roma',
      detailedDescription: 'Original paint',
      registrationState: 'WA',
    }));
    renderForm(lookup);

    await applyLookup(user);
    expect(screen.getByLabelText('Notes')).toHaveValue('Original paint');
    await user.click(screen.getByRole('button', { name: 'Clear recommendation' }));
    await user.click(screen.getByRole('button', { name: 'Lookup registration' }));
    await user.click(await screen.findByRole('button', { name: 'Apply selected Vehicle' }));

    expect(screen.getByLabelText('Notes')).toHaveValue('Original paint');
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('restores the complete manual snapshot, unlocks fields, and preserves edited Notes', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const user = userEvent.setup();
    try {
      renderForm(vi.fn().mockResolvedValue(found({
        make: 'Ferrari',
        model: 'Roma',
        year: '2018-2021',
        engine: 'V8',
        body: 'Coupe',
        detailedDescription: 'Provider description',
        registrationState: 'WA',
      })));
      const manualValues = {
        Make: 'Manual make',
        Model: 'Manual model',
        Year: '2020',
        Engine: 'Manual engine',
        Body: 'Manual body',
      } as const;
      for (const [label, value] of Object.entries(manualValues)) {
        await user.type(screen.getByLabelText(label), value);
      }
      await user.type(screen.getByLabelText('Notes'), 'Manual notes');

      await applyLookup(user);
      const notes = screen.getByLabelText('Notes');
      await user.clear(notes);
      await user.type(notes, '  User kept notes  {enter}{enter}Second line');
      const editedNotes = '  User kept notes  \n\nSecond line';
      expect(notes).toHaveValue(editedNotes);
      await user.click(screen.getByRole('button', { name: 'Clear recommendation' }));

      for (const [label, value] of Object.entries(manualValues)) {
        expect(screen.getByLabelText(label)).toHaveValue(value);
        expect(screen.getByLabelText(label)).not.toHaveAttribute('readonly');
        expect(screen.getByLabelText(label).className).not.toContain('lookupLocked');
      }
      expect(notes).toHaveValue(editedNotes);
      expect(notes).not.toHaveAttribute('readonly');
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('invalidates lookup on registration change while preserving current Notes', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const user = userEvent.setup();
    try {
      renderForm(vi.fn().mockResolvedValue(found({
        make: 'Ferrari',
        model: 'Roma',
        body: 'Coupe',
        detailedDescription: 'Provider description',
        registrationState: 'WA',
      })));
      await user.type(screen.getByLabelText('Make'), 'Manual make');
      await user.type(screen.getByLabelText('Model'), 'Manual model');
      await user.type(screen.getByLabelText('Body'), 'Manual body');
      await applyLookup(user);
      await user.type(screen.getByLabelText('Notes'), ' plus user edit');
      const notesBeforeInvalidation = 'Provider description plus user edit';

      await user.type(screen.getByLabelText('Registration'), '9');

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Clear recommendation' }))
          .not.toBeInTheDocument();
      });
      expect(screen.getByLabelText('Make')).toHaveValue('Manual make');
      expect(screen.getByLabelText('Model')).toHaveValue('Manual model');
      expect(screen.getByLabelText('Body')).toHaveValue('Manual body');
      expect(screen.getByLabelText('Notes')).toHaveValue(notesBeforeInvalidation);
      expect(screen.getByLabelText('Make')).not.toHaveAttribute('readonly');
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('distinguishes Body-only alternatives and applies only the selected suggestion', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn().mockResolvedValue(found(
      {
        make: 'Ferrari',
        model: 'Roma',
        year: '2026',
        engine: 'V8',
        body: 'Coupe',
        registrationState: 'WA',
      },
      {
        make: 'Ferrari',
        model: 'Roma',
        year: '2026',
        engine: 'V8',
        body: 'Convertible',
        registrationState: 'WA',
      },
    )));

    await runLookup(user);
    const coupeLabel = '2026 · Ferrari · Roma · V8 · Coupe';
    const convertibleLabel = '2026 · Ferrari · Roma · V8 · Convertible';
    expect(screen.getByText(coupeLabel)).toBeVisible();
    expect(screen.getByText(convertibleLabel)).toBeVisible();
    expect(screen.getByRole('radio', { name: coupeLabel })).toBeChecked();
    expect(screen.getByLabelText('Make')).toHaveValue('');
    await user.click(screen.getByRole('radio', { name: convertibleLabel }));
    await user.click(screen.getByRole('button', { name: 'Apply selected Vehicle' }));

    expect(screen.getByLabelText('Model')).toHaveValue('Roma');
    expect(screen.getByLabelText('Body')).toHaveValue('Convertible');
  });

  it('ignores a late result after the lookup inputs change', async () => {
    const user = userEvent.setup();
    let resolveLookup: ((value: RegistrationLookupResult) => void) | undefined;
    const lookup = vi.fn(() => new Promise<RegistrationLookupResult>((resolve) => {
      resolveLookup = resolve;
    }));
    renderForm(lookup);
    await runLookup(user);
    await user.clear(screen.getByLabelText('Registration'));
    await user.type(screen.getByLabelText('Registration'), 'XYZ 456');
    resolveLookup?.(found({ make: 'Ferrari', model: 'Roma', registrationState: 'WA' }));
    expect(await screen.findByLabelText('Make')).not.toHaveValue('Ferrari');
    expect(screen.queryByRole('button', { name: 'Apply selected Vehicle' }))
      .not.toBeInTheDocument();
  });
});
