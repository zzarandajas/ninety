import { Select } from 'antd';
import type { CSSProperties } from 'react';
import type { TenantMember } from '../lib/tenantApi';
import { UserAvatar } from './UserAvatar';

export interface UserSelectProps {
  members: TenantMember[];
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function UserSelect({
  members,
  value,
  onChange,
  placeholder,
  allowClear,
  disabled,
  style,
  ariaLabel,
}: UserSelectProps) {
  const byUser = new Map(members.map((m) => [m.userId, m]));

  function renderOption(userId?: string | number | null) {
    const member = userId ? byUser.get(String(userId)) : undefined;
    if (!member) return null;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', gap: 8 }}>
        <UserAvatar member={member} />
        {member.fullName}
      </span>
    );
  }

  return (
    <Select
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={allowClear}
      disabled={disabled}
      style={style}
      options={members.map((m) => ({ value: m.userId, label: m.fullName }))}
      optionRender={(option) => renderOption(option.value)}
      labelRender={(option) => renderOption(option.value)}
    />
  );
}
