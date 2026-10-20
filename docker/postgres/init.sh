#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 <<'SQL'
\getenv reader_password TML_READER_PASSWORD
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id)
);
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO users VALUES
  (1, 'Ana', 'ana@example.test'),
  (2, 'Luis', 'luis@example.test'),
  (3, 'Marta', 'marta@example.test');
INSERT INTO projects VALUES (1, 'Explorador PostgreSQL', 1), (2, 'Consultas de prueba', 2);
INSERT INTO tasks VALUES (1, 1, 'Mostrar tablas en la sidebar', TRUE), (2, 2, 'Probar consultas de lectura', FALSE);
CREATE ROLE tml_reader LOGIN PASSWORD :'reader_password';
GRANT CONNECT ON DATABASE tml_demo TO tml_reader;
GRANT USAGE ON SCHEMA public TO tml_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tml_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tml_reader;
SQL
