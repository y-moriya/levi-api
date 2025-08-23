-- Initialization script for local/CI PostgreSQL used by levi-api
-- This runs only on first container start (when PGDATA is empty).

-- You can add extensions here if needed by future features
-- Example: enable UUID generation if you switch to uuid type ids
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Optional: tune for small dev instances
-- ALTER SYSTEM SET shared_buffers = '128MB';
-- ALTER SYSTEM SET max_connections = '50';

-- No schema objects are created here because the app runs migrations
-- via repositories/postgresql/pg-client.ts::runMigrations().
