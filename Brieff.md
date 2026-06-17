# Brief del Proyecto: MCP Agent Control Room

## 1. Resumen ejecutivo

**MCP Agent Control Room** es una plataforma para coordinar, observar y auditar agentes de IA orientados al desarrollo de software, como Codex, Gemini, OpenCode, Claude Code u otros agentes compatibles con MCP.

El proyecto propone crear un **servidor MCP neutral** que funcione como punto común de comunicación entre agentes. A través de este servidor, los agentes podrán reportar qué están haciendo, intercambiar mensajes, registrar decisiones, declarar tareas activas, avisar qué archivos están modificando y solicitar intervención humana cuando sea necesario.

El sistema incluirá además una interfaz web en tiempo real, conectada mediante WebSocket, para que el usuario humano pueda ver la actividad de todos los agentes desde un único lugar.

La idea central no es construir otro agente, sino una **sala de control para agentes de código**.

---

## 2. Contexto

Actualmente existen herramientas de code agents capaces de ejecutar tareas, modificar archivos, crear subagentes, bifurcar soluciones y trabajar en paralelo. Sin embargo, cuando se usan varias herramientas a la vez —por ejemplo Codex, Gemini y OpenCode— se vuelve difícil entender qué está haciendo cada una.

El usuario puede tener varios agentes trabajando en el mismo proyecto, pero no siempre cuenta con una vista clara de:

* qué tarea está ejecutando cada agente;
* qué archivos está tocando;
* qué decisiones tomó;
* si creó subagentes;
* si está bloqueado;
* si está duplicando trabajo con otro agente;
* si necesita intervención humana;
* qué dijo o recibió de otros agentes.

Aunque ya existen herramientas de observabilidad, tracing o dashboards específicos para ciertos entornos, el objetivo de este proyecto es crear una capa más simple, abierta y neutral: un **chat operativo y registro compartido para agentes de desarrollo**, accesible vía MCP.

---

## 3. Problema a resolver

Los code agents pueden trabajar de forma autónoma o semiautónoma, pero muchas veces lo hacen de manera opaca para el usuario humano.

Esto genera varios problemas:

* Falta de visibilidad sobre lo que hace cada agente.
* Dificultad para coordinar agentes de distintos proveedores.
* Pérdida de contexto entre sesiones.
* Falta de trazabilidad sobre decisiones técnicas.
* Riesgo de que varios agentes trabajen sobre los mismos archivos sin saberlo.
* Dificultad para auditar qué agente hizo qué.
* Imposibilidad de ver en tiempo real conversaciones o reportes entre agentes.
* Poca capacidad de intervención humana durante la ejecución.
* Riesgo de bucles o acciones redundantes entre agentes.

El problema principal no es que falten agentes, sino que falta una **capa común de coordinación y observabilidad**.

---

## 4. Solución propuesta

Desarrollar un servidor MCP compartido que actúe como una sala común para agentes de código.

Este servidor permitirá que cualquier agente compatible con MCP pueda:

* registrarse;
* anunciar su estado;
* enviar mensajes;
* leer mensajes de otros agentes;
* declarar tareas;
* reportar avances;
* informar bloqueos;
* registrar decisiones;
* avisar qué archivos está usando;
* notificar creación de subagentes;
* pedir intervención humana.

En paralelo, una interfaz web permitirá al usuario humano observar en tiempo real toda la actividad del sistema.

La solución se compone de tres piezas principales:

1. **Servidor MCP**

   * Expone herramientas para que los agentes interactúen con el sistema.

2. **Servidor de eventos en tiempo real**

   * Usa WebSocket para notificar nuevos mensajes, cambios de estado y eventos relevantes.

3. **Dashboard humano**

   * Permite ver agentes, tareas, mensajes, archivos, eventos y trazabilidad.

---

## 5. Objetivo del proyecto

Crear una plataforma mínima y extensible para que múltiples code agents puedan coordinarse entre sí y ser supervisados por una persona desde una interfaz central.

El objetivo inicial es validar que agentes como Codex, Gemini y OpenCode puedan conectarse al mismo MCP y usar herramientas comunes para reportar actividad y comunicarse.

---

## 6. Usuarios objetivo

## 6.1 Usuario humano supervisor

Persona que ejecuta o coordina agentes de código.

Necesita:

* ver qué hace cada agente;
* entender qué decisiones se toman;
* intervenir cuando sea necesario;
* evitar duplicación de trabajo;
* auditar el historial;
* saber qué archivos están siendo modificados;
* recibir alertas cuando un agente se bloquea o requiere ayuda.

## 6.2 Code agents

Agentes de IA usados para tareas de programación, análisis, documentación, testing o refactorización.

Ejemplos:

* Codex;
* Gemini CLI;
* OpenCode;
* Claude Code;
* otros agentes compatibles con MCP.

Necesitan:

* reportar estado;
* leer contexto compartido;
* enviar mensajes;
* coordinar con otros agentes;
* declarar tareas;
* avisar sobre archivos en uso;
* registrar resultados.

## 6.3 Subagentes

Agentes creados o bifurcados por otros agentes.

Necesitan:

* identificarse como hijos de otro agente;
* declarar la tarea que recibieron;
* reportar avances;
* finalizar con un resumen;
* dejar trazabilidad de su actividad.

---

## 7. Propuesta de valor

El valor principal del proyecto es transformar el trabajo de múltiples agentes de código en una actividad observable, coordinada y auditable.

El sistema funcionaría como una mezcla entre:

* chat interno para agentes;
* panel de control humano;
* bitácora técnica automática;
* sistema de eventos en tiempo real;
* registro de decisiones;
* tablero de tareas;
* observabilidad liviana para agentes;
* capa de coordinación vía MCP.

La diferencia frente a herramientas existentes es que el foco no está en un proveedor específico, sino en ser un **MCP neutral y agnóstico**, usable por distintos agentes.

---

## 8. Alcance del MVP

El MVP debe ser pequeño y orientado a validar la idea.

## 8.1 Incluido en el MVP

* Servidor MCP básico.
* Herramientas MCP mínimas para chat, agentes y tareas.
* Registro de agentes.
* Envío y lectura de mensajes.
* Estado actual de cada agente.
* Eventos WebSocket.
* Dashboard web simple.
* Historial persistente.
* Registro de tareas.
* Registro básico de archivos reclamados por agentes.
* Soporte para múltiples agentes conectados al mismo proyecto.

## 8.2 Fuera del MVP

* Orquestación automática compleja.
* Ejecución directa de código.
* Control total sobre los agentes.
* Sistema avanzado de permisos.
* Análisis automático de commits.
* Integración profunda con Git.
* Memoria vectorial.
* Gestión avanzada de ramas.
* Marketplace de agentes.
* Autenticación enterprise.
* Observabilidad tipo APM completa.

---

## 9. Casos de uso principales

## 9.1 Supervisar agentes en tiempo real

El usuario abre el dashboard y ve qué agentes están activos, qué tarea realiza cada uno y qué mensajes publican.

## 9.2 Coordinar agentes de distintos proveedores

Codex, Gemini y OpenCode se conectan al mismo servidor MCP y usan las mismas herramientas para reportar actividad.

## 9.3 Evitar conflictos sobre archivos

Un agente declara que va a trabajar sobre determinados archivos. Otros agentes pueden ver esa información antes de modificar los mismos archivos.

## 9.4 Registrar bifurcaciones o subagentes

Cuando un agente crea o delega trabajo a un subagente, lo registra en el sistema para que el usuario pueda ver el árbol de actividad.

## 9.5 Pedir intervención humana

Un agente puede enviar una señal clara indicando que necesita una decisión, validación o desbloqueo por parte del usuario.

## 9.6 Auditar decisiones técnicas

Las decisiones importantes quedan registradas con agente, timestamp, tarea asociada y contexto.

---

## 10. Flujo de ejemplo

1. El usuario inicia una tarea de desarrollo.
2. Codex se conecta al MCP y se registra como agente.
3. Gemini también se conecta y declara que revisará documentación o alternativas.
4. OpenCode se conecta y declara que trabajará sobre tests.
5. Codex publica que va a modificar ciertos archivos.
6. El dashboard muestra la actividad en tiempo real.
7. Gemini detecta un posible conflicto y lo publica en el chat.
8. OpenCode marca una tarea como bloqueada.
9. El usuario interviene desde la interfaz y da una instrucción.
10. Todos los agentes pueden leer la instrucción desde el MCP.
11. El sistema conserva el historial completo de mensajes, tareas y eventos.

---

## 11. Herramientas MCP sugeridas

## 11.1 `agent.register`

Registra un agente en el sistema.

### Parámetros

```json
{
  "agent_id": "codex_01",
  "name": "Codex Backend Agent",
  "provider": "codex",
  "role": "backend",
  "parent_agent_id": null
}
```

---

## 11.2 `agent.heartbeat`

Indica que el agente sigue activo.

### Parámetros

```json
{
  "agent_id": "codex_01"
}
```

---

## 11.3 `agent.update_status`

Actualiza el estado actual de un agente.

### Parámetros

```json
{
  "agent_id": "codex_01",
  "status": "working",
  "summary": "Refactorizando el módulo de autenticación"
}
```

Estados posibles:

* `idle`
* `working`
* `blocked`
* `waiting_human`
* `done`
* `error`
* `offline`

---

## 11.4 `agent.spawned`

Registra la creación o bifurcación de un subagente.

### Parámetros

```json
{
  "parent_agent_id": "codex_01",
  "child_agent_id": "codex_01_tests",
  "child_name": "Codex Test Agent",
  "task": "Crear tests para el módulo de autenticación"
}
```

---

## 11.5 `chat.send`

Envía un mensaje al chat compartido.

### Parámetros

```json
{
  "room_id": "project_main",
  "sender_id": "codex_01",
  "message": "Voy a revisar el flujo de login antes de modificar los tests.",
  "message_type": "status"
}
```

Tipos de mensaje sugeridos:

* `status`
* `question`
* `decision`
* `warning`
* `result`
* `human`
* `system`

---

## 11.6 `chat.read`

Lee mensajes recientes de una sala.

### Parámetros

```json
{
  "room_id": "project_main",
  "limit": 50
}
```

---

## 11.7 `task.start`

Declara el inicio de una tarea.

### Parámetros

```json
{
  "task_id": "task_auth_refactor",
  "agent_id": "codex_01",
  "title": "Refactorizar autenticación",
  "description": "Separar lógica de login y validación de tokens"
}
```

---

## 11.8 `task.update`

Actualiza el estado de una tarea.

### Parámetros

```json
{
  "task_id": "task_auth_refactor",
  "agent_id": "codex_01",
  "status": "in_progress",
  "summary": "Ya separé la validación de tokens en un servicio independiente"
}
```

---

## 11.9 `task.finish`

Marca una tarea como finalizada.

### Parámetros

```json
{
  "task_id": "task_auth_refactor",
  "agent_id": "codex_01",
  "result": "Refactor completado. Falta revisión humana antes de mergear."
}
```

---

## 11.10 `task.blocked`

Declara que una tarea está bloqueada.

### Parámetros

```json
{
  "task_id": "task_auth_refactor",
  "agent_id": "codex_01",
  "reason": "No está claro si se debe mantener compatibilidad con tokens antiguos"
}
```

---

## 11.11 `file.claim`

Indica que un agente va a trabajar sobre uno o más archivos.

### Parámetros

```json
{
  "agent_id": "codex_01",
  "task_id": "task_auth_refactor",
  "files": [
    "src/auth/login.ts",
    "src/auth/tokenService.ts"
  ],
  "reason": "Necesito modificar el flujo de autenticación"
}
```

---

## 11.12 `file.release`

Indica que un agente terminó de trabajar sobre determinados archivos.

### Parámetros

```json
{
  "agent_id": "codex_01",
  "files": [
    "src/auth/login.ts",
    "src/auth/tokenService.ts"
  ],
  "summary": "Cambios finalizados en autenticación"
}
```

---

## 11.13 `decision.record`

Registra una decisión técnica importante.

### Parámetros

```json
{
  "agent_id": "gemini_01",
  "task_id": "task_auth_refactor",
  "decision": "Mantener compatibilidad con tokens antiguos durante una versión",
  "reason": "Evita romper sesiones activas de usuarios existentes"
}
```

---

## 11.14 `human.notify`

Solicita intervención humana.

### Parámetros

```json
{
  "agent_id": "opencode_01",
  "task_id": "task_auth_refactor",
  "priority": "high",
  "message": "Necesito confirmación antes de modificar la lógica de expiración de sesiones."
}
```

---

## 12. Eventos WebSocket sugeridos

El sistema debe emitir eventos en tiempo real para que el dashboard y otros clientes puedan actualizarse.

Eventos mínimos:

```json
{
  "type": "chat.message.created",
  "room_id": "project_main",
  "message_id": "msg_123"
}
```

```json
{
  "type": "agent.status.updated",
  "agent_id": "codex_01",
  "status": "working"
}
```

```json
{
  "type": "task.started",
  "task_id": "task_auth_refactor",
  "agent_id": "codex_01"
}
```

```json
{
  "type": "file.claimed",
  "agent_id": "codex_01",
  "files": [
    "src/auth/login.ts"
  ]
}
```

```json
{
  "type": "human.intervention.requested",
  "agent_id": "opencode_01",
  "priority": "high"
}
```

---

## 13. Dashboard humano

El dashboard debe mostrar una vista clara del ecosistema de agentes.

## 13.1 Secciones mínimas

### Chat global

Vista cronológica de mensajes publicados por agentes, humanos y sistema.

### Agentes activos

Lista de agentes conectados con:

* nombre;
* proveedor;
* rol;
* estado;
* tarea activa;
* última actividad.

### Tareas

Listado de tareas con:

* título;
* estado;
* agente responsable;
* progreso;
* bloqueos;
* resultado final.

### Archivos en uso

Vista de archivos reclamados por agentes para evitar conflictos.

### Árbol de agentes

Visualización de agentes principales y subagentes.

### Alertas humanas

Panel con solicitudes de intervención, bloqueos y advertencias.

---

## 14. Modelo de datos inicial

## 14.1 `agents`

| Campo           | Tipo        | Descripción                           |
| --------------- | ----------- | ------------------------------------- |
| id              | string      | Identificador del agente              |
| name            | string      | Nombre visible                        |
| provider        | string      | Codex, Gemini, OpenCode, Claude, etc. |
| role            | string      | Rol del agente                        |
| parent_agent_id | string/null | Agente padre si es subagente          |
| status          | string      | Estado actual                         |
| current_task_id | string/null | Tarea activa                          |
| last_seen_at    | datetime    | Última actividad                      |
| created_at      | datetime    | Fecha de registro                     |

---

## 14.2 `rooms`

| Campo      | Tipo     | Descripción              |
| ---------- | -------- | ------------------------ |
| id         | string   | Identificador de la sala |
| project_id | string   | Proyecto asociado        |
| name       | string   | Nombre de la sala        |
| created_at | datetime | Fecha de creación        |

---

## 14.3 `messages`

| Campo        | Tipo        | Descripción                         |
| ------------ | ----------- | ----------------------------------- |
| id           | string      | Identificador del mensaje           |
| room_id      | string      | Sala                                |
| sender_id    | string      | Agente, humano o sistema            |
| sender_type  | string      | `agent`, `human` o `system`         |
| message_type | string      | Estado, decisión, advertencia, etc. |
| content      | text        | Contenido del mensaje               |
| task_id      | string/null | Tarea relacionada                   |
| created_at   | datetime    | Fecha del mensaje                   |

---

## 14.4 `tasks`

| Campo             | Tipo          | Descripción               |
| ----------------- | ------------- | ------------------------- |
| id                | string        | Identificador de la tarea |
| title             | string        | Título                    |
| description       | text          | Descripción               |
| status            | string        | Estado                    |
| assigned_agent_id | string        | Agente responsable        |
| created_at        | datetime      | Fecha de creación         |
| updated_at        | datetime      | Última actualización      |
| finished_at       | datetime/null | Fecha de finalización     |

---

## 14.5 `file_claims`

| Campo       | Tipo          | Descripción                   |
| ----------- | ------------- | ----------------------------- |
| id          | string        | Identificador                 |
| agent_id    | string        | Agente que reclama el archivo |
| task_id     | string/null   | Tarea relacionada             |
| file_path   | string        | Ruta del archivo              |
| status      | string        | `claimed` o `released`        |
| reason      | text          | Motivo                        |
| created_at  | datetime      | Fecha                         |
| released_at | datetime/null | Fecha de liberación           |

---

## 14.6 `decisions`

| Campo      | Tipo        | Descripción                     |
| ---------- | ----------- | ------------------------------- |
| id         | string      | Identificador                   |
| agent_id   | string      | Agente que registra la decisión |
| task_id    | string/null | Tarea relacionada               |
| decision   | text        | Decisión tomada                 |
| reason     | text        | Justificación                   |
| created_at | datetime    | Fecha                           |

---

## 15. Arquitectura propuesta

```text
+------------------------------------------------+
|                Dashboard Web                   |
| Chat | Agentes | Tareas | Archivos | Alertas   |
+-------------------------+----------------------+
                          |
                          | WebSocket / HTTP
                          |
+-------------------------v----------------------+
|              Agent Control Server              |
| API HTTP | WebSocket | Event Bus | Persistence |
+-------------------------+----------------------+
                          |
                          | DB
                          |
+-------------------------v----------------------+
|              SQLite / PostgreSQL               |
+------------------------------------------------+

+------------------------------------------------+
|                  MCP Server                    |
| agent.* | chat.* | task.* | file.* | human.*  |
+-------------------------+----------------------+
                          |
                          | MCP
                          |
+-------------------------v----------------------+
|       Codex | Gemini | OpenCode | Otros        |
+------------------------------------------------+
```

---

## 16. Stack técnico recomendado para MVP

## Backend

* Node.js
* TypeScript
* Fastify
* WebSocket con `ws`
* SQLite para MVP
* Prisma como ORM

## MCP

* TypeScript MCP SDK
* Herramientas MCP desacopladas del frontend
* Transporte compatible con clientes MCP habituales

## Frontend

* React
* Vite
* Tailwind CSS
* WebSocket client

## Persistencia

* SQLite para prototipo local
* PostgreSQL para una versión más robusta

## Deploy local

* `.env`
* Docker Compose opcional
* Comando simple para levantar dashboard + MCP server

---

## 17. Requisitos funcionales

* El sistema debe permitir registrar agentes.
* El sistema debe permitir distinguir proveedores de agentes.
* El sistema debe permitir registrar subagentes.
* El sistema debe permitir enviar mensajes al chat.
* El sistema debe permitir leer mensajes recientes.
* El sistema debe emitir eventos en tiempo real.
* El sistema debe mostrar actividad en un dashboard.
* El sistema debe permitir crear y actualizar tareas.
* El sistema debe permitir registrar archivos en uso.
* El sistema debe permitir registrar decisiones técnicas.
* El sistema debe permitir solicitar intervención humana.
* El sistema debe guardar historial.
* El sistema debe funcionar como MCP server compartido.

---

## 18. Requisitos no funcionales

* Debe ser agnóstico respecto del proveedor del agente.
* Debe poder ejecutarse localmente.
* Debe tener bajo acoplamiento entre MCP, backend y frontend.
* Debe ser simple de integrar con nuevos agentes.
* Debe conservar trazabilidad.
* Debe evitar depender de un único modelo o proveedor.
* Debe ser extensible.
* Debe permitir auditoría posterior.
* Debe ser suficientemente liviano para uso diario en desarrollo.

---

## 19. Riesgos técnicos

## 19.1 Adopción real por parte de los agentes

No todos los agentes usarán las herramientas MCP de forma natural o consistente. Será necesario diseñar instrucciones claras para que cada agente reporte actividad de manera útil.

## 19.2 Ruido excesivo

Si los agentes reportan demasiado, el chat puede volverse difícil de leer. Se deben definir tipos de mensaje, filtros y niveles de importancia.

## 19.3 Bucles entre agentes

Si un agente responde automáticamente a cada mensaje de otro agente, pueden generarse ciclos innecesarios. Se recomienda limitar respuestas automáticas y agregar reglas de comportamiento.

## 19.4 Conflictos sobre archivos

El sistema puede avisar que un archivo está en uso, pero no puede impedir por sí solo que un agente lo modifique. En el MVP, `file.claim` debe funcionar como convención de coordinación, no como bloqueo fuerte.

## 19.5 Diferencias entre clientes MCP

Codex, Gemini, OpenCode u otros clientes pueden tener distintas formas de configurar y usar MCP. El servidor debe mantenerse lo más estándar posible.

---

## 20. Estrategia de validación

Antes de construir una versión completa, conviene validar la hipótesis con un prototipo mínimo.

## Prueba inicial recomendada

Conectar tres clientes al mismo MCP:

* Codex;
* Gemini;
* OpenCode.

Exponer solo estas herramientas:

* `agent.register`;
* `agent.update_status`;
* `chat.send`;
* `chat.read`;
* `task.start`;
* `task.finish`.

Validar si cada agente puede:

1. registrarse correctamente;
2. enviar mensajes;
3. leer mensajes de otros agentes;
4. reportar estado;
5. declarar una tarea;
6. aparecer en el dashboard.

Si esta prueba funciona, el proyecto tiene una base sólida para evolucionar.

---

## 21. Roadmap sugerido

## Fase 1: MCP mínimo

* Crear servidor MCP.
* Implementar `agent.register`.
* Implementar `chat.send`.
* Implementar `chat.read`.
* Guardar mensajes en SQLite.
* Probar con un agente.

## Fase 2: Multiagente

* Conectar Codex, Gemini y OpenCode.
* Agregar `agent.update_status`.
* Agregar `task.start` y `task.finish`.
* Registrar proveedor de cada agente.

## Fase 3: Dashboard

* Crear frontend básico.
* Mostrar chat en tiempo real.
* Mostrar agentes activos.
* Mostrar tareas activas.
* Agregar WebSocket.

## Fase 4: Trazabilidad

* Agregar decisiones.
* Agregar archivos reclamados.
* Agregar subagentes.
* Agregar historial filtrable.

## Fase 5: Control humano

* Agregar `human.notify`.
* Agregar panel de alertas.
* Permitir respuestas humanas desde dashboard.
* Agregar mensajes de prioridad.

## Fase 6: Robustez

* Agregar autenticación simple.
* Agregar configuración por proyecto.
* Agregar PostgreSQL.
* Agregar exportación de logs.
* Agregar documentación de integración por agente.

---

## 22. Criterios de éxito del MVP

El MVP será exitoso si:

* al menos dos agentes distintos pueden conectarse al mismo MCP;
* cada agente puede enviar mensajes al chat;
* cada agente puede leer mensajes de otros agentes;
* el dashboard muestra mensajes en tiempo real;
* el usuario puede identificar qué agente hizo qué;
* las tareas activas se pueden ver desde la interfaz;
* el historial queda guardado;
* el sistema ayuda a reducir la opacidad del trabajo de los agentes.

---

## 23. Nombre del producto

Opciones posibles:

* MCP Agent Control Room
* AgentOps Chat
* Agent Coordination Hub
* MCP Agent Bus
* Code Agent Observatory
* Agent Workbench
* Multi-Agent Dev Room
* Agent Blackbox
* AgentOps Room

Nombre recomendado para esta etapa:

**MCP Agent Control Room**

Porque comunica bien la idea de sala de control, supervisión y coordinación de agentes.

---

## 24. Definición corta

**MCP Agent Control Room es una sala de control local para observar, coordinar y auditar code agents de distintos proveedores mediante un servidor MCP compartido, WebSocket y un dashboard humano en tiempo real.**

---

## 25. Próximo paso recomendado

Construir una prueba técnica mínima con:

* un servidor MCP;
* SQLite;
* herramientas `agent.register`, `chat.send` y `chat.read`;
* un dashboard muy simple;
* conexión de al menos dos agentes reales.

El objetivo no debería ser crear una plataforma completa desde el inicio, sino validar que varios agentes pueden compartir contexto operativo usando MCP como capa común.
