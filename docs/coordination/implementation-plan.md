# Plan de implementacion coordinado

## Objetivo MVP

Validar una sala de control local donde varios agentes puedan registrarse, enviar y leer mensajes, persistir historial en SQLite y exponer estado inicial al dashboard en tiempo real.

## Fase 0: reportes sin codigo

1. `coder-junior` prepara propuesta de scaffolding backend/MCP minimo.
2. `coder-senior` revisa arquitectura, limites entre MCP/API/WebSocket/persistencia y modelo de datos inicial.
3. `qa` define matriz de pruebas para herramientas MCP, persistencia y eventos.
4. `frontend` propone estructura del dashboard, vistas iniciales y contrato de datos esperado.

Codex Coordinador consolida estos reportes antes de aprobar cambios.

## Fase 1: backend/MCP minimo

Responsable principal: `coder-junior`. Revisor: `coder-senior`.

- Crear workspace Node.js/TypeScript.
- Configurar Fastify, servidor MCP y Prisma/SQLite.
- Implementar `agent.register`.
- Implementar `chat.send`.
- Implementar `chat.read`.
- Exponer `GET /health`, `GET /agents`, `GET /messages?roomId=&limit=` y `GET /api/dashboard/snapshot`.
- Agregar tests de contrato para registro y chat.

## Fase 2: estado, tareas y eventos

Responsables: `coder-junior` y `coder-senior`.

- Agregar `agent.update_status`.
- Agregar `task.start` y `task.finish`.
- Emitir eventos internos y WebSocket para mensajes, agentes y tareas.
- Mantener payloads pequenos y estables.

## Fase 3: dashboard MVP

Responsable principal: `frontend`. Revisor: `qa`.

- Crear React/Vite/Tailwind.
- Mostrar agentes activos, chat y tareas activas.
- Conectar WebSocket.
- Mantener vistas simples, densas y orientadas a supervision.

## Fase 4: trazabilidad basica

Responsables: `coder-senior`, `coder-junior`, `qa`.

- Agregar `file.claim` y `file.release`.
- Agregar `decision.record`.
- Cubrir flujos multiagente con tests de integracion.

## Division para evitar conflictos

- `coder-junior`: `server/`, `mcp/`, `prisma/`, tests backend.
- `coder-senior`: contratos, arquitectura, revision de schema; no pisa implementacion junior salvo ajuste acordado.
- `frontend`: `web/` y contratos mock; no toca Prisma ni MCP.
- `qa`: `tests/`, fixtures y criterios; no cambia codigo productivo sin aprobacion.

## Decisiones del Coordinador

- MVP en un solo proceso Node.js para compartir repositorios, bus interno y WebSocket sin orquestacion adicional.
- SQLite local por defecto; PostgreSQL queda fuera del MVP inicial.
- `file.claim` es coordinacion blanda, no bloqueo real de archivos.
- El dashboard carga snapshot inicial desde `GET /api/dashboard/snapshot` y luego aplica eventos WebSocket incrementales.
- No se autoriza implementacion hasta cerrar contratos de Fase 0.
