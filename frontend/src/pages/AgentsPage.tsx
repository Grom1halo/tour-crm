import React, { useState, useEffect } from 'react';
import * as api from '../api';

const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', commissionPercentage: 0, isActive: true });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.getAgents(false);
      setAgents(res.data);
    } catch { console.error('Failed to load agents'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await api.updateAgent(editing.id, formData); }
      else { await api.createAgent(formData); }
      closeModal();
      load();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setFormData({ name: a.name, commissionPercentage: a.commission_percentage, isActive: a.is_active });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', commissionPercentage: 0, isActive: true });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const toggleActive = async (a: any) => {
    try {
      await api.updateAgent(a.id, { name: a.name, commissionPercentage: a.commission_percentage, isActive: !a.is_active });
      load();
    } catch { alert('Ошибка'); }
  };

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Агенты</h1>
        <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">+ Добавить</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <input type="text" placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)} className={inputCls} />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Имя агента</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Комиссия %</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Статус</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Нет данных</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} className={`hover:bg-gray-50 ${!a.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-semibold">
                    {Number(a.commission_percentage).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {a.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => openEdit(a)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Ред.</button>
                  <button onClick={() => toggleActive(a)} className={`text-xs font-medium ${a.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}>
                    {a.is_active ? 'Откл.' : 'Вкл.'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Редактировать агента' : 'Новый агент'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Имя *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputCls} required autoFocus />
              </div>
              <div>
                <label className={labelCls}>Комиссия %</label>
                <input type="number" value={formData.commissionPercentage} onChange={e => setFormData({ ...formData, commissionPercentage: Number(e.target.value) })} step="0.01" min="0" max="100" className={inputCls} />
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                  Активен
                </label>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editing ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
