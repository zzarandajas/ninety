# Setup MCP 21st.dev (Magic) para este proyecto

21st.dev renovó su backend en 2026: el servicio antiguo "Magic MCP" pasó a
llamarse **21st MCP**, y las API keys antiguas del consote de Magic dejaron de
funcionar — hay que generar una key nueva en 21st.dev/mcp.

## Opción A — instalación automática (recomendada)

```bash
npx @21st-dev/cli@latest init --client claude
```
Esto detecta Claude Code y añade la configuración correcta automáticamente.

## Opción B — configuración manual

Servidor HTTP directo (forma actual, recomendada frente al viejo paquete stdio):
claude mcp add --transport http 21st https://21st.dev/api/mcp --header "x-api-key: 21st_sk_c7e0bcd3a8ae2cdd2ab9e51fe4af9e5f5aa4dca324641c0e9343c74d5472b16f"
```json
{
  "mcpServers": {
    "21st": {
      "url": "https://21st.dev/api/mcp",
      "headers": {
        "x-api-key": "21st_sk_c7e0bcd3a8ae2cdd2ab9e51fe4af9e5f5aa4dca324641c0e9343c74d5472b16f"
      }
    }
  }
}
```

Guardar en `~/.claude/mcp_config.json` (o el archivo de config MCP que use tu
versión de Claude Code — verifica la ruta exacta con `claude mcp list` tras
instalar).

Obtén la API key en: https://21st.dev/mcp

## Uso durante el desarrollo

Una vez configurado, en Claude Code puedes pedir en lenguaje natural:
- Buscar componentes existentes: *"busca en 21st un componente de card con glassmorphism"*
- Generar uno nuevo: *"genera con 21st un componente de tabla scorecard con backdrop blur"*

No hace falta usar el antiguo comando `/ui` — el agente decide cuándo llamar a las
tools `search` / `generate` del MCP según lo que le pidas.

## Nota sobre cuota

El plan gratuito de 21st.dev tiene un número limitado de generaciones. Si el
proyecto requiere generar muchos componentes (6 módulos × varias vistas cada
uno), ten en cuenta que puede que necesites plan de pago a mitad de proyecto —
no es bloqueante para empezar.
