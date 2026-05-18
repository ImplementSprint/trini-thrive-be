# Project File Structure — trini-thrive-be

```
trini-thrive-be/
├── .dockerignore
├── .env
├── .gitignore
├── .prettierrc
├── .trivyignore
├── CICD_COMPLIANCE_HISTORY.md
├── CICD_MIGRATION_PLAN.html
├── Dockerfile
├── eslint.config.mjs
├── FILE_STRUCTURE.md
├── nest-cli.json
├── package.json
├── package-lock.json
├── README.md
├── render-build.sh
├── sonar-project.properties
├── START_HERE_BACKEND.md
├── tribe-manifest.json
├── tribe-sdk-consumption.md
├── TRIBE_API_INTEGRATION.md
├── TRINI_THRIVE_BE_REMEDIATION_PLAN.html
├── tsconfig.json
├── tsconfig.build.json
│
├── scripts/
│   └── show-dummy-account.cjs
│
├── tests/
│   ├── e2e/
│   │   ├── app.e2e-spec.ts
│   │   └── jest-e2e.json
│   └── performance/
│       ├── smoke.js
│       └── README.md
│
└── src/                                  # Consolidated NestJS application
    ├── main.ts
    ├── app.controller.ts
    ├── app.controller.spec.ts
    ├── app.module.ts
    ├── app.service.ts
    ├── app.service.spec.ts
    ├── declarations.d.ts
    │
    ├── __mocks__/
    │   └── @apicenter/
    │       └── sdk.ts
    │
    ├── admin-auth/                       # Admin JWT auth
    │   ├── auth.controller.ts
    │   ├── auth.module.ts
    │   ├── auth.service.ts
    │   ├── jwt.guard.ts
    │   └── protected.decorator.ts
    │
    ├── admin-beneficiary/                # Admin-side beneficiary & campaign management
    │   ├── beneficiaries.controller.ts
    │   ├── beneficiaries.module.ts
    │   ├── beneficiaries.service.ts
    │   ├── campaigns.controller.ts
    │   └── campaigns.service.ts
    │
    ├── analytics/                        # Dashboard & activity analytics
    │   ├── analytics.module.ts
    │   ├── activity.controller.ts
    │   ├── activity.module.ts
    │   ├── activity.service.ts
    │   ├── dashboard.controller.ts
    │   ├── dashboard.module.ts
    │   ├── dashboard.service.ts
    │   └── interfaces/
    │       └── dashboard-metrics.interface.ts
    │
    ├── api-center/                       # APICenter / Tribe SDK integration
    │   ├── api-center-sdk.module.ts
    │   └── tribe-registration.service.ts
    │
    ├── approvals/                        # Approval workflows (beneficiary, CM, donor)
    │   ├── approvals.module.ts
    │   ├── beneficiary-approvals.controller.ts
    │   ├── beneficiary-approvals.service.ts
    │   ├── campaign-manager-approvals.controller.ts
    │   ├── campaign-manager-approvals.service.ts
    │   ├── digital-donor-approvals.controller.ts
    │   └── digital-donor-approvals.service.ts
    │
    ├── beneficiary-auth/                 # Beneficiary authentication & password reset
    │   ├── auth.controller.ts
    │   ├── auth.controller.spec.ts
    │   ├── auth.module.ts
    │   ├── auth.service.ts
    │   ├── auth.service.spec.ts
    │   └── dto/
    │       ├── forgot-password.dto.ts
    │       ├── reset-password.dto.ts
    │       └── verify-reset-otp.dto.ts
    │
    ├── beneficiary-health/               # Beneficiary service health check
    │   ├── health.controller.ts
    │   ├── health.controller.spec.ts
    │   ├── health.module.ts
    │   ├── health.service.ts
    │   └── health.service.spec.ts
    │
    ├── campaigns/                        # Donor-facing campaign browsing
    │   ├── campaigns.controller.ts
    │   ├── campaigns.module.ts
    │   └── campaigns.service.ts
    │
    ├── campaign-service/                 # Campaign creation & management (CM-facing)
    │   ├── campaigns.controller.ts
    │   ├── campaigns.controller.spec.ts
    │   ├── campaigns.module.ts
    │   ├── campaigns.service.ts
    │   ├── campaigns.service.spec.ts
    │   ├── dto/
    │   │   └── create-campaign.dto.ts
    │   └── entities/
    │       └── campaign.entity.ts
    │
    ├── cart/                             # Donor cart
    │   ├── cart.controller.ts
    │   ├── cart.module.ts
    │   └── cart.service.ts
    │
    ├── cm-auth/                          # Campaign manager authentication
    │   ├── auth.controller.ts
    │   ├── auth.controller.spec.ts
    │   ├── auth.module.ts
    │   ├── auth.service.ts
    │   └── auth.service.spec.ts
    │
    ├── common/                           # Shared utilities, guards, config
    │   ├── activity-logger.ts
    │   ├── email.ts
    │   ├── storage.ts
    │   ├── supabase-client.ts
    │   ├── supabase-helpers.ts
    │   ├── types.ts
    │   ├── config/
    │   │   ├── env.validation.ts
    │   │   ├── env.validation.spec.ts
    │   │   ├── security.config.ts
    │   │   └── security.config.spec.ts
    │   ├── decorators/
    │   │   └── protected.decorator.ts
    │   ├── filters/
    │   │   ├── all-exceptions.filter.ts
    │   │   └── all-exceptions.filter.spec.ts
    │   ├── guards/
    │   │   └── jwt.guard.ts
    │   └── middleware/
    │       ├── correlation-id.middleware.ts
    │       └── correlation-id.middleware.spec.ts
    │
    ├── donor-auth/                       # Digital donor authentication
    │   ├── auth.controller.ts
    │   ├── auth.module.ts
    │   └── auth.service.ts
    │
    ├── gateway/                          # API gateway module
    │   └── gateway.module.ts
    │
    ├── health/                           # Top-level service health check
    │   ├── health.controller.ts
    │   ├── health.controller.spec.ts
    │   ├── health.module.ts
    │   ├── health.service.ts
    │   └── health.service.spec.ts
    │
    ├── notification-service/             # Email / notification dispatch
    │   ├── notifications.controller.ts
    │   ├── notifications.controller.spec.ts
    │   ├── notifications.module.ts
    │   ├── notifications.service.ts
    │   └── notifications.service.spec.ts
    │
    ├── profile/                          # User profile management
    │   ├── profile.controller.ts
    │   ├── profile.module.ts
    │   └── profile.service.ts
    │
    ├── purchases/                        # Donor purchases
    │   ├── purchases.controller.ts
    │   ├── purchases.module.ts
    │   └── purchases.service.ts
    │
    ├── reporting-service/                # Reporting & metrics
    │   ├── reporting.controller.ts
    │   ├── reporting.controller.spec.ts
    │   ├── reporting.module.ts
    │   ├── reporting.service.ts
    │   └── reporting.service.spec.ts
    │
    └── supabase/                         # Shared Supabase client service
        ├── supabase.module.ts
        └── supabase.service.ts
```
