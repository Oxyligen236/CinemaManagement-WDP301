import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'lib/**/*.ts',
        'components/ui/**/*.tsx',
        'components/auth/**/*.tsx',
        'components/orders/OrderStatusBadge.tsx',
        'components/admin/promotions/PromotionStatsCards.tsx',
        'components/admin/promotions/PromotionFilterBar.tsx',
        'components/admin/promotions/PromotionDeactivateDialog.tsx',
        'app/admin/films/api.ts',
        'app/admin/films/components/DeactivateFilmDialog.tsx',
        'app/admin/price-multipliers/api.ts',
        'app/admin/price-multipliers/components/ErrorBanner.tsx',
        'app/admin/price-multipliers/components/Toast.tsx',
        'app/admin/price-multipliers/components/PriceFieldSkeleton.tsx',
        'app/admin/price-multipliers/components/DeletePriceValueDialog.tsx',
        'app/manager/showtimes/api.ts',
        'app/manager/showtimes/components/dialogFocus.ts',
        'app/manager/showtimes/components/PriceMultiplierFields.tsx',
        'app/manager/staff/_lib/staff-api.ts',
        'app/manager/staff/_lib/feedback.tsx',
        'app/showtimes/components/**/*.tsx',
      ],
      exclude: [
        'lib/types/**/*.ts',
        '**/*.d.ts',
        '**/*.{test,spec}.{ts,tsx}',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
