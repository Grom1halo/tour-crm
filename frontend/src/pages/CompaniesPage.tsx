import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import { useLanguage } from '../i18n/LanguageContext';

type SortKey = 'name' | 'article' | 'is_active';
type SortDir = 'asc' | 'desc';

const TOUR_TYPE_COLORS: Record<string, string> = {
  group: 'bg-blue-100 text-blue-700',
  individual: 'bg-purple-100 text-purple-700',
  tourflot: 'bg-teal-100 text-teal-700',
};

const CompaniesPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', article: '', isActive: true });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [companyTours, setCompanyTours] = useState<Record<number, any[]>>({});
  const [editingTourPrice, setEditingTourPrice] = useState<any>(null);
  const [priceForm, setPriceForm] = useState({ adultNet: 0, childNet: 0 });

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

  const openPriceEdit = (tour: any) => {
    setEditingTourPrice(tour);
    setPriceForm({ adultNet: Number(tour.adult_net) || 0, childNet: Number(tour.child_net) || 0 });
  };

  const handlePriceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTourPrice.price_id) {
        await api.updateTourPrice(editingTourPrice.price_id, {
          adultNet: priceForm.adultNet,
          childNet: priceForm.childNet,
          adultSale: editingTourPrice.adult_sale ?? priceForm.adultNet,
          childSale: editingTourPrice.child_sale ?? priceForm.childNet,
          infantNet: editingTourPrice.infant_net ?? 0,
          infantSale: editingTourPrice.infant_sale ?? 0,
          transferNet: editingTourPrice.transfer_net ?? 0,
          transferSale: editingTourPrice.transfer_sale ?? 0,
          otherNet: editingTourPrice.other_net ?? 0,
          otherSale: editingTourPrice.other_sale ?? 0,
          validFrom: editingTourPrice.valid_from,
          validTo: editingTourPrice.valid_to,
          isActive: true,
        });
      } else {
        await api.createTourPrice({
          tourId: String(editingTourPrice.id),
          companyId: String(editingTourPrice.company_id),
          validFrom: '2020-01-01',
          validTo: '2099-12-31',
          adultNet: priceForm.adultNet,
          childNet: priceForm.childNet,
          adultSale: priceForm.adultNet,
          childSale: priceForm.childNet,
          infantNet: 0, transferNet: 0, otherNet: 0,
          infantSale: 0, transferSale: 0, otherSale: 0,
          article: '',
        });
      }
      // Refresh tours for the company
      const companyId = editingTourPrice.company_id;
      const res = await api.getToursByCompany(companyId);
      setCompanyTours(prev => ({ ...prev, [companyId]: res.data }));
      setEditingTourPrice(null);
    } catch (err: any) { alert(err.response?.data?.error || 'Ошибка сохранения'); }
  };
  const toggleActive = async (c: any) => {
    try { await api.updateCompany(c.id, { name: c.name, article: c.article, isActive: !c.is_active }); load(); }
    catch { alert('Ошибка'); }
  };

  const toggleExpand = async (c: any) => {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    try {
      const res = await api.getToursByCompany(c.id);
      setCompanyTours(prev => ({ ...prev, [c.id]: res.data }));
    } catch { setCompanyTours(prev => ({ ...prev, [c.id]: [] })); }
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
              <React.Fragment key={c.id}>
                <tr className={`hover:bg-gray-50 ${!c.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <button onClick={() => toggleExpand(c)} className="mr-2 text-gray-400 hover:text-blue-600 transition text-xs">
                      {expandedId === c.id ? '▼' : '▶'}
                    </button>
                    {c.name}
                  </td>
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
                {expandedId === c.id && (
                  <tr>
                    <td colSpan={4} className="bg-gray-50 px-8 py-3 border-b border-gray-100">
                      {!companyTours[c.id] ? (
                        <span className="text-gray-400 text-xs">Загрузка...</span>
                      ) : companyTours[c.id].length === 0 ? (
                        <span className="text-gray-400 text-xs">Туры не найдены</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {companyTours[c.id].map((tour: any) => (
                            <div key={tour.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${TOUR_TYPE_COLORS[tour.tour_type] || 'bg-gray-100 text-gray-600'}`}>
                                  {tour.tour_type === 'group' ? 'Гр' : tour.tour_type === 'individual' ? 'Инд' : 'ТФ'}
                                </span>
                                <span className="text-sm text-gray-800">{tour.name}</span>
                                {tour.adult_net != null && (
                                  <span className="text-xs text-gray-500 bg-gray-50 rounded px-1.5 py-0.5 border border-gray-200">
                                    net Взрослый ฿{Number(tour.adult_net).toFixed(0)}
                                    {Number(tour.child_net) > 0 && ` / net Ребенок ฿${Number(tour.child_net).toFixed(0)}`}
                                  </span>
                                )}
                                {tour.price_updated_at && (
                                  <span className="text-xs text-gray-400">
                                    {new Date(tour.price_updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <button
                                  onClick={() => openPriceEdit(tour)}
                                  className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                                >
                                  ✏ net
                                </button>
                                <button
                                  onClick={() => navigate(`/tours?companyId=${c.id}`)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                                >
                                  Цены →
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {editingTourPrice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xs">
            <h2 className="text-base font-bold text-gray-800 mb-1">Net цена</h2>
            <p className="text-xs text-gray-500 mb-4">{editingTourPrice.name}</p>
            <form onSubmit={handlePriceSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Net Взрослый ฿</label>
                <input
                  type="number" min="0" value={priceForm.adultNet} autoFocus
                  onChange={e => setPriceForm(f => ({ ...f, adultNet: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Net Ребенок ฿</label>
                <input
                  type="number" min="0" value={priceForm.childNet}
                  onChange={e => setPriceForm(f => ({ ...f, childNet: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingTourPrice(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
