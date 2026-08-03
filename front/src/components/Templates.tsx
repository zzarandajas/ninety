import React, { CSSProperties, ReactNode } from 'react';
import { Skeleton, theme } from 'antd';

const { useToken } = theme;

/** Escalas de tipografía/espaciado por variante. */
const SHELL_CFG = {
  template: { iconBox: 56, iconRadius: 14, iconFont: 36, titleSize: 20, subSize: 14, gap: 16, headMb: 24, filterMb: 24, titleWeight: 800, display: true },
  section: { iconBox: 40, iconRadius: 10, iconFont: 26, titleSize: 15, subSize: 12, gap: 10, headMb: 14, filterMb: 14, titleWeight: 700, display: false },
} as const;


/**
 * Superficie premium con arquitectura "double-bezel" (cáscara + núcleo):
 * una caja externa con hairline y fondo sutil envuelve el núcleo de contenido,
 * que tiene su propio fondo, brillo interno y radio concéntrico. Reacciona al
 * tema de Ant Design (claro/oscuro) vía tokens — sin colores hardcodeados.
 */
export const Surface: React.FC<{
  children: ReactNode;
  variant?:any;
  /** Padding interno del núcleo. */
  padding?: number | string;
  /** Eleva la tarjeta al pasar el puntero. */
  hover?: boolean;
  /**
   * Halo de acento difuso detrás de la tarjeta. `true` usa el acento del tema;
   * un string (p.ej. `'#ff0000'`) usa ese color como tinte del halo.
   */
  glow?: boolean | string;
  /** Retardo de la animación de entrada (segundos). */
  delay?: number;
  style?: CSSProperties;
  className?: string;
}> = ({ children, variant,padding = 20, hover = false, glow = false, delay = 0, style, className }) => {
  const { token } = useToken();
  const glowColor = typeof glow === 'string' ? glow : token.colorPrimary;

  return (
    <div
      className={`surface${hover ? ' surface-hover' : ''}${className ? ' ' + className : ''}`}
      style={{
        position: 'relative',
        padding: (variant==='template')?6:3,
        border: '5px solid transparent',
        background: `linear-gradient(${token.colorBgContainer}cc, ${token.colorBgContainer}cc) padding-box, linear-gradient(160deg, rgba(255, 255, 255, 0.95), var(--tenant-bg), rgba(255, 255, 255, 0.55)) border-box`,
        borderRadius: 8,
        boxShadow: `0 18px 40px -24px ${token.colorTextBase}33`,
        animation: `premiumEntrance 0.5s var(--ease-out) ${delay}s both`,
        ...style,
      }}
    >
      {glow && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: token.borderRadius,
            background: `radial-gradient(120% 120% at 0% 0%, ${glowColor}1a, transparent 80%)`,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          background: token.colorBgContainer,
          borderRadius: token.borderRadius,
          padding: (variant==='template')?padding:12,
          boxShadow: `inset 0 1px 0 ${token.colorBgElevated}, 0 1px 2px ${token.colorTextBase}0a`,
          height: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Micro-pill que precede a un titular. Teñida con el acento del tema. */
export const Eyebrow: React.FC<{ children: ReactNode; icon?: ReactNode }> = ({ children, icon }) => {
  const { token } = useToken();
  return (
    <span
      className="eyebrow"
      style={{
        color: token.colorPrimary,
        background: token.colorPrimaryBg,
        border: `1px solid ${token.colorPrimaryBorder}`,
      }}
    >
      {icon}
      {children}
    </span>
  );
};

/** Titular de display + eyebrow + subtítulo, con acciones a la derecha. */
export const TemplateTitle: React.FC<{
  eyebrow?: ReactNode;
  variant?:any;
  title: ReactNode;
  icon: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  config?: any;
  size?: number;
}> = ({ icon,variant,title, subtitle, extra, config, size = 34 }) => {
  const { token } = useToken();
  const hasHeadText = title != null || subtitle != null;

  return (
    <div className="ctmpl-head" style={{ marginBottom: config.gap }}>
      <div className="ctmpl-left" style={{ display: 'flex', alignItems: 'center', gap: config.gap, minWidth: 0 }}>
        {icon != null && (
          <div
            style={{
              width: config.iconBox,
              height: config.iconBox,
              borderRadius: config.iconRadius,
              background: (variant==='template')?`${token.colorPrimary}1f`:undefined,
              color: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: (variant==='template')?config.iconFont:config.iconFont-5,
              border:  (variant==='template')?`1px solid ${token.colorPrimary}29`:undefined,
              boxShadow: `inset 0 1px 0 ${token.colorBgElevated}`,
            }}
          >
            {icon}
          </div>
        )}
        {hasHeadText && (
          <div style={{ flex: 1, minWidth: 0 }}>
            {title != null && (
              <div
                className={config.display ? 'display-title' : undefined}
                style={{
                  fontSize: config.titleSize,
                  fontWeight: config.titleWeight,
                  color: token.colorTextHeading,
                  lineHeight: 1.15,
                  letterSpacing: '-0.01em',
                }}
              >


                {title}
              </div>
            )}
            {subtitle != null && (
              <div style={{ fontSize: config.subSize, color: token.colorTextSecondary, marginTop: 4 }}>{subtitle}</div>
            )}
          </div>
        )}
      </div>
      {extra != null && <div className="ctmpl-right">{extra}</div>}
    </div>
  );
};


interface ShellProps {
  /** Icono de cabecera (string o nodo). Se pinta en caja teñida con el acento. */
  icon?: ReactNode;
  /** Título de cabecera (string o nodo). */
  title: ReactNode;
  /** Subtítulo bajo el título (string o nodo). */
  subtitle?: ReactNode;
  /** Contenido alineado a la derecha de la cabecera (acciones, etc.). */
  extra?: ReactNode;
  /** Barra de filtros: va bajo la cabecera, antes del cuerpo. */
  filter?: ReactNode;
  /** Cuerpo que envuelve la plantilla. */
  children?: ReactNode;
  /** Muestra un skeleton en el cuerpo mientras carga lo local. */
  loading?: boolean;
  /**
   * Halo en el borde exterior. `true` (por defecto) usa el acento del tema;
   * un string (p.ej. `'#ff0000'`) tiñe el halo con ese color; `false` lo apaga.
   */
  glow?: boolean | string;
  style?: CSSProperties;
  className?: string;
}

/**
 * Cascarón común de plantilla: cabecera (icono + título + subtítulo a la
 * izquierda, ocupando la mitad en pantallas medias/grandes y el ancho completo
 * en pequeñas; extra a la derecha), barra de filtros debajo y luego el cuerpo.
 */
const TemplateShell: React.FC<ShellProps & { variant: keyof typeof SHELL_CFG }> = ({
  variant, icon, title, subtitle, extra, filter, children, loading = false, glow = true, style, className,
}) => {
  const c = SHELL_CFG[variant];
  return (
    <Surface variant={variant} style={{
      margin:0,
      marginBottom:(variant==='section'?c.gap:0),
      minHeight: (variant==='template')?'calc(-182px + 100vh)':undefined
      }} glow={glow}>
      <div className={className} style={style}>
        <TemplateTitle variant={variant} title={title} icon={icon} subtitle={subtitle} config={c} extra={extra} />

        {filter != null && (
          <div className="ctmpl-filter" style={{ marginBottom: children != null || loading ? c.filterMb : 0 }}>{filter}</div>
        )}

        {loading ? (
          <Skeleton active paragraph={{ rows: variant === 'template' ? 6 : 3 }} title={variant === 'template'} />
        ) : (
          children
        )}
      </div>
    </Surface>
  );
};

/** Plantilla de página: cabecera grande (display) + filtros + cuerpo. */
export const CustomTemplate: React.FC<ShellProps> = (props) => <TemplateShell variant="template" {...props} />;

/** Sección dentro de una página: misma estructura, tipografía/espaciado menores. */
export const CustomSection: React.FC<ShellProps> = (props) => <TemplateShell variant="section" {...props} />;

/** Título compacto para tarjetas de gráfica dentro de una Surface. */
export const ChartTitle: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token } = useToken();
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: token.colorTextSecondary,
        marginBottom: 14,
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </div>
  );
};

/** Separador de sección con eyebrow + hairline a lo ancho. */
export const SectionDivider: React.FC<{ icon?: ReactNode; children: ReactNode }> = ({ icon, children }) => {
  const { token } = useToken();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '28px 0 14px' }}>
      <Eyebrow icon={icon}>{children}</Eyebrow>
      <span style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
    </div>
  );
};
