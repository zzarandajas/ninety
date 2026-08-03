import { UserOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';
import type { TenantMember } from '../lib/tenantApi';

function avatarSrc(avatarUrl?: string | null): string | undefined {
  return avatarUrl ? `/api${avatarUrl}` : undefined;
}

export function UserAvatar({ member, size }: { member?: TenantMember; size?: number | 'small' }) {
  return (
    <Avatar
      size={size ?? 'small'}
      src={avatarSrc(member?.avatarUrl)}
      icon={!member?.avatarUrl ? <UserOutlined /> : undefined}
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
