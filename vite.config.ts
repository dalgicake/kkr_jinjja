import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    // Tests are hermetic: a developer's .env.local (real Supabase project) must never be used,
    // so the client always runs in its "not connected" mode here. Server tests inject fakes.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
