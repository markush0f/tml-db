# PostgreSQL y MySQL locales

Desde la raíz del proyecto, con Docker/Compose y el llavero desbloqueado:

```sh
bun run docker:up       # Arranca, espera salud, registra y verifica ambas conexiones
bun run start          # Ctrl+K → docker-postgres o docker-mysql → Enter
bun run docker:status
bun run docker:verify  # Metadatos, tres usuarios y bloqueo de escritura vía DBHub
bun run docker:down    # Detiene/elimina contenedores; conserva datos y credenciales
```

| Conexión        | Motor         | Dirección local | Base     | Tablas                  |
| --------------- | ------------- | --------------- | -------- | ----------------------- |
| docker-postgres | PostgreSQL 17 | 127.0.0.1:15432 | tml_demo | users, projects, tasks  |
| docker-mysql    | MySQL 8.4     | 127.0.0.1:13306 | tml_demo | users, products, orders |

Las dos tienen tres usuarios ficticios. `SELECT * FROM users LIMIT 200;` funciona en ambas. Las tablas aparecen en la sidebar debajo de la conexión, agrupadas por esquema. Cambia con Ctrl+K; el SQL se conserva y los resultados anteriores se limpian. No se cambia la conexión de arranque `active` del catálogo.

## Seguridad y persistencia

- Proyecto Compose independiente: `tml-db-demo`. No modifica otros contenedores.
- Puertos publicados solo en loopback; no en toda la red. Puedes cambiarlos mediante `TML_DEMO_POSTGRES_PORT` y `TML_DEMO_MYSQL_PORT` antes de `docker:up`.
- Contraseñas aleatorias en el llavero del usuario: servicio `tml-db-docker` para inicialización de Docker y referencias del servicio `tml-db` para la aplicación. No se escriben contraseñas en YAML, TOML, `.env` ni argumentos CLI.
- **Limitación de Docker local:** Compose recibe las credenciales por entorno y Docker las conserva en los metadatos del contenedor. Quien tenga acceso al daemon puede inspeccionarlas. Este entorno es exclusivamente de desarrollo, no una solución de secretos para producción.
- La aplicación utiliza `tml_reader`, con permisos SELECT en la base de prueba; además DBHub impone solo lectura. Los usuarios de administración no se registran en la aplicación.
- Los volúmenes persisten al detener. Los scripts de inicialización se ejecutan solo al crear un volumen vacío. No borres los secretos del llavero si conservas los volúmenes: se necesitan las mismas contraseñas para reconectar. Si faltan claves y existen volúmenes, el arranque se detiene para evitar generar contraseñas incompatibles.
- Repetir `docker:up` reutiliza las claves y conexiones existentes. Nunca sobrescribe una conexión con el mismo nombre y otra URL. Si cambias puertos, elimina las dos conexiones de prueba desde el gestor (seleccionando antes otra conexión) y vuelve a ejecutar `docker:up`.
- `docker:down` **no** usa `--volumes`. El borrado definitivo de datos se deja como operación manual deliberada.

## Verificación de la TUI real

Tras `docker:up`, la prueba opcional recorre el selector, cambia entre ambos motores, comprueba tablas y consulta usuarios:

```sh
TML_DB_TEST_DOCKER=1 bun test src/tui/docker.integration.test.tsx
```

Las pruebas normales no arrancan Docker ni dependen de estas conexiones.
