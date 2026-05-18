// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'apps/hopecard-admin-service/src/analytics/**',
      'apps/hopecard-admin-service/src/approvals/**',
      'apps/hopecard-admin-service/src/auth/**',
      'apps/hopecard-admin-service/src/beneficiary-management/**',
      'apps/hopecard-beneficiary-service/src/auth/**',
      'apps/hopecard-beneficiary-service/src/beneficiary-health/**',
      'apps/hopecard-campaign-manager-service/src/auth/**',
      'apps/hopecard-campaign-manager-service/src/campaigns/**',
      'apps/hopecard-campaign-manager-service/src/reporting/**',
      'apps/hopecard-donor-service/src/auth/**',
      'apps/hopecard-donor-service/src/campaigns/**',
      'apps/hopecard-donor-service/src/cart/**',
      'apps/hopecard-donor-service/src/profile/**',
      'apps/hopecard-donor-service/src/purchases/**',
      'apps/hopecard-notification-service/src/notifications/**',
      'libs/common/src/activity-logger.ts',
      'libs/common/src/decorators/protected.decorator.ts',
      'libs/common/src/email.ts',
      'libs/common/src/gateway/**',
      'libs/common/src/guards/jwt.guard.ts',
      'libs/common/src/storage.ts',
      'libs/common/src/supabase-client.ts',
      'libs/common/src/supabase-helpers.ts',
      'libs/common/src/types.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['tests/performance/*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
