import { Avatar, Upload, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';

interface AvatarUploadResponse {
  avatarUrl: string;
}

export function AvatarUploader() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const displayUrl = previewUrl ?? (user?.avatarUrl ? `/api${user.avatarUrl}` : undefined);

  async function handleUpload(file: File) {
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await apiFetch<AvatarUploadResponse>('/auth/me/avatar', {
        method: 'POST',
        body: formData,
      });
      updateUser({ avatarUrl: response.avatarUrl });
    } catch {
      message.error('No se pudo subir la foto. Prueba con un PNG, JPEG o WEBP de menos de 2MB.');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
    return false;
  }

  return (
    <Upload
      name="avatar"
      showUploadList={false}
      beforeUpload={(file) => {
        handleUpload(file);
        return false;
      }}
      accept="image/png,image/jpeg,image/webp"
    >
      <div
        role="button"
        aria-label="Cambiar foto"
        style={{
          cursor: 'pointer',
          position: 'relative',
          display: 'inline-block',
          borderRadius: '50%',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          const overlay = e.currentTarget.querySelector('.avatar-hover-overlay') as HTMLElement;
          if (overlay) overlay.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          const overlay = e.currentTarget.querySelector('.avatar-hover-overlay') as HTMLElement;
          if (overlay) overlay.style.opacity = '0';
        }}
      >
        <Avatar
          size={100}
          src={displayUrl}
          icon={!displayUrl ? <UserOutlined /> : undefined}
          style={{
            opacity: uploading ? 0.5 : 1,
            backgroundColor: !displayUrl ? '#f0f2f5' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(0,0,0,0.05)',
          }}
        />
        {uploading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '50%',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
              ...
            </div>
          </div>
        )}
        {!uploading && (
          <div
            className="avatar-hover-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)',
              opacity: 0,
              transition: 'opacity 0.3s ease',
              borderRadius: '50%',
              color: 'white',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Cambiar foto
          </div>
        )}
      </div>
    </Upload>
  );
}
