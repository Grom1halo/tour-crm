import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useLanguage } from '../i18n/LanguageContext';

type SortKey = 'name' | 'article' | 'is_active';
type SortDir = 'asc' | 'desc';

const CompaniesPage: React.FC = () => {
  const { t } = useLanguage();
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', article: '', isActive: true });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.getCompanies(false);
      setCompanies(res.data);
    } catch { console.error('Failed to load companies'); }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...companies]
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) ||
                 (c.article || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      if (typeof av === 'boolean') av = av ? 1 : 0;
      if (typeof bv === 'boolean') bv = bv ? 1 : 0;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '▲' : '▼'}</span>
      : <span className="ml-1 text-gray-300">⇅</span>;

  const thCls = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 whitespace-nowrap';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await api.updateCompany(editing.id, formData);
      else await api.createCompany(formData);
      closeModal(); load();
    } catch (error: any) { alert(error.response?.data?.error || 'Ошибка сохранения'); }
  };

  const openEdit = (c: any) => { setEditing(c); setFormData({ name: c.name, article: c.article || '', isActive: c.is_active }); setShowModal(true); };
  const openCreate = () => { setEditing(null); setFormData({ name: '', article: '', isActive: true }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };
  const toggleActive = async (c: any) => {
    try { await api.updateCompany(c.id, { name: c.name, article: c.article, isActive: !c.is_active }); load(); }
    catch { alert('Ошибка'); }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.companiesTitle}</h1>
        <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">{t.companiesAdd}</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <input type="text" placeholder={t.companiesSearchHolder} value={search} onChange={e => setSearch(e.target.value)} className={inputCls} />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={thCls} onClick={() => handleSort('name')}>
                {t.companiesColName}<SortIcon k="name" />
              </th>
              <th className={thCls} onClick={() => handleSort('article')}>
                {t.companiesArticleLabel}<SortIcon k="article" />
              </th>
              <th className={thCls + ' text-center'} onClick={() => handleSort('is_active')}>
                {t.status}<SortIcon k="is_active" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">{t.noData}</td></tr>
            ) : sorted.map(c => (
              <tr key={c.id} className={`hover:bg-gray-50 ${!c.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3">
                  {c.article
                    ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-mono font-semibold">{c.article}</span>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.is_active ? t.companiesActive : t.companiesInactive}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">{t.editBtn}</button>
                  <button onClick={() => toggleActive(c)} className={`text-xs font-medium ${c.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}>
                    {c.is_active ? t.disableShort : t.enableShort}
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
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editing ? t.companiesEditTitle : t.companiesAddTitle}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.companiesNameLabel}</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputCls} required autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.companiesArticleLabel}</label>
                <input type="text" value={formData.article} onChange={e => setFormData({ ...formData, article: e.target.value })} className={inputCls} placeholder="ABC" />
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                  {t.companiesActiveLabel}
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

export default CompaniesPage;
