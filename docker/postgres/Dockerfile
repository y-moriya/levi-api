# Lightweight PostgreSQL image for local dev & CI (integration tests)
FROM postgres:16-alpine

# Default envs (can be overridden at run-time)
ENV POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres \
    POSTGRES_DB=levi_api

# Initialize database objects/extensions if needed
# Any *.sql or *.sh files in this dir are executed on first container start
COPY init.sql /docker-entrypoint-initdb.d/

# Expose PostgreSQL port
EXPOSE 5432

# Simple healthcheck
HEALTHCHECK --interval=5s --timeout=3s --retries=10 CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
