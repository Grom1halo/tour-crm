import React, { useState, useEffect } from 'react';
import * as api from '../api';

const TOUR_TYPE_LABELS: Record<string, string> = {
  group: 'Групповой',
  individual: 'Индивидуальный',
  tourflot: 'ТурФлот',
};

const ToursPage: React.FC = () => {
  const [tours, setTours] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tourPrices, setTourPrices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editingPrice, setEditingPrice] = useState<any>(null);
  const [selectedTour, setSelectedTour] = useState<any>(null);

  const [formData, setFormData] = useState({ name: '', tourType: 'group', isActive: true });
  const [priceForm, setPriceForm] = useState({
    tourId: '', companyId: '', validFrom: '', validTo: '',
    adultNet: 0, childNet: 0, infantNet: 0, transferNet: 0, otherNet: 0,
    adultSale: 0, childSale: 0, infantSale: 0, transferSale: 0, otherSale: 0,
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [toursRes, companiesRes] = await Promise.all([api.getTours(undefined, false), api.getCompanies(false)]);
      setTours(toursRes.data);
      setCompanies(companiesRes.data);
    } catch { console.error('Failed to load tours'); }
  };

  const loadPrices = async (tourId: number) => {
    try {
      const res = await api.getTourPricesList(tourId);
      setTourPrices(res.data);
    } catch { console.error('Failed to load prices'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await api.updateTour(editing.id, formData); }
      else { await api.createTour(formData); }
      closeModal();
      load();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPrice) { await api.updateTourPrice(editingPrice.id, priceForm); }
      else { await api.createTourPrice(priceForm); }
      closePriceModal();
      if (selectedTour) loadPrices(selectedTour.id);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения цены');
    }
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setFormData({ name: t.name, tourType: t.tour_type, isActive: t.is_active });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', tourType: 'group', isActive: true });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const openPrices = (t: any) => {
    setSelectedTour(t);
    loadPrices(t.id);
  };

  const openAddPrice = () => {
    setEditingPrice(null);
    setPriceForm({
      tourId: String(selectedTour.id), companyId: '', validFrom: '', validTo: '',
      adultNet: 0, childNet: 0, infantNet: 0, transferNet: 0, otherNet: 0,
      adultSale: 0, childSale: 0, infantSale: 0, transferSale: 0, otherSale: 0,
    });
    setShowPriceModal(true);
  };

  const openEditPrice = (p: any) => {
    setEditingPrice(p);
    setPriceForm({
      tourId: p.tour_id, companyId: p.company_id,
      validFrom: p.valid_from?.split('T')[0] || '',
      validTo: p.valid_to?.split('T')[0] || '',
      adultNet: p.adult_net, childNet: p.child_net, infantNet: p.infant_net, transferNet: p.transfer_net, otherNet: p.other_net,
      adultSale: p.adult_sale, childSale: p.child_sale, infantSale: p.infant_sale, transferSale: p.transfer_sale, otherSale: p.other_sale,
    });
    setShowPriceModal(true);
  };

  const closePriceModal = () => { setShowPriceModal(false); setEditingPrice(null); };

  const toggleActive = async (t: any) => {
    try {
      await api.updateTour(t.id, { name: t.name, tourType: t.tour_type, isActive: !t.is_active });
      load();
    } catch { alert('Ошибка'); }
  };

  const filtered = tours.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    (typeFilter === '' || t.tour_type === typeFilter)
  );

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div>
      {selectedTour ? (
        /* ── Prices view ── */
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setSelectedTour(null)} className="text-blue-600 hover:underline text-sm">← Назад</button>
            <h1 className="text-xl font-bold text-gray-800">Цены: {selectedTour.name}</h1>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{TOUR_TYPE_LABELS[selectedTour.tour_type]}</span>
            <button onClick={openAddPrice} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Добавить цену</button>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Компания</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Период</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Net (взр/реб)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Sale (взр/реб)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Трансфер</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tourPrices.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Цены не заданы</td></tr>
                ) : tourPrices.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{p.company_name}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {p.valid_from?.split('T')[0]} — {p.valid_to?.split('T')[0]}
                    </td>
                    <td className="px-3 py-2 text-right">฿{p.adult_net} / ฿{p.child_net}</td>
                    <td className="px-3 py-2 text-right">฿{p.adult_sale} / ฿{p.child_sale}</td>
                    <td className="px-3 py-2 text-right">฿{p.transfer_net} / ฿{p.transfer_sale}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => openEditPrice(p)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Ред.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Tours list ── */
        <div>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Туры</h1>
            <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">+ Добавить</button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex gap-3">
            <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className={inputCls} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
              <option value="">Все типы</option>
              <option value="group">Групповой</option>
              <option value="individual">Индивидуальный</option>
              <option value="tourflot">ТурФлот</option>
            </select>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Название</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Тип</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Нет данных</td></tr>
                ) : filtered.map(t => (
                  <tr key={t.id} className={`hover:bg-gray-50 ${!t.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{TOUR_TYPE_LABELS[t.tour_type] || t.tour_type}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {t.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => openPrices(t)} className="text-purple-600 hover:text-purple-800 text-xs font-medium">Цены</button>
                      <button onClick={() => openEdit(t)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Ред.</button>
                      <button onClick={() => toggleActive(t)} className={`text-xs font-medium ${t.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}>
                        {t.is_active ? 'Откл.' : 'Вкл.'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tour modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Редактировать тур' : 'Новый тур'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Название *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputCls} required autoFocus />
              </div>
              <div>
                <label className={labelCls}>Тип *</label>
                <select value={formData.tourType} onChange={e => setFormData({ ...formData, tourType: e.target.value })} className={inputCls}>
                  <option value="group">Групповой</option>
                  <option value="individual">Индивидуальный</option>
                  <option value="tourflot">ТурФлот</option>
                </select>
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

      {/* Price modal */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{editingPrice ? 'Редактировать цену' : 'Новая цена'}</h2>
            <form onSubmit={handlePriceSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Компания *</label>
                  <select value={priceForm.companyId} onChange={e => setPriceForm({ ...priceForm, companyId: e.target.value })} className={inputCls} required>
                    <option value="">Выбрать...</option>
                    {companies.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div />
                <div>
                  <label className={labelCls}>Действует с *</label>
                  <input type="date" value={priceForm.validFrom} onChange={e => setPriceForm({ ...priceForm, validFrom: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Действует по *</label>
                  <input type="date" value={priceForm.validTo} onChange={e => setPriceForm({ ...priceForm, validTo: e.target.value })} className={inputCls} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Нетто (฿)</h3>
                  <div className="space-y-2">
                    {[['adultNet','Взрослый'],['childNet','Ребёнок'],['infantNet','Младенец'],['transferNet','Трансфер'],['otherNet','Прочее']].map(([k,l]) => (
                      <div key={k} className="flex items-center gap-2">
                        <label className="w-24 text-xs text-gray-500">{l}</label>
                        <input type="number" value={(priceForm as any)[k]} onChange={e => setPriceForm({ ...priceForm, [k]: Number(e.target.value) })} step="0.01" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Продажа (฿)</h3>
                  <div className="space-y-2">
                    {[['adultSale','Взрослый'],['childSale','Ребёнок'],['infantSale','Младенец'],['transferSale','Трансфер'],['otherSale','Прочее']].map(([k,l]) => (
                      <div key={k} className="flex items-center gap-2">
                        <label className="w-24 text-xs text-gray-500">{l}</label>
                        <input type="number" value={(priceForm as any)[k]} onChange={e => setPriceForm({ ...priceForm, [k]: Number(e.target.value) })} step="0.01" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closePriceModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editingPrice ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToursPage;
