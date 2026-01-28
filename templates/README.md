Plantillas para mostrar menús en pantallas (kiosk).

- `mc-style.json` y `burger-style.json` son ejemplos.
- Cada plantilla tiene `id`, `name` y `config` (colores, secciones, comportamientos).

Para añadir una plantilla: `POST /templates` con body `{ "id":"mi-id", "name":"Mi plantilla", "config": { ... } }`.
