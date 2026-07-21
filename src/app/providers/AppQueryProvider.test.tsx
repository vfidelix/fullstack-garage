import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import mainSource from '../../main.tsx?raw';
import { createAppQueryClient } from '../queryClientComposition';
import { AppQueryProvider } from './AppQueryProvider';

function QueryClientProbe({ expectedClient }: {
  readonly expectedClient: ReturnType<typeof createAppQueryClient>;
}) {
  const client = useQueryClient();

  return (
    <output aria-label="query client">
      {client === expectedClient ? 'injected client' : 'unexpected client'}
    </output>
  );
}

describe('AppQueryProvider', () => {
  it('provides an explicitly constructed query client', () => {
    const client = createAppQueryClient();

    render(
      <AppQueryProvider client={client}>
        <QueryClientProbe expectedClient={client} />
      </AppQueryProvider>,
    );

    expect(screen.getByLabelText('query client')).toHaveTextContent(
      'injected client',
    );
  });

  it('keeps the vendor provider in one app-level module', () => {
    const productionSources = import.meta.glob<string>(
      ['../**/*.ts', '../**/*.tsx'],
      { eager: true, import: 'default', query: '?raw' },
    );
    const providerSites = Object.entries(productionSources)
      .filter(([path]) => !path.includes('.test.'))
      .filter(([, source]) => source.includes('<QueryClientProvider'))
      .map(([path]) => path);

    expect(providerSites).toHaveLength(1);
    expect(providerSites[0]).toMatch(/AppQueryProvider\.tsx$/u);
  });

  it('mounts the app query provider once at the composition root', () => {
    expect(mainSource.match(/<AppQueryProvider>/gu)).toHaveLength(1);
  });
});
