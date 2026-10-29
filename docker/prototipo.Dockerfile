# Versión de prueba del prototipo de Fortaleza Servicar: sitio estático (sin backend) servido con Caddy.
# Construir desde la raíz del repositorio:  docker compose up --build   →   http://localhost:8080
FROM caddy:2.8.4-alpine

# Usuario sin privilegios (SEGURIDAD.md §8). Caddy solo necesita escribir en /data y /config.
RUN addgroup -S app && adduser -S -G app -H app \
 && chown -R app:app /data /config

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --chown=app:app prototipo/ /srv/

# Render y Railway asignan el puerto en $PORT; en local se usa 8080.
ENV PORT=8080
EXPOSE 8080
USER app

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
