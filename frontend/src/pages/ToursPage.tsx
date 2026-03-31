import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useLanguage } from '../i18n/LanguageContext';

// ── Preset cancellation terms ─────────────────────────────────────────────────
const CANCEL_PRESETS = [
  '100% штраф в день поездки',
  'Аннуляция без штрафа за сутки до выезда',
  'Чео Лан: аннуляция без штрафа за 2 дня; за 7 дней до выезда',
  'Беременные женщины не допускаются на скоростные лодки и прочие активити. Уточняйте при бронировании тура.',
  'Дети до 3 лет бесплатно, от 3 до 11 лет — детская цена',
  'Трансфер включён в стоимость',
  'Трансфер оплачивается отдельно',
];

const ToursPage: React.FC = () => {
  const { t } = useLanguage();
  const TOUR_TYPE_LABELS: Record<string, string> = {
    group: t.typeGroup,
    individual: t.typeIndividual,
    tourflot: t.typeTourflot,
  };

  const [tours, setTours] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tourPrices, setTourPrices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'article' | 'tour_type' | 'is_active'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showModal, setShowModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editingPrice, setEditingPrice] = useState<any>(null);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [showSeasonsModal, setShowSeasonsModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<any>(null);
  const [seasonForm, setSeasonForm] = useState({ label: '', validFrom: '', validTo: '', sortOrder: 0 });

  const [formData, setFormData] = useState({ name: '', tourType: 'group', isActive: true, article: '', cancellationTerms: [] as string[], companyId: '' });
  const [priceForm, setPriceForm] = useState({
    tourId: '', companyId: '', validFrom: '', validTo: '', article: '',
    adultNet: 0, childNet: 0, infantNet: 0, transferNet: 0, otherNet: 0,
    adultSale: 0, childSale: 0, infantSale: 0, transferSale: 0, otherSale: 0,
  });

  useEffect(() => { load(); loadSeasons(); }, []);

  const loadSeasons = async () => {
    try {
      const res = await api.getSeasons();
      setSeasons(res.data);
    } catch { console.error('Failed to load seasons'); }
  };

  const load = async (cFilter = companyFilter) => {
    try {
      const [toursRes, companiesRes] = await Promise.all([
        cFilter ? api.getToursByCompany(Number(cFilter)) : api.getTours(undefined, false),
        api.getCompanies(false),
      ]);
      setTours(toursRes.data);
      setCompanies(companiesRes.data);
    } catch { console.error('Failed to load tours'); }
  };

  const loadPrices = async (tourId: number) => {
    try {
      const res = await api.getTourPricesList(tourId, companyFilter ? Number(companyFilter) : undefined);
      // Sort chronologically ascending so periods are easy to read as a timeline
      const sorted = [...res.data].sort((a: any, b: any) =>
        new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime()
      );
      setTourPrices(sorted);
    } catch { console.error('Failed to load prices'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, cancellationTerms: formData.cancellationTerms.filter(t => t.trim()) };
      if (editing) { await api.updateTour(editing.id, payload); }
      else { await api.createTour(payload); }
      closeModal();
      load();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPrice) {
        await api.updateTourPrice(editingPrice.id, { ...priceForm, isActive: true });
      } else {
        await api.createTourPrice(priceForm);
      }
      closePriceModal();
      if (selectedTour) loadPrices(selectedTour.id);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения цены');
    }
  };

  const openEdit = (tour: any) => {
    setEditing(tour);
    setFormData({ name: tour.name, tourType: tour.tour_type, isActive: tour.is_active, article: tour.article || '', cancellationTerms: tour.cancellation_terms || [], companyId: tour.company_id ? String(tour.company_id) : '' });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', tourType: 'group', isActive: true, article: '', cancellationTerms: [], companyId: companyFilter || '' });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const openPrices = (tour: any) => {
    setSelectedTour(tour);
    loadPrices(tour.id);
  };

  const openAddPrice = () => {
    setEditingPrice(null);
    setPriceForm({
      tourId: String(selectedTour.id), companyId: companyFilter || '', validFrom: '', validTo: '', article: '',
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
      article: p.article || '',
      adultNet: p.adult_net, childNet: p.child_net, infantNet: p.infant_net, transferNet: p.transfer_net, otherNet: p.other_net,
      adultSale: p.adult_sale, childSale: p.child_sale, infantSale: p.infant_sale, transferSale: p.transfer_sale, otherSale: p.other_sale,
    });
    setShowPriceModal(true);
  };

  const closePriceModal = () => { setShowPriceModal(false); setEditingPrice(null); };

  const toggleActive = async (tour: any) => {
    try {
      await api.updateTour(tour.id, { name: tour.name, tourType: tour.tour_type, isActive: !tour.is_active });
      load();
    } catch { alert('Ошибка'); }
  };

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '▲' : '▼'}</span>
      : <span className="ml-1 text-gray-300">⇅</span>;

  const filtered = [...tours]
    .filter(tour =>
      (tour.name.toLowerCase().includes(search.toLowerCase()) ||
       (tour.article || '').toLowerCase().includes(search.toLowerCase())) &&
      (typeFilter === '' || tour.tour_type === typeFilter)
    )
    .sort((a, b) => {
      let av: any = a[sortKey] ?? '', bv: any = b[sortKey] ?? '';
      if (typeof av === 'boolean') av = av ? 1 : 0;
      if (typeof bv === 'boolean') bv = bv ? 1 : 0;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  const priceFields: [string, string][] = [
    ['adultNet', t.formAdult], ['childNet', t.formChild], ['infantNet', t.formInfant],
    ['transferNet', t.formTransfer], ['otherNet', t.formOther],
  ];
  const saleFields: [string, string][] = [
    ['adultSale', t.formAdult], ['childSale', t.formChild], ['infantSale', t.formInfant],
    ['transferSale', t.formTransfer], ['otherSale', t.formOther],
  ];

  return (
    <div>
      {selectedTour ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setSelectedTour(null)} className="text-blue-600 hover:underline text-sm">{t.toursBack}</button>
            <h1 className="text-xl font-bold text-gray-800">{t.toursPricesFor} {selectedTour.name}</h1>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{TOUR_TYPE_LABELS[selectedTour.tour_type]}</span>
            <button onClick={openAddPrice} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{t.toursAddPrice}</button>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t.toursPricesColCompany}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t.toursPriceArticleLabel}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t.toursPricesColPeriod}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t.toursPricesColNet}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t.toursPricesColSale}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t.toursPricesColTransfer}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t.toursPricesColUpdated}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tourPrices.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t.toursPricesEmpty}</td></tr>
                ) : (() => {
                  // Detect overlapping rows within each company group
                  const overlapIds = new Set<number>();
                  const byCompany: Record<number, any[]> = {};
                  tourPrices.forEach(p => {
                    if (!byCompany[p.company_id]) byCompany[p.company_id] = [];
                    byCompany[p.company_id].push(p);
                  });
                  Object.values(byCompany).forEach(group => {
                    for (let i = 0; i < group.length; i++) {
                      for (let j = i + 1; j < group.length; j++) {
                        const a = group[i], b = group[j];
                        const aFrom = new Date(a.valid_from), aTo = new Date(a.valid_to);
                        const bFrom = new Date(b.valid_from), bTo = new Date(b.valid_to);
                        if (aFrom <= bTo && bFrom <= aTo) {
                          overlapIds.add(a.id);
                          overlapIds.add(b.id);
                        }
                      }
                    }
                  });

                  return tourPrices.map(p => {
                    const isOverlap = overlapIds.has(p.id);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const from = new Date(p.valid_from), to = new Date(p.valid_to);
                    const isCurrent = from <= today && today <= to;
                    const isPast = to < today;
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 ${isOverlap ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2 font-medium">
                          {p.company_name}
                          {isCurrent && !isOverlap && <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">●</span>}
                          {isPast && <span className="ml-2 text-xs text-gray-400">архив</span>}
                          {isOverlap && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">⚠ пересечение</span>}
                        </td>
                        <td className="px-3 py-2">
                          {p.article
                            ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-mono font-semibold">{p.article}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono text-xs">
                          {p.valid_from?.split('T')[0]} — {p.valid_to?.split('T')[0]}
                        </td>
                        <td className="px-3 py-2 text-right">฿{Number(p.adult_net).toFixed(0)} / ฿{Number(p.child_net).toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">฿{Number(p.adult_sale).toFixed(0)} / ฿{Number(p.child_sale).toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">฿{Number(p.transfer_net).toFixed(0)} / ฿{Number(p.transfer_sale).toFixed(0)}</td>
                        <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                          {p.updated_at ? new Date(p.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                          <button onClick={() => openEditPrice(p)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">{t.editBtn}</button>
                          <button
                            onClick={async () => {
                              if (!confirm(t.toursPriceDeleteConfirm)) return;
                              try {
                                await api.deleteTourPrice(p.id);
                                if (selectedTour) loadPrices(selectedTour.id);
                              } catch (err: any) { alert(err.response?.data?.error || 'Ошибка'); }
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >{t.deleteBtn}</button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">{t.toursTitle}</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowSeasonsModal(true)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition text-sm">🗓 Сезоны</button>
              <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">{t.toursAdd}</button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
            <select
              value={companyFilter}
              onChange={e => { setCompanyFilter(e.target.value); load(e.target.value); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none min-w-[180px]"
            >
              <option value="">{t.toursAllCompanies}</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.article ? ` (${c.article})` : ''}</option>)}
            </select>
            <input type="text" placeholder={t.toursSearchHolder} value={search} onChange={e => setSearch(e.target.value)} className={inputCls + ' flex-1'} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
              <option value="">{t.typeAllTypes}</option>
              <option value="group">{t.typeGroup}</option>
              <option value="individual">{t.typeIndividual}</option>
              <option value="tourflot">{t.typeTourflot}</option>
            </select>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {(['name', 'article', 'tour_type', 'is_active'] as const).map((k, i) => (
                    <th
                      key={k}
                      onClick={() => handleSort(k)}
                      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 whitespace-nowrap ${i === 3 ? 'text-center' : 'text-left'}`}
                    >
                      {k === 'name' ? t.toursColName : k === 'article' ? t.toursPriceArticleLabel : k === 'tour_type' ? t.toursColType : t.status}
                      <SortIcon k={k} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t.navCompanies}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t.toursNoData}</td></tr>
                ) : filtered.map(tour => (
                  <tr key={tour.id} className={`hover:bg-gray-50 ${!tour.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {tour.needs_attention && (
                        <span title="Нет цены и условий отмены" className="inline-flex items-center justify-center w-4 h-4 mr-1.5 bg-orange-400 text-white text-xs font-bold rounded-full leading-none">!</span>
                      )}
                      {tour.name}
                    </td>
                    <td className="px-4 py-3">
                      {tour.article
                        ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-mono font-semibold">{tour.article}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{TOUR_TYPE_LABELS[tour.tour_type] || tour.tour_type}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tour.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {tour.is_active ? t.toursActive : t.toursInactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{tour.company_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => openPrices(tour)} className="text-purple-600 hover:text-purple-800 text-xs font-medium">{t.toursPricesBtn}</button>
                      <button onClick={() => openEdit(tour)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">{t.editBtn}</button>
                      <button onClick={() => toggleActive(tour)} className={`text-xs font-medium ${tour.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}>
                        {tour.is_active ? t.disableShort : t.enableShort}
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
      {showModal && (() => {
        const customTerms = formData.cancellationTerms.filter(t => !CANCEL_PRESETS.includes(t));
        const togglePreset = (preset: string) => {
          const has = formData.cancellationTerms.includes(preset);
          const next = has
            ? formData.cancellationTerms.filter(t => t !== preset)
            : [...formData.cancellationTerms, preset];
          setFormData({ ...formData, cancellationTerms: next });
        };
        const updateCustom = (idx: number, val: string) => {
          const updated = [...formData.cancellationTerms];
          // find the idx-th custom term in the full array
          let count = -1;
          for (let i = 0; i < updated.length; i++) {
            if (!CANCEL_PRESETS.includes(updated[i])) {
              count++;
              if (count === idx) { updated[i] = val; break; }
            }
          }
          setFormData({ ...formData, cancellationTerms: updated });
        };
        const removeCustom = (idx: number) => {
          let count = -1;
          const next = formData.cancellationTerms.filter(t => {
            if (!CANCEL_PRESETS.includes(t)) {
              count++;
              if (count === idx) return false;
            }
            return true;
          });
          setFormData({ ...formData, cancellationTerms: next });
        };
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">{editing ? t.toursEditTitle : t.toursNewTitle}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>{t.toursNameLabel}</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputCls} required autoFocus />
                  </div>
                  <div>
                    <label className={labelCls}>{t.toursPriceArticleLabel}</label>
                    <input type="text" value={formData.article} onChange={e => setFormData({ ...formData, article: e.target.value })} className={inputCls} placeholder={t.toursPriceArticleHolder} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.toursTourTypeLabel}</label>
                    <select value={formData.tourType} onChange={e => setFormData({ ...formData, tourType: e.target.value })} className={inputCls}>
                      <option value="group">{t.typeGroup}</option>
                      <option value="individual">{t.typeIndividual}</option>
                      <option value="tourflot">{t.typeTourflot}</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>{t.navCompanies}</label>
                    <select value={formData.companyId} onChange={e => setFormData({ ...formData, companyId: e.target.value })} className={inputCls}>
                      <option value="">— не выбрана —</option>
                      {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                {editing && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                    {t.toursActiveLabel}
                  </label>
                )}

                {/* Cancellation terms */}
                <div>
                  <label className={labelCls + ' mb-2'}>{t.toursCancellationTermsLabel}</label>
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                    {CANCEL_PRESETS.map(preset => {
                      const checked = formData.cancellationTerms.includes(preset);
                      return (
                        <div key={preset} className="flex items-start gap-2 group">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePreset(preset)}
                            className="w-4 h-4 mt-0.5 flex-shrink-0 cursor-pointer"
                          />
                          <span
                            className="text-sm text-gray-700 group-hover:text-gray-900 cursor-pointer flex-1"
                            onClick={() => togglePreset(preset)}
                          >{preset}</span>
                          {checked && (
                            <button
                              type="button"
                              onClick={() => togglePreset(preset)}
                              className="text-red-400 hover:text-red-600 font-bold text-lg leading-none flex-shrink-0"
                            >×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom terms */}
                  {customTerms.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {customTerms.map((term, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={term}
                            onChange={e => updateCustom(idx, e.target.value)}
                            placeholder={t.toursCancellationTermsHolder}
                            className={inputCls}
                          />
                          <button
                            type="button"
                            onClick={() => removeCustom(idx)}
                            className="px-2 text-red-400 hover:text-red-600 font-bold text-lg leading-none"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, cancellationTerms: [...formData.cancellationTerms, ''] })}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + {t.toursCancellationTermsAdd}
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">{t.cancel}</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editing ? t.save : t.create}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Price modal */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{editingPrice ? t.toursPriceEditTitle : t.toursPriceNewTitle}</h2>
            <form onSubmit={handlePriceSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t.toursPriceCompanyLabel}</label>
                  <select value={priceForm.companyId} onChange={e => setPriceForm({ ...priceForm, companyId: e.target.value })} className={inputCls} required>
                    <option value="">{t.toursPriceSelectCompany}</option>
                    {companies.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t.toursPriceArticleLabel}</label>
                  <input
                    type="text"
                    value={priceForm.article}
                    onChange={e => setPriceForm({ ...priceForm, article: e.target.value })}
                    className={inputCls}
                    placeholder={t.toursPriceArticleHolder}
                  />
                </div>
              </div>

              {/* Season preset picker */}
              <div>
                <label className={labelCls}>Сезон (быстрый выбор)</label>
                <div className="flex flex-wrap gap-2">
                  {seasons.map(s => {
                    const from = s.valid_from?.split('T')[0];
                    const to = s.valid_to?.split('T')[0];
                    const active = priceForm.validFrom === from && priceForm.validTo === to;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPriceForm({ ...priceForm, validFrom: from, validTo: to })}
                        className={`px-3 py-1 text-xs rounded-full border font-medium transition ${active ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t.toursPriceValidFrom}</label>
                  <input type="date" value={priceForm.validFrom} onChange={e => setPriceForm({ ...priceForm, validFrom: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>{t.toursPriceValidTo}</label>
                  <input type="date" value={priceForm.validTo} onChange={e => setPriceForm({ ...priceForm, validTo: e.target.value })} className={inputCls} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.toursPriceNet}</h3>
                  <div className="space-y-2">
                    {priceFields.map(([k, l]) => (
                      <div key={k} className="flex items-center gap-2">
                        <label className="w-24 text-xs text-gray-500">{l}</label>
                        <input type="number" value={(priceForm as any)[k]} onChange={e => setPriceForm({ ...priceForm, [k]: Number(e.target.value) })} step="0.01" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.toursPriceSale}</h3>
                  <div className="space-y-2">
                    {saleFields.map(([k, l]) => (
                      <div key={k} className="flex items-center gap-2">
                        <label className="w-24 text-xs text-gray-500">{l}</label>
                        <input type="number" value={(priceForm as any)[k]} onChange={e => setPriceForm({ ...priceForm, [k]: Number(e.target.value) })} step="0.01" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closePriceModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editingPrice ? t.save : t.create}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seasons management modal */}
      {showSeasonsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Управление сезонами</h2>
              <button onClick={() => { setShowSeasonsModal(false); setEditingSeason(null); setSeasonForm({ label: '', validFrom: '', validTo: '', sortOrder: 0 }); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Season form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (editingSeason) {
                    await api.updateSeason(editingSeason.id, seasonForm);
                  } else {
                    await api.createSeason(seasonForm);
                  }
                  setEditingSeason(null);
                  setSeasonForm({ label: '', validFrom: '', validTo: '', sortOrder: 0 });
                  loadSeasons();
                } catch (err: any) {
                  alert(err.response?.data?.error || 'Ошибка сохранения');
                }
              }}
              className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3"
            >
              <h3 className="text-sm font-semibold text-gray-700">{editingSeason ? 'Редактировать сезон' : 'Добавить сезон'}</h3>
              <div>
                <label className={labelCls}>Название</label>
                <input type="text" value={seasonForm.label} onChange={e => setSeasonForm({ ...seasonForm, label: e.target.value })} className={inputCls} required placeholder="Высокий сезон 2026–2027" autoFocus />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>С</label>
                  <input type="date" value={seasonForm.validFrom} onChange={e => setSeasonForm({ ...seasonForm, validFrom: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>По</label>
                  <input type="date" value={seasonForm.validTo} onChange={e => setSeasonForm({ ...seasonForm, validTo: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Порядок</label>
                  <input type="number" value={seasonForm.sortOrder} onChange={e => setSeasonForm({ ...seasonForm, sortOrder: Number(e.target.value) })} className={inputCls} step="10" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                {editingSeason && (
                  <button type="button" onClick={() => { setEditingSeason(null); setSeasonForm({ label: '', validFrom: '', validTo: '', sortOrder: 0 }); }} className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm">Отмена</button>
                )}
                <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm">{editingSeason ? 'Сохранить' : 'Добавить'}</button>
              </div>
            </form>

            {/* Seasons list */}
            <div className="space-y-1">
              {seasons.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Сезоны не добавлены</p>
              ) : seasons.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 group">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">{s.label}</span>
                    <span className="ml-3 text-xs text-gray-400 font-mono">
                      {s.valid_from?.split('T')[0]} — {s.valid_to?.split('T')[0]}
                    </span>
                    <span className="ml-2 text-xs text-gray-300">#{s.sort_order}</span>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingSeason(s);
                        setSeasonForm({
                          label: s.label,
                          validFrom: s.valid_from?.split('T')[0],
                          validTo: s.valid_to?.split('T')[0],
                          sortOrder: s.sort_order,
                        });
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >Изменить</button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Удалить сезон "${s.label}"?`)) return;
                        try { await api.deleteSeason(s.id); loadSeasons(); }
                        catch (err: any) { alert(err.response?.data?.error || 'Ошибка'); }
                      }}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToursPage;
