import { LogoutOutlined, WarningOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useAuthStore } from '../store/authStore';

/**
 * Banner rojo que se muestra mientras el owner está simulando la sesión de
 * otro usuario. Incluye el botón para salir de la simulación y volver a la
 * sesión original.
 */
export function ImpersonationBanner() {
  const user = useAuthStore((state) => state.user);
  const stopImpersonation = useAuthStore((state) => state.stopImpersonation);

  return (
    <div className="impersonation-banner" role="status">
      <div className="impersonation-banner__text">
        <WarningOutlined />
        <span>
          <strong>Modo dios activo</strong> — estás actuando como{' '}
          <strong>{user?.fullName}</strong> ({user?.email})
        </span>
      </div>
      <Button
        className="impersonation-banner__exit"
        size="small"
        onClick={stopImpersonation}
        icon={<LogoutOutlined />}
      >
        Salir de la simulación
      </Button>
    </div>
  );
}
