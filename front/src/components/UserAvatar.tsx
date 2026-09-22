import { UserOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';
import type { TenantMember } from '../lib/tenantApi';
import { useAuthStore } from '../store/authStore';

function avatarSrc(avatarUrl?: string | null): string | undefined {
  return avatarUrl ? `/api${avatarUrl}` : undefined;
}

export function UserAvatar({ member, size }: { member?: TenantMember; size?: number | 'small' }) {
  const currentUser = useAuthStore((state) => state.user);

  // Si el member es el usuario actual, usamos su avatar actualizado del store en tiempo real
  const isCurrentUser = member && currentUser && member.userId === currentUser.id;
  const resolvedAvatarUrl = isCurrentUser ? currentUser.avatarUrl : member?.avatarUrl;

  return (
    <Avatar
      size={size ?? 'small'}
      src={avatarSrc(resolvedAvatarUrl)}
      icon={!resolvedAvatarUrl ? <UserOutlined /> : undefined}
    />
  );
}

export function MemberCell({ member, fallback = '—' }: { member?: TenantMember; fallback?: string }) {
  if (!member) return <span>{fallback}</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        gap: 8,
      }}
    >
      <UserAvatar member={member} />
      {member.fullName}
    </span>
  );
}
