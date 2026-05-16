# Project File Structure — trini-thrive-be

```
trini-thrive-be/
├── .dockerignore
├── .env.example
├── .prettierrc
├── .trivyignore
├── Dockerfile
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── sonar-project.properties
├── START_HERE_BACKEND.md
│
├── scripts/
│   └── show-dummy-account.cjs
│
├── src/                                  # Root NestJS application
│   ├── main.ts
│   ├── app.controller.ts
│   ├── app.controller.spec.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   ├── app.service.spec.ts
│   │
│   ├── api-center/
│   │   ├── api-center-sdk.module.ts
│   │   └── tribe-registration.service.ts
│   │
│   ├── common/
│   │   ├── config/
│   │   │   ├── env.validation.ts
│   │   │   ├── env.validation.spec.ts
│   │   │   ├── security.config.ts
│   │   │   └── security.config.spec.ts
│   │   ├── filters/
│   │   │   ├── all-exceptions.filter.ts
│   │   │   └── all-exceptions.filter.spec.ts
│   │   └── middleware/
│   │       ├── correlation-id.middleware.ts
│   │       └── correlation-id.middleware.spec.ts
│   │
│   ├── database/
│   │   └── seeds/
│   │       └── dummy-users.json
│   │
│   ├── health/
│   │   ├── health.controller.ts
│   │   ├── health.controller.spec.ts
│   │   ├── health.module.ts
│   │   ├── health.service.ts
│   │   └── health.service.spec.ts
│   │
│   ├── location/
│   │   ├── location.controller.ts
│   │   ├── location.controller.spec.ts
│   │   ├── location.module.ts
│   │   └── location.service.ts
│   │
│   └── supabase/
│       ├── supabase.module.ts
│       ├── supabase.service.ts
│       └── supabase.service.spec.ts
│
├── tests/
│   └── e2e/
│       ├── app.e2e-spec.ts
│       └── jest-e2e.json
│
└── hopecard/                             # Persona-specific microservice backends
    │
    ├── admin/
    │   ├── eslint.config.mjs
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── sonar-project.properties
    │   │
    │   ├── shared/
    │   │   ├── activity-logger.ts
    │   │   ├── constants.ts
    │   │   ├── email.ts
    │   │   ├── http-exception.filter.ts
    │   │   ├── jwt.guard.ts
    │   │   ├── port-finder.ts
    │   │   ├── protected.decorator.ts
    │   │   └── supabaseClient.ts
    │   │
    │   └── services/
    │       ├── analytics/src/
    │       │   ├── main.ts
    │       │   ├── analytics.module.ts
    │       │   ├── activity.controller.ts
    │       │   ├── activity.module.ts
    │       │   ├── activity.service.ts
    │       │   ├── dashboard.controller.ts
    │       │   ├── dashboard.module.ts
    │       │   ├── dashboard.service.ts
    │       │   └── interfaces/
    │       │       └── dashboard-metrics.interface.ts
    │       ├── approvals/src/
    │       │   ├── main.ts
    │       │   ├── approvals.module.ts
    │       │   ├── beneficiary-approvals.controller.ts
    │       │   ├── beneficiary-approvals.service.ts
    │       │   ├── campaign-manager-approvals.controller.ts
    │       │   ├── campaign-manager-approvals.service.ts
    │       │   ├── digital-donor-approvals.controller.ts
    │       │   └── digital-donor-approvals.service.ts
    │       ├── auth/src/
    │       │   ├── main.ts
    │       │   ├── auth.controller.ts
    │       │   ├── auth.module.ts
    │       │   ├── auth.service.ts
    │       │   ├── jwt.guard.ts
    │       │   └── protected.decorator.ts
    │       ├── beneficiary/src/
    │       │   ├── main.ts
    │       │   ├── beneficiaries.controller.ts
    │       │   ├── beneficiaries.module.ts
    │       │   ├── beneficiaries.service.ts
    │       │   ├── campaigns.controller.ts
    │       │   └── campaigns.service.ts
    │       └── gateway/src/
    │           └── main.ts
    │
    ├── beneficiary/
    │   ├── eslint.config.mjs
    │   ├── nest-cli.json
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── sonar-project.properties
    │   │
    │   ├── src/
    │   │   ├── api-gateway/
    │   │   │   ├── main.ts
    │   │   │   ├── api-gateway.controller.ts
    │   │   │   ├── api-gateway.controller.spec.ts
    │   │   │   ├── api-gateway.module.ts
    │   │   │   ├── api-gateway.service.ts
    │   │   │   └── api-gateway.service.spec.ts
    │   │   ├── auth/
    │   │   │   ├── auth.controller.ts
    │   │   │   ├── auth.controller.spec.ts
    │   │   │   ├── auth.module.ts
    │   │   │   ├── auth.service.ts
    │   │   │   ├── auth.service.spec.ts
    │   │   │   └── dto/
    │   │   │       ├── forgot-password.dto.ts
    │   │   │       ├── reset-password.dto.ts
    │   │   │       └── verify-reset-otp.dto.ts
    │   │   ├── health-service/
    │   │   │   ├── main.ts
    │   │   │   ├── health.controller.ts
    │   │   │   ├── health.controller.spec.ts
    │   │   │   ├── health.module.ts
    │   │   │   ├── health.service.ts
    │   │   │   └── health.service.spec.ts
    │   │   └── shared/
    │   │       └── tokens.ts
    │   │
    │   └── test/
    │       ├── api-gateway.e2e-spec.ts
    │       └── jest-e2e.json
    │
    ├── campaign-manager/
    │   ├── sonar-project.properties
    │   │
    │   └── services/
    │       ├── auth-service/
    │       │   ├── eslint.config.mjs
    │       │   ├── nest-cli.json
    │       │   ├── package.json
    │       │   ├── tsconfig.json
    │       │   ├── src/
    │       │   │   ├── main.ts
    │       │   │   ├── app.controller.ts
    │       │   │   ├── app.controller.spec.ts
    │       │   │   ├── app.module.ts
    │       │   │   ├── app.service.ts
    │       │   │   └── auth/
    │       │   │       ├── auth.controller.ts
    │       │   │       ├── auth.controller.spec.ts
    │       │   │       ├── auth.module.ts
    │       │   │       ├── auth.service.ts
    │       │   │       └── auth.service.spec.ts
    │       │   └── test/
    │       │       ├── app.e2e-spec.ts
    │       │       └── jest-e2e.json
    │       ├── campaign-service/
    │       │   ├── eslint.config.mjs
    │       │   ├── nest-cli.json
    │       │   ├── package.json
    │       │   ├── tsconfig.json
    │       │   └── src/
    │       │       ├── main.ts
    │       │       ├── app.controller.ts
    │       │       ├── app.controller.spec.ts
    │       │       ├── app.module.ts
    │       │       └── campaigns/
    │       │           ├── campaigns.controller.ts
    │       │           ├── campaigns.controller.spec.ts
    │       │           ├── campaigns.module.ts
    │       │           ├── campaigns.service.ts
    │       │           ├── campaigns.service.spec.ts
    │       │           ├── dto/
    │       │           │   └── create-campaign.dto.ts
    │       │           └── entities/
    │       │               └── campaign.entity.ts
    │       ├── notification-service/
    │       │   ├── eslint.config.mjs
    │       │   ├── nest-cli.json
    │       │   ├── package.json
    │       │   ├── tsconfig.json
    │       │   ├── src/
    │       │   │   ├── main.ts
    │       │   │   ├── app.controller.ts
    │       │   │   ├── app.controller.spec.ts
    │       │   │   ├── app.module.ts
    │       │   │   ├── app.service.ts
    │       │   │   └── notifications/
    │       │   │       ├── notifications.controller.ts
    │       │   │       ├── notifications.controller.spec.ts
    │       │   │       ├── notifications.module.ts
    │       │   │       ├── notifications.service.ts
    │       │   │       └── notifications.service.spec.ts
    │       │   └── test/
    │       │       ├── app.e2e-spec.ts
    │       │       └── jest-e2e.json
    │       └── reporting-service/
    │           ├── eslint.config.mjs
    │           ├── nest-cli.json
    │           ├── package.json
    │           ├── tsconfig.json
    │           ├── src/
    │           │   ├── main.ts
    │           │   ├── app.controller.ts
    │           │   ├── app.controller.spec.ts
    │           │   ├── app.module.ts
    │           │   ├── app.service.ts
    │           │   └── reporting/
    │           │       ├── reporting.controller.ts
    │           │       ├── reporting.controller.spec.ts
    │           │       ├── reporting.module.ts
    │           │       ├── reporting.service.ts
    │           │       └── reporting.service.spec.ts
    │           └── test/
    │               ├── app.e2e-spec.ts
    │               └── jest-e2e.json
    │
    └── digital-donor/
        ├── eslint.config.mjs
        ├── package.json
        ├── tsconfig.json
        ├── sonar-project.properties
        │
        ├── shared/
        │   ├── constants.ts
        │   ├── http-exception.filter.ts
        │   ├── load-env.ts
        │   ├── port-finder.ts
        │   ├── storage.ts
        │   ├── supabase.ts
        │   └── types.ts
        │
        └── services/
            ├── auth/src/
            │   ├── main.ts
            │   ├── auth.controller.ts
            │   ├── auth.module.ts
            │   └── auth.service.ts
            ├── campaigns/src/
            │   ├── main.ts
            │   ├── campaigns.controller.ts
            │   ├── campaigns.module.ts
            │   └── campaigns.service.ts
            ├── cart/src/
            │   ├── main.ts
            │   ├── cart.controller.ts
            │   ├── cart.module.ts
            │   └── cart.service.ts
            ├── gateway/src/
            │   └── main.ts
            ├── profile/src/
            │   ├── main.ts
            │   ├── profile.controller.ts
            │   ├── profile.module.ts
            │   └── profile.service.ts
            └── purchases/src/
                ├── main.ts
                ├── purchases.controller.ts
                ├── purchases.module.ts
                └── purchases.service.ts
```
