import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from '@cloudflare/vite-plugin';
import {
  assertOnlyApprovedPublicEnvironment,
  removeLocalDevelopmentSecretsFromBuildOutput,
} from './viteEnvironmentGuard';

export default defineConfig(({ mode }) => {
  const fileEnvironment = loadEnv(mode, process.cwd(), 'VITE_');

  assertOnlyApprovedPublicEnvironment({
    ...fileEnvironment,
    ...process.env,
  });

  return {
    plugins: [
      react(),
      cloudflare(),
      {
        name: 'exclude-local-development-secrets-from-build',
        apply: 'build',
        enforce: 'post',
        generateBundle: (_, bundle) => {
          removeLocalDevelopmentSecretsFromBuildOutput(bundle);
        },
      },
    ],
  };
});
