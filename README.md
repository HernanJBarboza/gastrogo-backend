```markdown
# Gastro Backend (GastroGo)

Plantilla mínima de API REST para GastroGo preparada para desplegar en Heroku.

Endpoints generales:
- `GET /health` - estado del servicio
- `GET /recipes` - listar recetas
- `GET /recipes/:id` - obtener receta
- `POST /recipes` - crear receta (body: `title`, `ingredients`, `steps`)
- `GET /products` - listar productos
- `POST /products` - crear producto (body: `name`, `price`, `stock`)

Menus y plantillas (pantallas digitales):
- `GET /templates` - listar plantillas
- `GET /templates/:id` - obtener plantilla
- `POST /templates` - crear plantilla (protegido; requiere `x-api-key`) (body: `id, name, config`)

- `GET /menus` - listar menús
- `GET /menus/:id` - obtener menú
- `POST /menus` - crear menú (protegido; requiere `x-api-key`)
- `PUT /menus/:id` - actualizar menú (protegido)
- `DELETE /menus/:id` - eliminar menú (protegido)

- `GET /present/:menuId` - obtener payload listo para pantallas (presentación combinada menu+template). Query params: `refresh=true` para forzar recálculo, `templateId=` para override.
- `POST /cache/clear` - limpiar cache de presentaciones (protegido)

Nota: los menús y plantillas se almacenan en memoria en esta plantilla; para producción usa una base de datos (Firestore, Postgres, etc.).

Autenticación y seguridad:
- Rutas que modifican plantillas o menús requieren enviar header `x-api-key: <API_KEY>` o `?apiKey=<API_KEY>`.
- Por defecto `API_KEY` = `secret-api-key` si no se define la variable de entorno `API_KEY`. Cambia esto en producción.

Cache y TTL:
- Las presentaciones generadas por `/present/:menuId` se cachean en memoria por defecto 30 segundos.
- Puedes definir `cacheTTLsec` dentro de `config` de una plantilla para ajustar TTL por plantilla.

Despliegue en Heroku:
1. `heroku create your-app-name`
2. `git push heroku main`

Variables de entorno:
- `PORT` (opcional)
- `API_KEY` (recomendado para rutas protegidas)

``` 

``` # Gastro Backend (GastroGo)

Plantilla mínima de API REST para GastroGo preparada para desplegar en Heroku.

Endpoints:
- `GET /health` - estado del servicio
- `GET /recipes` - listar recetas
- `GET /recipes/:id` - obtener receta
- `POST /recipes` - crear receta (body: `title`, `ingredients`, `steps`)
- `GET /products` - listar productos
- `POST /products` - crear producto (body: `name`, `price`, `stock`)

Menus y plantillas (pantallas digitales):
- `GET /templates` - listar plantillas
- `GET /templates/:id` - obtener plantilla
- `POST /templates` - crear plantilla (body: `id?, name, layout, style, blocks`)
- `PUT /templates/:id` - actualizar plantilla
- `DELETE /templates/:id` - eliminar plantilla

- `GET /menus` - listar menús
- `GET /menus/:id` - obtener menú
- `POST /menus` - crear menú (body: `id?, name, items, templateId, active?`)
- `PUT /menus/:id` - actualizar menú
- `DELETE /menus/:id` - eliminar menú
- `POST /menus/:id/activate` - activar un menú (desactiva otros)

- `GET /presentation` - devuelve el menú activo junto con la plantilla. Opcional `?menuId=` para forzar uno.

Nota: los menús y plantillas se almacenan en memoria en esta plantilla; para producción usa una base de datos (Firestore, Postgres, etc.).
 - `GET /menu` - listar menús
 - `POST /menu` - crear menú
 - `POST /menu/items` - crear item de menú
 - `POST /menu/offers` - crear oferta/combos con `templateId` y `payload`
 - `GET /menu/display/:id` - obtener payload optimizado para pantallas/publicidad

Despliegue en Heroku:
1. `heroku create your-app-name`
2. `git push heroku main`

Variables de entorno:
- `PORT` (opcional)
