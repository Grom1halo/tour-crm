import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../api';
import { useLanguage } from '../i18n/LanguageContext';

const VoucherFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // New client inline form
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', phone: '' });
  const [savingClient, setSavingClient] = useState(false);

  // New company inline form
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Search filters
  const [agentSearch, setAgentSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [tourSearch, setTourSearch] = useState('');

  // Companies filtered by selected tour (null = show all)
  const [companiesForTour, setCompaniesForTour] = useState<any[] | null>(null);

  // New tour inline form
  const [showNewTour, setShowNewTour] = useState(false);
  const [newTourData, setNewTourData] = useState({ name: '', tourType: 'group' });
  const [savingTour, setSavingTour] = useState(false);

  // Payment section
  const today = new Date().toISOString().split('T')[0];
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: '',
    paymentDate: today,
    notes: '',
  });

  // Prevents company/price effects from overwriting data during initial edit load
  const skipEffects = useRef(isEdit);

  const [formData, setFormData] = useState({
    tourType: 'group',
    clientId: '',
    companyId: '',
    tourId: '',
    tourDate: '',
    tourDateEnd: '',
    tourTime: '',
    hotelName: '',
    roomNumber: '',
    adults: 2,
    children: 0,
    infants: 0,
    adultNet: 0,
    childNet: 0,
    infantNet: 0,
    transferNet: 0,
    otherNet: 0,
    adultSale: 0,
    childSale: 0,
    infantSale: 0,
    transferSale: 0,
    otherSale: 0,
    agentId: '',
    agentCommissionPercentage: 0,
    remarks: '',
    isImportant: false,
    cancellationNotes: '',
  });

  useEffect(() => {
    loadReferenceData();
    if (isEdit) {
      loadVoucher().then(() => {
        setTimeout(() => { skipEffects.current = false; }, 0);
      });
    }
  }, [id]);

  // When company changes — load tours for that company
  useEffect(() => {
    if (formData.companyId) {
      api.getToursByCompany(Number(formData.companyId)).then(res => {
        setTours(res.data);
        // Only reset tourId if user manually changed company (not initial edit load)
        if (!skipEffects.current && !res.data.find((t: any) => String(t.id) === String(formData.tourId))) {
          setFormData(prev => ({ ...prev, tourId: '' }));
        }
      }).catch(() => {});
    } else {
      api.getTours().then(res => setTours(res.data)).catch(() => {});
    }
  }, [formData.companyId]);

  // When tour selected without company — find companies for this tour
  useEffect(() => {
    if (skipEffects.current) return;
    const { tourId, companyId } = formData;
    if (!tourId || companyId) { setCompaniesForTour(null); return; }

    api.getCompaniesByTour(Number(tourId)).then(res => {
      const list: any[] = res.data;
      setCompaniesForTour(list.length > 0 ? list : null);
      if (list.length === 1) {
        // Only one company has this tour — auto-select it
        skipEffects.current = true;
        setFormData(prev => ({ ...prev, companyId: String(list[0].id) }));
        // Load tours for that company, keeping current tourId
        api.getToursByCompany(list[0].id).then(r => {
          setTours(r.data);
          setTimeout(() => { skipEffects.current = false; }, 0);
        }).catch(() => { skipEffects.current = false; });
      }
    }).catch(() => {});
  }, [formData.tourId]);

  // Auto-fill prices when tour + company + date all selected
  useEffect(() => {
    if (skipEffects.current) return; // skip during initial edit load
    const { tourId, companyId, tourDate } = formData;
    if (!tourId || !companyId || !tourDate) return;

    setLoadingPrices(true);
    api.getTourPrices(Number(tourId), Number(companyId), tourDate)
      .then(res => {
        if (res.data) {
          const p = res.data;
          setFormData(prev => ({
            ...prev,
            adultNet: Number(p.adult_net) || prev.adultNet,
            childNet: Number(p.child_net) || prev.childNet,
            infantNet: Number(p.infant_net) || prev.infantNet,
            transferNet: Number(p.transfer_net) || prev.transferNet,
            otherNet: Number(p.other_net) || prev.otherNet,
            // Sale prices intentionally NOT auto-filled — managers enter manually
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrices(false));
  }, [formData.tourId, formData.companyId, formData.tourDate]);

  const loadReferenceData = async () => {
    try {
      const [clientsRes, companiesRes, agentsRes] = await Promise.all([
        api.getClients(),
        api.getCompanies(),
        api.getAgents(),
      ]);
      setClients(clientsRes.data);
      setCompanies(companiesRes.data);
      setAgents(agentsRes.data);
      // Tours loaded via company useEffect
      const toursRes = await api.getTours();
      setTours(toursRes.data);
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  };

  const loadVoucher = async () => {
    try {
      const response = await api.getVoucherById(Number(id));
      const v = response.data;
      setFormData({
        tourType: v.tour_type,
        clientId: v.client_id != null ? String(v.client_id) : '',
        companyId: v.company_id != null ? String(v.company_id) : '',
        tourId: v.tour_id != null ? String(v.tour_id) : '',
        tourDate: v.tour_date ? v.tour_date.split('T')[0] : '',
        tourDateEnd: v.tour_date_end ? v.tour_date_end.split('T')[0] : '',
        tourTime: v.tour_time || '',
        hotelName: v.hotel_name || '',
        roomNumber: v.room_number || '',
        adults: v.adults,
        children: v.children,
        infants: v.infants,
        adultNet: v.adult_net,
        childNet: v.child_net,
        infantNet: v.infant_net,
        transferNet: v.transfer_net,
        otherNet: v.other_net,
        adultSale: v.adult_sale,
        childSale: v.child_sale,
        infantSale: v.infant_sale,
        transferSale: v.transfer_sale,
        otherSale: v.other_sale,
        agentId: v.agent_id || '',
        agentCommissionPercentage: v.agent_commission_percentage,
        remarks: v.remarks || '',
        isImportant: v.is_important || false,
        cancellationNotes: v.cancellation_notes || '',
      });
      return true;
    } catch (error) {
      alert('Failed to load voucher');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let voucherId: number;
      if (isEdit) {
        await api.updateVoucher(Number(id), formData);
        voucherId = Number(id);
      } else {
        const res = await api.createVoucher(formData);
        voucherId = res.data.id;
      }
      // Save payment if amount entered
      if (paymentData.amount && Number(paymentData.amount) > 0 && paymentData.paymentMethod) {
        await api.addPayment({
          voucherId,
          amount: Number(paymentData.amount),
          paymentMethod: paymentData.paymentMethod,
          paymentDate: paymentData.paymentDate,
          notes: paymentData.notes || null,
        });
      }
      navigate('/');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = e.target.value;
    const agent = agents.find(a => String(a.id) === agentId);
    setFormData(prev => ({
      ...prev,
      agentId,
      agentCommissionPercentage: agent ? Number(agent.commission_percentage) : 0,
    }));
  };

  const handleCreateClient = async () => {
    if (!newClientData.name.trim() || !newClientData.phone.trim()) return;
    setSavingClient(true);
    try {
      const res = await api.createClient(newClientData);
      const created = res.data;
      setClients(prev => [created, ...prev]);
      setFormData(prev => ({ ...prev, clientId: String(created.id) }));
      setNewClientData({ name: '', phone: '' });
      setShowNewClient(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create client');
    } finally {
      setSavingClient(false);
    }
  };

  const handleCreateTour = async () => {
    if (!newTourData.name.trim()) return;
    setSavingTour(true);
    try {
      const res = await api.createTour({ name: newTourData.name.trim(), tourType: newTourData.tourType });
      const created = res.data;
      setTours(prev => [...prev, created]);
      setFormData(prev => ({ ...prev, tourId: String(created.id) }));
      setNewTourData({ name: '', tourType: 'group' });
      setShowNewTour(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create tour');
    } finally {
      setSavingTour(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    setSavingCompany(true);
    try {
      const res = await api.createCompany({ name: newCompanyName.trim() });
      const created = res.data;
      setCompanies(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(prev => ({ ...prev, companyId: String(created.id) }));
      setNewCompanyName('');
      setShowNewCompany(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create company');
    } finally {
      setSavingCompany(false);
    }
  };

  const calculateTotals = () => {
    const adults = Number(formData.adults);
    const children = Number(formData.children);
    const infants = Number(formData.infants);
    const totalNet =
      adults * Number(formData.adultNet) +
      children * Number(formData.childNet) +
      infants * Number(formData.infantNet) +
      (adults + children) * Number(formData.transferNet) +
      Number(formData.otherNet);
    const totalSale =
      adults * Number(formData.adultSale) +
      children * Number(formData.childSale) +
      infants * Number(formData.infantSale) +
      (adults + children) * Number(formData.transferSale) +
      Number(formData.otherSale);
    return { totalNet, totalSale };
  };

  const { totalNet, totalSale } = calculateTotals();

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  const netFields: [string, string][] = [
    ['adultNet', t.formAdult], ['childNet', t.formChild], ['infantNet', t.formInfant],
    ['transferNet', t.formTransfer], ['otherNet', t.formOther],
  ];
  const saleFields: [string, string][] = [
    ['adultSale', t.formAdult], ['childSale', t.formChild], ['infantSale', t.formInfant],
    ['transferSale', t.formTransfer], ['otherSale', t.formOther],
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEdit ? t.formEditTitle : t.formNewTitle}
        </h1>
        {formData.isImportant && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">{t.formImportantBadge}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Row 1: type + client + company */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t.formTourType}</label>
              <select name="tourType" value={formData.tourType} onChange={handleChange} className={inputCls} required>
                <option value="group">{t.typeGroup}</option>
                <option value="individual">{t.typeIndividual}</option>
                <option value="tourflot">{t.typeTourflot}</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>{t.formClient}</label>
                <button
                  type="button"
                  onClick={() => setShowNewClient(v => !v)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showNewClient ? t.cancel : t.formNewClientBtn}
                </button>
              </div>
              <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputCls} required>
                <option value="">{t.formSelectClient}</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
              {showNewClient && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-blue-700">{t.formNewClientTitle}</p>
                  <input
                    type="text"
                    placeholder={t.clientsNameLabel}
                    value={newClientData.name}
                    onChange={e => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    placeholder={t.clientsPhoneLabel}
                    value={newClientData.phone}
                    onChange={e => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    disabled={savingClient || !newClientData.name.trim() || !newClientData.phone.trim()}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    {savingClient ? t.saving : t.formClientCreate}
                  </button>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>{t.formCompany}</label>
                <button
                  type="button"
                  onClick={() => setShowNewCompany(v => !v)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showNewCompany ? t.cancel : t.formNewCompanyBtn}
                </button>
              </div>
              {/* Show hint when tour filtered the company list */}
              {companiesForTour && companiesForTour.length > 1 && (
                <p className="text-xs text-blue-600 mb-1">
                  ↑ {companiesForTour.length} компании с этим туром
                </p>
              )}
              {!companiesForTour && companies.length > 5 && (
                <input
                  type="text"
                  placeholder="Поиск компании..."
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className="w-full px-3 py-1.5 mb-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-400"
                />
              )}
              <select
                name="companyId"
                value={formData.companyId}
                onChange={e => { handleChange(e); setCompanySearch(''); setCompaniesForTour(null); }}
                className={inputCls}
                required
              >
                <option value="">{t.formSelectCompany}</option>
                {(companiesForTour ?? companies)
                  .filter(c => {
                    if (companiesForTour) return true;
                    if (!companySearch) return true;
                    const q = companySearch.toLowerCase();
                    return c.name.toLowerCase().includes(q) || (c.article || '').toLowerCase().includes(q);
                  })
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.article ? `${c.name} (${c.article})` : c.name}
                    </option>
                  ))}
              </select>
              {showNewCompany && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-blue-700">{t.formNewCompanyTitle}</p>
                  <input
                    type="text"
                    placeholder={t.formNewCompanyNameHolder}
                    value={newCompanyName}
                    onChange={e => setNewCompanyName(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCompany}
                    disabled={savingCompany || !newCompanyName.trim()}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    {savingCompany ? t.saving : t.formCompanyCreate}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: tour + dates */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>
                  {t.formTour}
                  {loadingPrices && <span className="ml-2 text-blue-500 text-xs">{t.formLoadingPrices}</span>}
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewTour(v => !v)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showNewTour ? t.cancel : t.formNewTourBtn}
                </button>
              </div>
              {tours.length > 5 && (
                <input
                  type="text"
                  placeholder="Поиск тура по названию или артикулу..."
                  value={tourSearch}
                  onChange={e => setTourSearch(e.target.value)}
                  className="w-full px-3 py-1.5 mb-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-400"
                />
              )}
              <select name="tourId" value={formData.tourId} onChange={e => { handleChange(e); setTourSearch(''); }} className={inputCls} required size={tourSearch ? Math.min(8, tours.filter(tour => {
                const q = tourSearch.toLowerCase();
                const art = (tour.price_article || tour.tour_article || tour.article || '').toLowerCase();
                return tour.name.toLowerCase().includes(q) || art.includes(q);
              }).length + 1) : 1}>
                <option value="">{t.formSelectTour}</option>
                {tours
                  .filter(tour => {
                    if (!tourSearch) return true;
                    const q = tourSearch.toLowerCase();
                    const art = (tour.price_article || tour.tour_article || tour.article || '').toLowerCase();
                    return tour.name.toLowerCase().includes(q) || art.includes(q);
                  })
                  .map(tour => {
                    const art = tour.price_article || tour.tour_article || tour.article || '';
                    return (
                      <option key={tour.id} value={tour.id}>
                        {art ? `${tour.name} (${art})` : tour.name}
                      </option>
                    );
                  })}
              </select>
              {showNewTour && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-blue-700">{t.formNewTourTitle}</p>
                  <input
                    type="text"
                    placeholder={t.formNewTourNameHolder}
                    value={newTourData.name}
                    onChange={e => setNewTourData(prev => ({ ...prev, name: e.target.value }))}
                    className={inputCls}
                  />
                  <select
                    value={newTourData.tourType}
                    onChange={e => setNewTourData(prev => ({ ...prev, tourType: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="group">{t.typeGroup}</option>
                    <option value="individual">{t.typeIndividual}</option>
                    <option value="tourflot">{t.typeTourflot}</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateTour}
                    disabled={savingTour || !newTourData.name.trim()}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    {savingTour ? t.saving : t.formTourCreate}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>{t.formTourDate}</label>
              <input type="date" name="tourDate" value={formData.tourDate} onChange={handleChange} className={inputCls} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelCls}>{t.formTourTime}</label>
              <input type="time" name="tourTime" value={formData.tourTime} onChange={handleChange} className={inputCls} />
            </div>
            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                id="isImportant"
                name="isImportant"
                checked={formData.isImportant}
                onChange={handleChange}
                className="w-4 h-4 text-red-600 rounded"
              />
              <label htmlFor="isImportant" className="text-sm font-medium text-red-600 cursor-pointer">
                {t.formImportantVoucher}
              </label>
            </div>
          </div>
        </div>

        {/* Row 3: hotel */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.formHotel}</label>
              <input type="text" name="hotelName" value={formData.hotelName} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.formRoom}</label>
              <input type="text" name="roomNumber" value={formData.roomNumber} onChange={handleChange} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Row 4: pax */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.formGuestsTitle}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t.formAdults}</label>
              <input type="number" name="adults" value={formData.adults} onChange={handleChange} min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.formChildren}</label>
              <input type="number" name="children" value={formData.children} onChange={handleChange} min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.formInfants}</label>
              <input type="number" name="infants" value={formData.infants} onChange={handleChange} min="0" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Row 5: prices */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.formNetPricesTitle}</h3>
              <div className="grid grid-cols-2 gap-3">
                {netFields.map(([fname, label]) => (
                  <div key={fname}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" name={fname} value={(formData as any)[fname]} onChange={handleChange} step="0.01" className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.formSalePricesTitle}</h3>
              <div className="grid grid-cols-2 gap-3">
                {saleFields.map(([fname, label]) => (
                  <div key={fname}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" name={fname} value={(formData as any)[fname]} onChange={handleChange} step="0.01" className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 bg-blue-50 rounded-lg p-3 grid grid-cols-3 gap-4 text-sm font-semibold">
            <div>
              <span className="text-gray-600">{t.formNetTotal}</span>
              <span className="ml-2 text-blue-700">฿{totalNet.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">{t.formSaleTotal}</span>
              <span className="ml-2 text-green-700">฿{totalSale.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">{t.formProfit}</span>
              <span className={`ml-2 font-bold ${totalSale - totalNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                ฿{(totalSale - totalNet).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Row 6: agent + remarks + cancellation */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.formAgent}</label>
              <input
                type="text"
                placeholder={t.search}
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                className={`${inputCls} mb-1`}
              />
              <select name="agentId" value={formData.agentId} onChange={handleAgentChange} className={inputCls} size={Math.min(6, agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase())).length + 1)}>
                <option value="">{t.formNoAgent}</option>
                {agents
                  .filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase()))
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.commission_percentage}%)</option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.formAgentCommission}</label>
              <input type="number" name="agentCommissionPercentage" value={formData.agentCommissionPercentage} onChange={handleChange} step="0.01" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelCls}>{t.formRemarks}</label>
              <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.formCancellationNotes}</label>
              <select
                className={`${inputCls} mb-1 border-orange-200 text-gray-500`}
                value=""
                onChange={e => {
                  if (e.target.value) {
                    setFormData(prev => ({
                      ...prev,
                      cancellationNotes: prev.cancellationNotes
                        ? prev.cancellationNotes + '\n' + e.target.value
                        : e.target.value,
                    }));
                  }
                }}
              >
                <option value="">{t.formCancellationSelectPreset}</option>
                {/* Tour-specific cancellation terms */}
                {formData.tourId && (() => {
                  const selectedTour = tours.find(tr => String(tr.id) === String(formData.tourId));
                  const terms: string[] = selectedTour?.cancellation_terms || [];
                  return terms.length > 0 ? terms.map((term: string, i: number) => (
                    <option key={`tour-${i}`} value={term}>{term}</option>
                  )) : null;
                })()}
                {/* Global presets */}
                <option value="Без возврата">Без возврата</option>
                <option value="Свободная отмена">Свободная отмена</option>
                <option value="Возврат при отмене за 24 часа">Возврат при отмене за 24 часа</option>
                <option value="Возврат при отмене за 48 часов">Возврат при отмене за 48 часов</option>
                <option value="Возврат при отмене за 72 часа">Возврат при отмене за 72 часа</option>
                <option value="Возврат 50% при отмене за 24 часа">Возврат 50% при отмене за 24 часа</option>
                <option value="Невозврат при неявке">Невозврат при неявке</option>
                <option value="Тур перенесён">Тур перенесён</option>
                <option value="Тур отменён по погодным условиям">Тур отменён по погодным условиям</option>
              </select>
              <textarea name="cancellationNotes" value={formData.cancellationNotes} onChange={handleChange} rows={3} className={`${inputCls} border-orange-300`} placeholder={t.formCancellationHolder} />
            </div>
          </div>
        </div>

        {/* Row 7: Payment */}
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-400">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            💳 {t.formPaymentTitle}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.formPaymentAmount}</label>
              <input
                type="number"
                value={paymentData.amount}
                onChange={e => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                step="0.01"
                min="0"
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t.formPaymentMethod}</label>
              <select
                value={paymentData.paymentMethod}
                onChange={e => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className={inputCls}
              >
                <option value="">{t.formPaymentSelectMethod}</option>
                <option value="Наличные">{t.formPaymentCash}</option>
                <option value="Карта">{t.formPaymentCard}</option>
                <option value="Перевод">{t.formPaymentTransfer}</option>
                <option value="Другое">{t.formPaymentOther}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.formPaymentDate}</label>
              <input
                type="date"
                value={paymentData.paymentDate}
                onChange={e => setPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t.formPaymentNotes}</label>
              <input
                type="text"
                value={paymentData.notes}
                onChange={e => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pb-8">
          <button type="button" onClick={() => navigate('/')} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
            {t.cancel}
          </button>
          <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400">
            {loading ? t.saving : isEdit ? t.save : t.formCreateVoucher}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VoucherFormPage;
