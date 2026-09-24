import { useState, useEffect } from 'react';
import { getUsers, saveUser, deleteUser } from '@/lib/tauri-api';
import { Plus, Search, UserX, UserCheck, Mail } from 'lucide-react';
import type { User } from '@/types';

const roleColors: Record<string, string> = {
  ADMIN: 'badge-red',
  MANAGER: 'badge-blue',
  CASHIER: 'badge-green',
  INVENTORY: 'badge-yellow',
  ACCOUNTANT: 'badge-purple',
};

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
  }, []);

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">HR & User Management</h1>
          <p className="text-gray-500">{users.length} users • {users.filter(u => u.isActive).length} active</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="card">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input pl-9" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(user => (
            <div key={user.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                    {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {user.email}
                    </p>
                  </div>
                </div>
                <span className={`badge ${roleColors[user.role] || 'badge-gray'}`}>{user.role}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-1 text-sm">
                  {user.isActive ? (
                    <><UserCheck className="w-4 h-4 text-green-600" /> <span className="text-green-600">Active</span></>
                  ) : (
                    <><UserX className="w-4 h-4 text-red-600" /> <span className="text-red-600">Inactive</span></>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleToggle(user)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="text-xs bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <UserModal onClose={() => setShowAdd(false)} onSave={() => getUsers().then(setUsers)} />}
    </div>
  );

  async function handleToggle(user: User) {
    await saveUser({ ...user, isActive: !user.isActive });
    const updated = await getUsers();
    setUsers(updated);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return;
    await deleteUser(id);
    const updated = await getUsers();
    setUsers(updated);
  }
}

function UserModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [user, setUser] = useState<Partial<User>>({ role: 'CASHIER', isActive: true, permissions: [] });

  const handleSave = async () => {
    await saveUser({ ...(user as User), id: crypto.randomUUID(), createdAt: Date.now() });
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Add User</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <input className="input" value={user.fullName || ''} onChange={e => setUser({ ...user, fullName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input type="email" className="input" value={user.email || ''} onChange={e => setUser({ ...user, email: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <select className="input" value={user.role} onChange={e => setUser({ ...user, role: e.target.value as any })}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="CASHIER">Cashier</option>
              <option value="INVENTORY">Inventory</option>
              <option value="ACCOUNTANT">Accountant</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 btn-primary">Save User</button>
        </div>
      </div>
    </div>
  );
}
