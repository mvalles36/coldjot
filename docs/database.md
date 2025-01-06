# Database Commands

This document outlines the available database commands and their usage in different environments.

## Environment Setup

The database package uses environment-specific configuration files located in `packages/database/env/`:

```
packages/database/env/
├── .env.development    # Development environment
├── .env.staging       # Staging environment
└── .env.production    # Production environment
```

## Available Commands

### Development Commands

These commands are for local development only:

```bash
# Create and apply a new migration (interactive)
turbo run db:migrate --filter=@coldjot/database

# Create a migration without applying it
turbo run db:migrate:create --filter=@coldjot/database

# Apply migrations (non-interactive)
turbo run db:deploy --filter=@coldjot/database

# Push schema changes without migrations
turbo run db:push --filter=@coldjot/database

# Seed the database
turbo run db:seed --filter=@coldjot/database

# Reset the database (drops all data)
turbo run db:reset --filter=@coldjot/database

# Open Prisma Studio
turbo run db:studio --filter=@coldjot/database
```

### Staging Commands

Safe commands for staging environment:

```bash
# Deploy migrations to staging
turbo run db:deploy:staging --filter=@coldjot/database

# Seed staging database
turbo run db:seed:staging --filter=@coldjot/database
```

### Production Commands

Safe commands for production environment:

```bash
# Deploy migrations to production
turbo run db:deploy:prod --filter=@coldjot/database

# Seed production database
turbo run db:seed:prod --filter=@coldjot/database
```

## Command Details

### Migration Commands

- `db:migrate`: Creates and applies migrations interactively (development only)
- `db:migrate:create`: Creates migration files without applying them
- `db:deploy`: Applies pending migrations safely (no schema changes)
- `db:deploy:staging`: Applies migrations to staging
- `db:deploy:prod`: Applies migrations to production

### Database Management

- `db:push`: Quick schema push without migrations (development only)
- `db:seed`: Seeds the database with initial data
- `db:reset`: Resets the database (development only)
- `db:studio`: Opens Prisma Studio for database visualization

### Utility Commands

- `db:generate`: Generates Prisma Client

## Best Practices

1. **Development Workflow**:

   - Use `db:migrate` for schema changes during development
   - Use `db:push` for quick iterations without migrations
   - Use `db:studio` to visualize and modify data

2. **Staging/Production Workflow**:

   - Always use `db:deploy:staging` or `db:deploy:prod`
   - Never use `db:push` or `db:migrate` in staging/production
   - Test migrations in staging before production

3. **Migration Safety**:
   - Always review migrations before applying them
   - Use `db:migrate:create` to review changes before applying
   - Test migrations in development first

## Environment Variables

Each command requires specific environment variables:

- `DATABASE_URL`: Required for all commands
- `SHADOW_DATABASE_URL`: Required for `db:migrate` and `db:reset` in development

These are automatically loaded from the appropriate .env file based on the command.
