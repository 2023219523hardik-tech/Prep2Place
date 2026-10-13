#!/bin/sh
# Runs automatically on first container start (mounted into /docker-entrypoint-initdb.d/).
# POSTGRES_DB (see docker-compose.yml) already creates "placementdb" for the Java backend;
# this only needs to add the second database the Python ml-service connects to
# (see ml-service/docker-compose.yml's DATABASE_URL=...postgres:5432/placement_ml).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE placement_ml'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'placement_ml')\gexec
EOSQL
