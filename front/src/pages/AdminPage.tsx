import {
  BankOutlined,
  BgColorsOutlined,
  CloseOutlined,
  CrownOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { MembersTable } from '../components/MembersTable';
import { ModalTitle } from '../components/ModalTitle';
import { PeriodsManager } from '../components/PeriodsManager';
import { TenantBrandingForm } from '../components/TenantBrandingForm';
import { TenantEditDrawer } from '../components/TenantEditDrawer';
import { Template } from '../components/Template';
import { adminApi, type AdminTenant, type AdminUser } from '../lib/adminApi';
import { membershipsApi, type Membership, type TenantRole } from '../lib/membershipsApi';
import { profileApi } from '../lib/profileApi';
import { seatsApi, type Seat } from '../lib/seatsApi';
import { slugify } from '../lib/slugify';
import { useAuthStore } from '../store/authStore';

export function AdminPage() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const tenants = useAuthStore((state) => state.tenants);

  // Active tenant membership state
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // All tenants state
  const [allTenants, setAllTenants] = useState<AdminTenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [createTenantModalOpen, setCreateTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null);

  // Tenant members drawer state
  const [selectedTenant, setSelectedTenant] = useState<AdminTenant | null>(null);
  const [tenantMembers, setTenantMembers] = useState<Membership[]>([]);
  const [loadingTenantMembers, setLoadingTenantMembers] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  // Platform users state
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userToAssign, setUserToAssign] = useState<AdminUser | null>(null);

  const activeTenantRole = tenants.find((t) => t.tenantId === activeTenantId)?.role;
  const canManage = activeTenantRole === 'owner' || activeTenantRole === 'admin';

  // Load active tenant data
  const loadActiveTenantData = useCallback(async () => {
    if (!activeTenantId) return;
    try {
      const [membersData, seatsData] = await Promise.all([
        membershipsApi.list(),
        seatsApi.list(),
      ]);
      setMemberships(membersData);
      setSeats(seatsData);
    } catch {
      message.error('No se pudieron cargar los datos de la empresa actual');
    }
  }, [activeTenantId]);

  // Load all tenants
  const loadAllTenants = useCallback(async () => {
    setLoadingTenants(true);
    try {
      const data = await adminApi.listTenants();
      setAllTenants(data);
    } catch {
      message.error('No se pudo cargar la lista de empresas');
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  // Load all platform users
  const loadAllUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await adminApi.listUsers();
      setAllUsers(data);
    } catch {
      message.error('No se pudo cargar la lista de usuarios');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadActiveTenantData();
    loadAllTenants();
    loadAllUsers();
  }, [loadActiveTenantData, loadAllTenants, loadAllUsers]);

  // Handle drawer open for a specific tenant
  const openTenantDrawer = async (tenant: AdminTenant) => {
    setSelectedTenant(tenant);
    setLoadingTenantMembers(true);
    try {
      const data = await adminApi.listTenantMembers(tenant.id);
      setTenantMembers(data);
    } catch {
      message.error('Error al cargar miembros de la empresa');
    } finally {
      setLoadingTenantMembers(false);
    }
  };

  // Create new tenant
  const [tenantForm] = Form.useForm();
  const [slugTouched, setSlugTouched] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (!slugTouched) {
      tenantForm.setFieldValue('slug', slugify(newName));
    }
  };

  const handleCreateTenant = async (values: {
    name: string;
    slug?: string;
    timezone?: string;
    bgColor?: string;
    accentColor?: string;
  }) => {
    try {
      const generatedSlug = values.slug ? slugify(values.slug) : slugify(values.name);
      await adminApi.createTenant({
        name: values.name.trim(),
        slug: generatedSlug,
        timezone: values.timezone || 'Europe/Madrid',
        bgColor: values.bgColor || '#ffffff',
        accentColor: values.accentColor || '#16983c',
      });
      message.success('Empresa creada correctamente');
      setCreateTenantModalOpen(false);
      tenantForm.resetFields();
      setSlugTouched(false);
      loadAllTenants();

      // Refresh auth store memberships so user can switch to the new tenant immediately
      const meData = await profileApi.getMe();
      useAuthStore.setState({ tenants: meData.memberships });
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Error al crear la empresa';
      message.error(errorMsg);
    }
  };

  // Add member to specific tenant from drawer
  const [addMemberForm] = Form.useForm();
  const handleAddMemberToTenant = async (values: { email: string; fullName: string; role: TenantRole }) => {
    if (!selectedTenant) return;
    try {
      await adminApi.addTenantMember(selectedTenant.id, {
        email: values.email.trim(),
        fullName: values.fullName.trim(),
        role: values.role,
      });
      message.success('Usuario añadido a la empresa');
      setAddMemberModalOpen(false);
      addMemberForm.resetFields();
      openTenantDrawer(selectedTenant);
      loadAllTenants();
    } catch {
      message.error('Error al añadir usuario a la empresa');
    }
  };

  // Assign user to tenant from All Users tab
  const [assignForm] = Form.useForm();
  const handleAssignUserToTenant = async (values: { tenantId: string; role: TenantRole }) => {
    if (!userToAssign) return;
    try {
      await adminApi.addTenantMember(values.tenantId, {
        email: userToAssign.email,
        fullName: userToAssign.fullName,
        role: values.role,
      });
      message.success(`Usuario asignado a la empresa`);
      setUserToAssign(null);
      assignForm.resetFields();
      loadAllUsers();
      loadAllTenants();
    } catch {
      message.error('Error al asignar usuario a la empresa');
    }
  };

  return (
    <Template
      title="Panel de Administración"
      icon={<SettingOutlined />}
      subtitle="Administración de empresas, usuarios, roles, periodos y marca."
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Tabs
          type="card"
          items={[
          {
            key: 'active-tenant-members',
            label: (
              <span>
                <TeamOutlined /> Membresía Actual
              </span>
            ),
            children: (
              <Card
                className="glass-card"
                extra={
                  canManage && (
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => setInviteModalOpen(true)}
                    >
                      Invitar Miembro
                    </Button>
                  )
                }
              >
                <MembersTable
                  memberships={memberships}
                  seats={seats}
                  canManage={canManage}
                  canResetOwner={activeTenantRole === 'owner'}
                  onChanged={loadActiveTenantData}
                />
              </Card>
            ),
          },
          ...(canManage
            ? [
                {
                  key: 'active-tenant-branding',
                  label: (
                    <span>
                      <BgColorsOutlined /> Marca y Apariencia
                    </span>
                  ),
                  children: <TenantBrandingForm />,
                },
              ]
            : []),
          ...(canManage
            ? [
                {
                  key: 'active-tenant-periods',
                  label: (
                    <span>
                      <BankOutlined /> Periodos
                    </span>
                  ),
                  children: <PeriodsManager />,
                },
              ]
            : []),
          {
            key: 'tenants-management',
            label: (
              <span>
                <BankOutlined /> {activeTenantRole === 'owner' ? 'Empresas / Tenants' : 'Empresa'}
              </span>
            ),
            children: (
              <Card
                className="glass-card"
                extra={
                  activeTenantRole === 'owner' && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateTenantModalOpen(true)}
                    >
                      Nueva Empresa
                    </Button>
                  )
                }
              >
                <Table
                  dataSource={allTenants}
                  rowKey="id"
                  loading={loadingTenants}
                  columns={[
                    {
                      title: 'Empresa',
                      dataIndex: 'name',
                      key: 'name',
                      render: (text, record) => (
                        <Space size={10}>
                          {record.isotypeUrl ? (
                            <img
                              src={`/api${record.isotypeUrl}`}
                              alt=""
                              style={{ width: 22, height: 22, objectFit: 'contain' }}
                            />
                          ) : record.logoUrl ? (
                            <img
                              src={`/api${record.logoUrl}`}
                              alt=""
                              style={{ width: 22, height: 22, objectFit: 'contain' }}
                            />
                          ) : (
                            <BankOutlined style={{ color: record.accentColor || '#1890ff', fontSize: 18 }} />
                          )}
                          <Typography.Text strong>{text}</Typography.Text>
                        </Space>
                      ),
                    },
                    {
                      title: 'Slug',
                      dataIndex: 'slug',
                      key: 'slug',
                      render: (slug) => <Tag color="blue">{slug}</Tag>,
                    },
                    {
                      title: 'Marca / Colores',
                      key: 'branding',
                      render: (_, record) => (
                        <Space size={6}>
                          <span
                            title={`Fondo: ${record.bgColor || '#ffffff'}`}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              backgroundColor: record.bgColor || '#ffffff',
                              border: '1px solid #ccc',
                              display: 'inline-block',
                            }}
                          />
                          <span
                            title={`Acento: ${record.accentColor || '#16983c'}`}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              backgroundColor: record.accentColor || '#16983c',
                              display: 'inline-block',
                            }}
                          />
                        </Space>
                      ),
                    },
                    {
                      title: 'Zona Horaria',
                      dataIndex: 'timezone',
                      key: 'timezone',
                    },
                    {
                      title: 'Miembros',
                      key: 'membersCount',
                      render: (_, record) => record._count?.memberships ?? 0,
                    },
                    {
                      title: 'Acciones',
                      key: 'actions',
                      render: (_, record) => (
                        <Space wrap>
                          <Button
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => setEditingTenant(record)}
                          >
                            Personalizar Marca
                          </Button>
                          <Button type="link" icon={<TeamOutlined />} onClick={() => openTenantDrawer(record)}>
                            Gestionar Miembros
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          ...(activeTenantRole === 'owner'
            ? [
                {
                  key: 'users-management',
                  label: (
                    <span>
                      <UserOutlined /> Todos los Usuarios
                    </span>
                  ),
                  children: (
                    <Card className="glass-card">
                      <Table
                        dataSource={allUsers}
                        rowKey="id"
                        loading={loadingUsers}
                        columns={[
                          {
                            title: 'Usuario',
                            key: 'user',
                            render: (_: unknown, record: AdminUser) => (
                              <Space>
                                <Avatar
                                  src={record.avatarUrl ? `/api${record.avatarUrl}` : undefined}
                                  icon={!record.avatarUrl ? <UserOutlined /> : undefined}
                                />
                                <div>
                                  <Typography.Text strong>{record.fullName}</Typography.Text>
                                  <br />
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    {record.email}
                                  </Typography.Text>
                                </div>
                              </Space>
                            ),
                          },
                          {
                            title: 'Empresas Asignadas',
                            key: 'memberships',
                            render: (_: unknown, record: AdminUser) => (
                              <Space wrap>
                                {record.memberships.map((m) => (
                                  <Tag
                                    key={m.id}
                                    color={m.role === 'owner' ? 'gold' : m.role === 'admin' ? 'blue' : 'default'}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    {m.tenant.name}
                                    {m.role === 'owner' ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: 'rgba(250, 173, 20, 0.25)',
                                          borderRadius: 4,
                                          padding: '1px 4px',
                                          marginLeft: 2,
                                        }}
                                      >
                                        <CrownOutlined style={{ fontSize: 11, color: '#d48806' }} />
                                      </span>
                                    ) : m.role === 'admin' ? (
                                      <span style={{ fontSize: 11, opacity: 0.7 }}>admin</span>
                                    ) : null}
                                  </Tag>
                                ))}
                              </Space>
                            ),
                          },
                          {
                            title: 'Acciones',
                            key: 'actions',
                            render: (_: unknown, record: AdminUser) => (
                              <Button
                                type="link"
                                icon={<UserAddOutlined />}
                                onClick={() => {
                                  setUserToAssign(record);
                                  assignForm.resetFields();
                                }}
                              >
                                Añadir a Empresa
                              </Button>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />

      {/* Invite Member Modal for Active Tenant */}
      <InviteMemberModal
        open={inviteModalOpen}
        canGrantOwner={activeTenantRole === 'owner'}
        onClose={() => setInviteModalOpen(false)}
        onInvited={loadActiveTenantData}
      />

      {/* Modal Nueva Empresa */}
      <Modal
        title={
          <ModalTitle
            icon={<BankOutlined />}
            title="Crear Nueva Empresa"
            subtitle="Registra una nueva organización y sus parámetros iniciales."
          />
        }
        open={createTenantModalOpen}
        onCancel={() => {
          setCreateTenantModalOpen(false);
          setSlugTouched(false);
        }}
        footer={null}
      >
        <Form form={tenantForm} layout="vertical" onFinish={handleCreateTenant}>
          <Form.Item
            label="Nombre de la Empresa"
            name="name"
            rules={[{ required: true, message: 'Ingresa el nombre de la empresa' }]}
          >
            <Input
              placeholder="Ej. Tasvalor / Cionet"
              onChange={handleNameChange}
            />
          </Form.Item>

          <Form.Item
            label="Identificador Único (Slug)"
            name="slug"
            extra="Se propone automáticamente según el nombre. Puedes modificarlo si lo deseas."
            rules={[
              { required: true, message: 'Ingresa un slug' },
              { pattern: /^[a-z0-9-]+$/, message: 'Solo letras minúsculas, números y guiones' },
            ]}
          >
            <Input
              placeholder="ej. tasvalor"
              onChange={() => setSlugTouched(true)}
            />
          </Form.Item>

          <Form.Item label="Color de Fondo Inicial" name="bgColor" initialValue="#eef7f2">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Form.Item name="bgColor" noStyle>
                <input
                  type="color"
                  style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  onChange={(e) => tenantForm.setFieldValue('bgColor', e.target.value)}
                />
              </Form.Item>
              <Form.Item name="bgColor" noStyle>
                <Input style={{ width: 120 }} placeholder="#eef7f2" />
              </Form.Item>
            </div>
          </Form.Item>

          <Form.Item label="Color de Acento Inicial" name="accentColor" initialValue="#16983c">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Form.Item name="accentColor" noStyle>
                <input
                  type="color"
                  style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  onChange={(e) => tenantForm.setFieldValue('accentColor', e.target.value)}
                />
              </Form.Item>
              <Form.Item name="accentColor" noStyle>
                <Input style={{ width: 120 }} placeholder="#16983c" />
              </Form.Item>
            </div>
          </Form.Item>

          <Form.Item label="Zona Horaria" name="timezone" initialValue="Europe/Madrid">
            <Select>
              <Select.Option value="Europe/Madrid">Europe/Madrid</Select.Option>
              <Select.Option value="UTC">UTC</Select.Option>
              <Select.Option value="America/New_York">America/New_York</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button icon={<CloseOutlined />} onClick={() => {
                setCreateTenantModalOpen(false);
                setSlugTouched(false);
              }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                Crear Empresa
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer para gestionar miembros de una empresa específica */}
      <Drawer
        title={selectedTenant ? `Miembros de ${selectedTenant.name}` : 'Miembros'}
        width={600}
        open={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
        extra={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setAddMemberModalOpen(true)}
          >
            Añadir Miembro
          </Button>
        }
      >
        <Table
          dataSource={tenantMembers}
          rowKey="id"
          loading={loadingTenantMembers}
          pagination={false}
          columns={[
            {
              title: 'Usuario',
              key: 'user',
              render: (_, record) => (
                <div>
                  <Typography.Text strong>{record.user.fullName}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {record.user.email}
                  </Typography.Text>
                </div>
              ),
            },
            {
              title: 'Rol',
              dataIndex: 'role',
              key: 'role',
              render: (role, record) => (
                <Select
                  value={role}
                  style={{ width: 110 }}
                  onChange={async (newRole) => {
                    try {
                      await adminApi.updateMembership(record.id, { role: newRole as TenantRole });
                      message.success('Rol actualizado');
                      if (selectedTenant) openTenantDrawer(selectedTenant);
                    } catch {
                      message.error('No se pudo actualizar el rol');
                    }
                  }}
                >
                  <Select.Option value="owner">Owner</Select.Option>
                  <Select.Option value="admin">Admin</Select.Option>
                  <Select.Option value="member">Member</Select.Option>
                </Select>
              ),
            },
            {
              title: 'Estado',
              dataIndex: 'isActive',
              key: 'isActive',
              render: (isActive, record) => (
                <Tag
                  color={isActive ? 'green' : 'red'}
                  style={{ cursor: 'pointer' }}
                  onClick={async () => {
                    try {
                      await adminApi.updateMembership(record.id, { isActive: !isActive });
                      message.success(isActive ? 'Usuario desactivado' : 'Usuario activado');
                      if (selectedTenant) openTenantDrawer(selectedTenant);
                    } catch {
                      message.error('No se pudo cambiar el estado');
                    }
                  }}
                >
                  {isActive ? 'ACTIVO' : 'INACTIVO'}
                </Tag>
              ),
            },
          ]}
        />
      </Drawer>

      {/* Modal Añadir Miembro dentro del Drawer */}
      <Modal
        title={
          <ModalTitle
            icon={<UserAddOutlined />}
            title={selectedTenant ? `Añadir Miembro a ${selectedTenant.name}` : 'Añadir Miembro'}
            subtitle="Añade a un usuario existente con su rol en la empresa."
          />
        }
        open={addMemberModalOpen}
        onCancel={() => setAddMemberModalOpen(false)}
        footer={null}
      >
        <Form form={addMemberForm} layout="vertical" onFinish={handleAddMemberToTenant}>
          <Form.Item
            label="Correo Electrónico"
            name="email"
            rules={[{ required: true, type: 'email', message: 'Ingresa un correo válido' }]}
          >
            <Input placeholder="usuario@empresa.com" />
          </Form.Item>

          <Form.Item
            label="Nombre Completo"
            name="fullName"
            rules={[{ required: true, message: 'Ingresa el nombre' }]}
          >
            <Input placeholder="Nombre y Apellidos" />
          </Form.Item>

          <Form.Item label="Rol" name="role" initialValue="member">
            <Select>
              <Select.Option value="member">Miembro</Select.Option>
              <Select.Option value="admin">Administrador</Select.Option>
              <Select.Option value="owner">Propietario (Owner)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button icon={<CloseOutlined />} onClick={() => setAddMemberModalOpen(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}>
                Añadir Usuario
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Asignar Usuario a Empresa desde Todos los Usuarios */}
      <Modal
        title={
          <ModalTitle
            icon={<TeamOutlined />}
            title={userToAssign ? `Añadir ${userToAssign.fullName} a una Empresa` : 'Asignar a Empresa'}
            subtitle="Asigna el usuario a una organización y define su rol."
          />
        }
        open={!!userToAssign}
        onCancel={() => setUserToAssign(null)}
        footer={null}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignUserToTenant}>
          <Form.Item
            label="Empresa / Tenant"
            name="tenantId"
            rules={[{ required: true, message: 'Selecciona una empresa' }]}
          >
            <Select placeholder="Selecciona la empresa">
              {allTenants.map((t) => (
                <Select.Option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Rol en la Empresa" name="role" initialValue="member">
            <Select>
              <Select.Option value="member">Miembro</Select.Option>
              <Select.Option value="admin">Administrador</Select.Option>
              <Select.Option value="owner">Propietario (Owner)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button icon={<CloseOutlined />} onClick={() => setUserToAssign(null)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" icon={<BankOutlined />}>
                Asignar a Empresa
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Personalizar Marca & Editar Empresa */}
      <TenantEditDrawer
        tenant={editingTenant}
        onClose={() => setEditingTenant(null)}
        onUpdated={() => {
          loadAllTenants();
          loadActiveTenantData();
        }}
      />
      </div>
    </Template>
  );
}
