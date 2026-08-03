# Design Brief — Glassmorphism / Opacidad

Dirección visual para todo el frontend. El objetivo: paneles con vidrio esmerilado,
profundidad por capas, y contraste suficiente para que siga siendo legible en una
herramienta de trabajo diario (no es una landing, es algo que se mira cada semana
en la reunión L10 — la legibilidad manda sobre el efecto visual).

## Principios

1. **Fondo con profundidad, no plano.** Gradiente suave o imagen abstracta muy
   desenfocada detrás de toda la app, para que el efecto glass tenga algo que
   "cristalizar". Un glass sobre fondo blanco liso no se nota.
2. **Jerarquía por capas de opacidad**, no por sombras duras. Elementos más
   importantes (modal activo, tarjeta de rock seleccionado) más opacos/nítidos;
   fondo y elementos secundarios más translúcidos.
3. **Contraste de texto siempre AA como mínimo.** El glass nunca debe sacrificar
   legibilidad — si un bloque de texto queda sobre un panel muy translúcido, se le
   añade un scrim (capa sólida semi-opaca) detrás del texto, no se baja el contraste.

## Tokens (CSS variables — usar consistentemente en los 6 módulos)

```css
:root {
  /* Superficies glass */
  --glass-bg-primary: rgba(255, 255, 255, 0.55);
  --glass-bg-secondary: rgba(255, 255, 255, 0.35);
  --glass-bg-elevated: rgba(255, 255, 255, 0.75); /* modales, dropdowns */
  --glass-border: rgba(255, 255, 255, 0.4);
  --glass-blur-sm: blur(8px);
  --glass-blur-md: blur(16px);
  --glass-blur-lg: blur(24px);
  --glass-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);

  /* Fondo de la app */
  --app-bg-gradient: linear-gradient(135deg, #6b8dd6 0%, #8e7ee0 50%, #c084c9 100%);

  /* Estados scorecard/rocks (mantener saturación alta para que se lean sobre glass) */
  --status-on-track: rgba(34, 197, 94, 0.85);
  --status-off-track: rgba(239, 68, 68, 0.85);
  --status-done: rgba(59, 130, 246, 0.85);
}

/* Dark mode (si se activa más adelante, no en MVP) usaría rgba(17,25,40, X) en vez de white */
```

## Patrón de componente glass base

```css
.glass-panel {
  background: var(--glass-bg-primary);
  backdrop-filter: var(--glass-blur-md);
  -webkit-backdrop-filter: var(--glass-blur-md);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: var(--glass-shadow);
}
```

## Aplicación por módulo

- **Rocks:** cada Rock es una `glass-panel` (tarjeta), agrupadas por columna de
  estado (on track / off track / done) sobre el fondo con gradiente.
- **Scorecard:** la grid en sí NO lleva blur pesado (una tabla con blur en cada
  celda es ilegible) — usar `--glass-bg-elevated` casi opaco en la tabla, y reservar
  el efecto glass fuerte para el contenedor/header y las tarjetas de resumen encima.
- **L10 Meeting (en vivo):** el panel activo de la agenda usa `--glass-bg-elevated`
  (más nítido, es lo que se está mirando), el resto de secciones de la agenda
  colapsadas usan `--glass-bg-secondary` (más translúcidas, en segundo plano).
- **Accountability Chart:** las tarjetas de Seat como `glass-panel`, líneas de
  jerarquía finas y semi-transparentes, no sólidas.
- **Issues List / Todos:** filas con `--glass-bg-secondary`, la fila en edición/
  expandida sube a `--glass-bg-elevated`.
- **V/TO:** documento de lectura larga — aquí se prioriza legibilidad sobre efecto;
  usar `--glass-bg-elevated` casi siempre, el blur fuerte solo en el header fijo.

## Ant Design + glass

Ant Design por defecto es flat/solid. No pelees contra la librería: sobreescribe
tokens del `ConfigProvider` (`theme.token.colorBgContainer` → usar los rgba de
arriba) en vez de forzar CSS `!important` por todos lados. Componentes tipo
`Card`, `Modal`, `Drawer` heredan bien de `colorBgContainer`; los que no
(`Table` interna, algunos inputs) necesitan overrides puntuales — documentar
cada override en el propio archivo del componente, no en un CSS global disperso.

## Uso del MCP 21st.dev para generación

Al pedir componentes vía 21st.dev, ser explícito en el prompt con los tokens de
arriba en vez de decir solo "estilo glass" — por ejemplo: *"card component with
backdrop-filter blur(16px), background rgba(255,255,255,0.55), border
rgba(255,255,255,0.4), rounded-2xl, subtle shadow matching glassmorphism over a
purple-blue gradient background"*. Cuanto más concreto el prompt, más consistente
el resultado entre los distintos módulos generados en sprints distintos.
