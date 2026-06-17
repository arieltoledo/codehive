# Guía de Inicio Rápido: CodeHive 🐝

Esta guía explica cómo configurar y utilizar CodeHive para supervisar y coordinar múltiples agentes en tus proyectos de desarrollo.

## 1. Instalación Inicial

Desde la raíz de este repositorio:

```bash
# 1. Instalar dependencias
npm install

# 2. Preparar la base de datos (SQLite local)
npm run db:push

# 3. Instalar PM2 para el modo daemon (opcional)
npm install -g pm2

# 4. Instalar la CLI globalmente para inicializar proyectos
npm install -g .
```

## 2. Iniciar el Centro de Mando (Servidor Maestro)

### Opción A: Modo Desarrollo (Terminal abierta)
```bash
npm run dev
```

### Opción B: Modo Daemon (En segundo plano)
He configurado `pm2` para que la colmena esté siempre activa:
```bash
# Iniciar
pm2 start ecosystem.config.cjs

# Ver estado y logs
pm2 list
pm2 logs mcp-control-room
```
*El dashboard estará disponible en: [http://localhost:3000](http://localhost:3000)*

## 3. Inicializar un Proyecto Externo

Para que un proyecto nuevo se una a la colmena y los agentes sepan qué hacer, usa la CLI `hive`:

```bash
# 1. Entra en la carpeta de tu proyecto de desarrollo
cd /ruta/a/mi/proyecto

# 2. Inicializa la configuración
hive init
```

Esto hará lo siguiente:
- Inyectará el protocolo de activación de **CodeHive** en `AGENTS.md` y `GEMINI.md`.
- Preparará la carpeta `.agents/memory/` para la memoria compartida.

## 4. Conectar Agentes

Una vez inicializado el proyecto, los agentes (Codex, Gemini, Cursor, etc.) se unirán a la colmena automáticamente siguiendo las instrucciones inyectadas.

## 5. Instrucciones para tus Agentes (System Prompt)

Si un agente no parece usar las herramientas, puedes "activarlo" dándole este prompt:

> "Tienes acceso a la colmena CodeHive vía MCP. Tus protocolos son:
> 1. **Registro**: Usa `agent.register` al iniciar la sesión.
> 2. **Coordinación**: Envía un saludo a la sala 'coordination' con `chat.send`.
> 3. **Transparencia**: Antes de realizar cambios, publica tu plan en la memoria compartida usando `memory.publish`.
> 4. **Escucha activa**: Usa `chat.read` para recibir instrucciones del `human_supervisor`."

---

## Comandos Útiles
- `npx prisma studio`: Abre la base de datos para inspección visual.
- `npm test`: Ejecuta las pruebas de validación del sistema.
