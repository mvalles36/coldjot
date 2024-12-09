<!-- https://vite.dev/guide/env-and-mode#env-files -->
<!-- https://nextjs.org/docs/app/building-your-application/configuring/environment-variables#environment-variable-load-order -->
<!-- https://turbo.build/repo/docs/crafting-your-repository/using-environment-variables -->
<!-- https://turbo.build/repo/docs/crafting-your-repository/configuring-tasks -->
<!-- https://github.com/vercel/turborepo/discussions/9458#extension -->

# Environment Variables in Turborepo: A Complete Guide

This guide explains how to effectively manage environment variables across different apps and packages in a Turborepo monorepo, with specific focus on Next.js applications.

## Understanding Load Order

Environment variables in Next.js follow this specific load order (from highest priority to lowest):

1. `process.env` - System environment variables
2. `.env.$(NODE_ENV).local` - Local environment overrides (e.g., `.env.development.local`, `.env.production.local`)
3. `.env.local` - Local environment overrides (not loaded in test environment)
4. `.env.$(NODE_ENV)` - Environment-specific variables (e.g., `.env.development`, `.env.production`)
5. `.env` - Default environment variables

Note: Files with `.local` in the name are gitignored and meant for local development only.

## Project Structure

For a typical turborepo with multiple apps (web, queue) and packages (database), here's the recommended structure:

### Web Application (`apps/web/`)

```
apps/web/
├── .env                    # Base defaults (committed)
├── .env.local             # Local overrides (not committed)
├── .env.development       # Development defaults (committed)
├── .env.development.local # Development overrides (not committed)
├── .env.production        # Production defaults (committed)
├── .env.production.local  # Production overrides (not committed)
└── .env.example          # Example template (committed)
```

### Queue Service (`apps/queue/`)

```
apps/queue/
├── .env
├── .env.local
├── .env.development
├── .env.development.local
├── .env.production
├── .env.production.local
└── .env.example
```

### Database Package (`packages/database/`)

```
packages/database/
├── .env
├── .env.local
├── .env.development
├── .env.development.local
├── .env.production
├── .env.production.local
└── .env.example
```

## Git Configuration

Your `.gitignore` should be configured to:

- Ignore all local and production environment files
- Keep example and development configuration files

```gitignore
# Environment variables
.env.local
.env.*.local
.env.production
**/env/.env.*
!**/env/.env.*.example

# Keep env examples
!.env.example
!apps/*/.env.example
!packages/*/.env.example
!apps/*/.env.development
!packages/*/.env.development
```

## Usage Workflows

### Development Flow

- Run `turbo dev` to use development configuration
- Variables load in this order (from highest to lowest priority):
  1. System environment variables (`process.env`)
  2. `.env.development.local`
  3. `.env.local`
  4. `.env.development`
  5. `.env`

### Production Flow

- Run `turbo build` for production builds
- Variables load in this order (from highest to lowest priority):
  1. System environment variables (`process.env`)
  2. `.env.production.local`
  3. `.env.local`
  4. `.env.production`
  5. `.env`
- Manage production secrets in your deployment platform

### Local Development

- Create `.env.local` files for local overrides
- These files are git-ignored
- Perfect for developer-specific settings

### Sharing Settings

- Use `.env.example` files as templates
- Keep shareable defaults in `.env.development`
- Document required variables

## Best Practices

1. **Version Control**

   - Never commit sensitive information
   - Always use `.env.example` files
   - Commit development defaults when safe

2. **Organization**

   - Keep environment-specific variables separate
   - Use clear naming conventions
   - Group related variables with comments

3. **Security**
   - Store secrets in `.env.local` or deployment platform
   - Never commit API keys or secrets
   - Use different values for different environments

## Accessing Variables

- Next.js apps: `process.env.VARIABLE_NAME`
- Node.js packages: `process.env.VARIABLE_NAME`

## Running Different Environments

Configure your `package.json` scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "start": "turbo run start",
    "test": "turbo run test"
  }
}
```

Each workspace can then access its own environment variables using their respective methods, maintaining isolation and clarity across your monorepo.
