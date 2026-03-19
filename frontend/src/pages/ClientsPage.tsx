import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useLanguage } from '../i18n/LanguageContext';

const PAGE_SIZE = 50;

const ClientsPage: React.FC = () => {
  const { t } = useLanguage();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });

  useEffect(() => { setPage(0); loadClients(); }, [search]);

  const loadClients = async () => {
    try {
      const response = await api.getClients(search);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) await api.updateClient(editingClient.id, formData);
      else await api.createClient(formData);
      setShowModal(false);
      setFormData({ name: '', phone: '' });
      setEditingClient(null);
      loadClients();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save client');
    }
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setFormData({ name: client.name, phone: client.phone });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t.clientsDeleteConfirm)) return;
    try { await api.deleteClient(id); loadClients(); }
    catch { alert('Failed to delete client'); }
  };

  const totalPages = Math.ceil(clients.length / PAGE_SIZE);
  const paginated  = clients.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.clientsTitle}</h1>
        <button
          onClick={() => { setEditingClient(null); setFormData({ name: '', phone: '' }); setShowModal(true); }}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm"
        >
          {t.clientsAdd}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <input
          type="text"
          placeholder={t.clientsSearchHolder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inputCls}
        />
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm px-4 py-12 text-center text-gray-400">{t.noData}</div>
      ) : (
        <>
        <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
          <span>Найдено: {clients.length} | Страница {page + 1} из {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-50"
            >«</button>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-50"
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter(i => Math.abs(i - page) <= 2)
              .map(i => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`px-3 py-1 rounded border text-sm ${i === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
                >{i + 1}</button>
              ))}
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-50"
            >›</button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-50"
            >»</button>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">{t.clientsNameLabel}</th>
                <th className="text-left px-4 py-2 font-medium">{t.clientsPhoneLabel}</th>
                <th className="text-left px-4 py-2 font-medium">{t.clientsColManager}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((client, idx) => (
                <tr key={client.id} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2 font-medium text-gray-800">{client.name}</td>
                  <td className="px-4 py-2">
                    <a href={`tel:${client.phone}`} className="text-blue-600 hover:text-blue-800 font-mono">
                      {client.phone}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{client.manager_name || '—'}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleEdit(client)} className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3">{t.editBtn}</button>
                    <button onClick={() => handleDelete(client.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">{t.deleteBtn}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingClient ? t.clientsEditTitle : t.clientsAddTitle}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.clientsNameLabel}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.clientsPhoneLabel}</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingClient(null); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  {editingClient ? t.clientsSave : t.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
