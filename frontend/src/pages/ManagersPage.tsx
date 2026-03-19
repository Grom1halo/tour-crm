import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useLanguage } from '../i18n/LanguageContext';

const ROLE_COLORS: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  manager:    'bg-blue-100 text-blue-700',
  hotline:    'bg-green-100 text-green-700',
  accountant: 'bg-yellow-100 text-yellow-700',
};

const ManagersPage: React.FC = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'manager',
    managerNumber: '',
    managerPhone: '',
    commissionPercentage: 0,
    isActive: true,
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.getManagers();
      setUsers(res.data);
    } catch { console.error('Failed to load users'); }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ fullName: '', username: '', password: '', role: 'manager', managerNumber: '', managerPhone: '', commissionPercentage: 0, isActive: true });
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setFormData({
      fullName: u.full_name,
      username: u.username,
      password: '',
      role: u.role,
      managerNumber: u.manager_number || '',
      managerPhone: u.manager_phone || '',
      commissionPercentage: Number(u.commission_percentage) || 0,
      isActive: u.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateUser(editing.id, formData);
      } else {
        await api.createUser(formData);
      }
      closeModal();
      load();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const [sortKey, setSortKey] = useState<'manager_number' | 'full_name' | 'role' | 'commission_percentage'>('manager_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    <span className="ml-1 opacity-50">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>;

  const sorted = users
    .filter(u => showInactive || u.is_active)
    .sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.managersTitle}</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="w-4 h-4"
            />
            {t.managersShowInactive}
          </label>
          <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">
            {t.managersAdd}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th onClick={() => handleSort('manager_number')} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none">{t.managersColNumber}<SortIcon k="manager_number" /></th>
              <th onClick={() => handleSort('full_name')} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none">{t.managersColName}<SortIcon k="full_name" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.managersColUsername}</th>
              <th onClick={() => handleSort('role')} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none">{t.managersColRole}<SortIcon k="role" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.managersColPhone}</th>
              <th onClick={() => handleSort('commission_percentage')} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none">{t.managersColCommission}<SortIcon k="commission_percentage" /></th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t.noData}</td></tr>
            ) : sorted.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full text-sm">
                    {u.manager_number || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.manager_phone || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{u.commission_percentage}%</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">{t.editBtn}</button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Деактивировать пользователя "${u.full_name}"?`)) return;
                      try { await api.deleteUser(u.id); load(); }
                      catch (err: any) { alert(err.response?.data?.error || 'Ошибка'); }
                    }}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >{t.deleteBtn}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? t.managersEditTitle : t.managersNewTitle}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t.managersNumberLabel}</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={formData.managerNumber}
                    onChange={e => setFormData({ ...formData, managerNumber: e.target.value })}
                    className={inputCls}
                    placeholder="01"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t.managersRoleLabel}</label>
                  <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className={inputCls}>
                    <option value="manager">{t.managersRoleManager}</option>
                    <option value="admin">{t.managersRoleAdmin}</option>
                    <option value="hotline">{t.managersRoleHotline}</option>
                    <option value="accountant">{t.managersRoleAccountant}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t.managersNameLabel}</label>
                <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className={inputCls} required autoFocus />
              </div>
              {!editing && (
                <div>
                  <label className={labelCls}>{t.managersUsernameLabel}</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className={inputCls} required />
                </div>
              )}
              <div>
                <label className={labelCls}>{editing ? t.managersPasswordLabel : t.managersNewPasswordLabel}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className={inputCls}
                  placeholder={editing ? t.managersPasswordHolder : ''}
                  required={!editing}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t.managersPhoneLabel}</label>
                  <input type="text" value={formData.managerPhone} onChange={e => setFormData({ ...formData, managerPhone: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.managersCommissionLabel}</label>
                  <input type="number" value={formData.commissionPercentage} onChange={e => setFormData({ ...formData, commissionPercentage: Number(e.target.value) })} step="0.01" className={inputCls} />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                  {t.managersActiveLabel}
                </label>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editing ? t.save : t.create}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagersPage;
