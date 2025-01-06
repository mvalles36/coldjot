# @coldjot/database

Database package for the coldjot application. This package handles all database operations, migrations, and seeding.

## Documentation

For detailed information about available commands and best practices, please see:

- [Database Commands Documentation](../../docs/database.md)

## Quick Start

1. Set up environment files in `env/` directory:

   ```
   env/
   ├── .env.development
   ├── .env.staging
   └── .env.production
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Generate Prisma Client:

   ```bash
   turbo run db:generate --filter=@coldjot/database
   ```

4. Run migrations:

   ```bash
   # Development
   turbo run db:migrate --filter=@coldjot/database

   # Staging
   turbo run db:deploy:staging --filter=@coldjot/database

   # Production
   turbo run db:deploy:prod --filter=@coldjot/database
   ```

## Environment Variables

Required environment variables in your .env files:

```env
# Required for all environments
DATABASE_URL="postgresql://user:password@localhost:5432/database_name"

# Required only for development
SHADOW_DATABASE_URL="postgresql://user:password@localhost:5432/shadow_database_name"
```

See the [Database Commands Documentation](../../docs/database.md) for more details.
