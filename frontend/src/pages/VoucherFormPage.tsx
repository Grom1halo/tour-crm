import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import * as api from '../api';
import { useLanguage } from '../i18n/LanguageContext';
import { PAYMENT_METHODS } from '../constants/paymentMethods';

const VoucherFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);


  // New company inline form
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Search filters
  const [agentSearch, setAgentSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [tourSearch, setTourSearch] = useState('');
  const [tourEditOverride, setTourEditOverride] = useState(false); // edit name while keeping tourId for price lookup

  // Companies filtered by selected tour (null = show all)
  const [companiesForTour, setCompaniesForTour] = useState<any[] | null>(null);

  // New tour inline form
  const [showNewTour, setShowNewTour] = useState(false);
  const [newTourData, setNewTourData] = useState({ name: '', tourType: 'group' });
  const [savingTour, setSavingTour] = useState(false);

  // Jetski passengers — individual count per jetski
  const [jetskiPassengers, setJetskiPassengers] = useState<{adults: number; children: number}[]>([{adults: 2, children: 0}]);

  // Paid to agency (loaded in edit mode from DB)
  // Payment section
  const today = new Date().toISOString().split('T')[0];
  const [depositAmount, setDepositAmount] = useState('');
  const [isConfirmedPaid, setIsConfirmedPaid] = useState(false);
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
    currency: 'THB',
    clientId: '',
    clientName: '',
    clientPhone: '',
    hotlinePhone: '+66 65 706 3341',
    companyId: '',
    companyDetails: '',
    tourId: '',
    tourDetails: '',
    tourDate: '',
    tourDateEnd: '',
    tourTime: '',
    hotelName: '',
    roomNumber: '',
    adults: 0,
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
    const init = async () => {
      await loadReferenceData();
      if (isEdit) {
        await loadVoucher();
        setTimeout(() => { skipEffects.current = false; }, 0);
      } else {
        // Pre-fill from URL params (clone for client)
        const params = new URLSearchParams(location.search);
        const clientName  = params.get('clientName');
        const clientPhone = params.get('clientPhone');
        const hotel = params.get('hotel');
        const room  = params.get('room');
        if (clientName || clientPhone || hotel || room) {
          setFormData(prev => ({
            ...prev,
            ...(clientName  ? { clientName }  : {}),
            ...(clientPhone ? { clientPhone } : {}),
            ...(hotel ? { hotelName: hotel } : {}),
            ...(room  ? { roomNumber: room }  : {}),
          }));
        } else if (hotel || room) {
          setFormData(prev => ({
            ...prev,
            ...(hotel ? { hotelName: hotel } : {}),
            ...(room ? { roomNumber: room } : {}),
          }));
        }
      }
    };
    init();
  }, [id]);

  // Helper: load tours for a specific company (or all tours if no companyId)
  const loadToursForCompany = (companyId: string, keepTourId?: string) => {
    if (companyId) {
      api.getToursByCompany(Number(companyId)).then(res => {
        setTours(res.data);
        // If current tourId not in new list, clear it (only during user interaction)
        if (keepTourId === undefined) {
          setFormData(prev => {
            const stillValid = res.data.find((t: any) => String(t.id) === String(prev.tourId));
            return stillValid ? prev : { ...prev, tourId: '' };
          });
        }
      }).catch(() => {});
    } else {
      api.getTours().then(res => setTours(res.data)).catch(() => {});
    }
  };

  // Clear companiesForTour hint when tour or company changes
  useEffect(() => {
    if (skipEffects.current) return;
    if (!formData.tourId || formData.companyId) setCompaniesForTour(null);
  }, [formData.tourId, formData.companyId]);

  // Auto-fill cancellation terms when tour is selected
  useEffect(() => {
    if (skipEffects.current) return;
    if (!formData.tourId) return;
    const selectedTour = tours.find((t: any) => String(t.id) === String(formData.tourId));
    const terms = selectedTour?.cancellation_terms;
    if (terms && terms.length > 0) {
      setFormData(prev => ({ ...prev, cancellationNotes: terms.join('\n') }));
    }
  }, [formData.tourId, tours]);

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
      const [companiesRes, agentsRes, toursRes] = await Promise.all([
        api.getCompanies(),
        api.getAgents(),
        api.getTours(),
      ]);
      setCompanies(companiesRes.data);
      setAgents(agentsRes.data);
      setTours(toursRes.data);
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  };

  const loadVoucher = async () => {
    try {
      const response = await api.getVoucherById(Number(id));
      const v = response.data;
      setDepositAmount(Number(v.paid_to_agency) > 0 ? String(Number(v.paid_to_agency)) : '');
      setFormData({
        tourType: v.tour_type,
        currency: v.currency || 'THB',
        clientId: v.client_id != null ? String(v.client_id) : '',
        clientName: v.client_name || '',
        clientPhone: v.client_phone || '',
        hotlinePhone: v.hotline_phone || '+66 65 706 3341',
        companyId: v.company_id != null ? String(v.company_id) : '',
        companyDetails: v.company_details || '',
        tourId: v.tour_id != null ? String(v.tour_id) : '',
        tourDetails: v.tour_details || '',
        // tourEditOverride: set below
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
      // Parse per-jetski passenger config
      if (v.tour_type === 'jetski' && v.jetski_config && Array.isArray(v.jetski_config) && v.jetski_config.length > 0) {
        setJetskiPassengers(v.jetski_config);
      }
      // If voucher has a company, load only that company's tours so dropdown is filtered
      if (v.company_id) {
        api.getToursByCompany(Number(v.company_id)).then(res => setTours(res.data)).catch(() => {});
      }
      // If both tourId and tourDetails are set → was saved with edit-override mode
      if (v.tour_id && v.tour_details) {
        setTourEditOverride(true);
      }
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
      const deposit = Number(depositAmount) || 0;
      // For jetski: override adults = number of jetskis, pack per-jetski data
      const jetskiOverrides = formData.tourType === 'jetski' ? {
        adults: jetskiPassengers.length,
        children: 0,
        infants: 0,
        jetskiConfig: jetskiPassengers,
      } : {};
      if (isEdit) {
        await api.updateVoucher(Number(id), { ...formData, ...jetskiOverrides, paidToAgency: deposit });
        voucherId = Number(id);
      } else {
        const res = await api.createVoucher({ ...formData, ...jetskiOverrides, paidToAgency: deposit });
        voucherId = res.data.id;
      }
      // Save payment only if "Оплачено" checkbox is checked
      if (isConfirmedPaid && paymentData.amount && Number(paymentData.amount) > 0) {
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
      // Auto-set currency when tour type changes
      ...(name === 'tourType' && value === 'vietnam' && prev.currency === 'THB' ? { currency: 'VND' } : {}),
      ...(name === 'tourType' && value !== 'vietnam' ? { currency: 'THB' } : {}),
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

  const handleCreateTour = async () => {
    if (!newTourData.name.trim()) return;
    setSavingTour(true);
    try {
      const res = await api.createTour({ name: newTourData.name.trim(), tourType: newTourData.tourType, companyId: formData.companyId ? Number(formData.companyId) : null });
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
    const isFlat = formData.tourType === 'individual' || formData.tourType === 'tourflot';
    const isJetski = formData.tourType === 'jetski';
    const jetskiCount = isJetski ? jetskiPassengers.length : adults;
    const totalNet = isFlat
      ? Number(formData.adultNet) + Number(formData.childNet) + Number(formData.infantNet) + Number(formData.transferNet) + Number(formData.otherNet)
      : isJetski
      ? jetskiCount * Number(formData.adultNet) + Number(formData.otherNet)
      : adults * Number(formData.adultNet) + children * Number(formData.childNet) + infants * Number(formData.infantNet) + (adults + children) * Number(formData.transferNet) + Number(formData.otherNet);
    const totalSale = isFlat
      ? Number(formData.adultSale) + Number(formData.childSale) + Number(formData.infantSale) + Number(formData.transferSale) + Number(formData.otherSale)
      : isJetski
      ? jetskiCount * Number(formData.adultSale) + Number(formData.otherSale)
      : adults * Number(formData.adultSale) + children * Number(formData.childSale) + infants * Number(formData.infantSale) + (adults + children) * Number(formData.transferSale) + Number(formData.otherSale);
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
                <option value="jetski">Гидроцикл</option>
                <option value="vietnam">Вьетнам</option>
              </select>
            </div>
            {formData.tourType === 'vietnam' && (
              <div>
                <label className={labelCls}>Валюта</label>
                <select name="currency" value={formData.currency} onChange={handleChange} className={inputCls}>
                  <option value="VND">₫ Донги (VND)</option>
                  <option value="USD">$ Доллары (USD)</option>
                  <option value="RUB">₽ Рубли (RUB)</option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className={labelCls}>{t.formClient}</label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  placeholder="Имя клиента"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Телефон клиента</label>
                <input
                  type="text"
                  name="clientPhone"
                  value={formData.clientPhone}
                  onChange={handleChange}
                  placeholder="+66 ..."
                  className={inputCls}
                />
              </div>
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
              {formData.companyDetails.trim() ? (
                <input
                  type="text"
                  placeholder="Название компании..."
                  value={formData.companyDetails === '_' ? '' : formData.companyDetails}
                  onChange={e => setFormData(prev => ({ ...prev, companyDetails: e.target.value || '_', companyId: '' }))}
                  className={inputCls}
                  autoFocus
                />
              ) : (
              <select
                name="companyId"
                value={formData.companyId}
                onChange={e => {
                  const newCompanyId = e.target.value;
                  setCompanySearch('');
                  setCompaniesForTour(null);
                  setFormData(prev => ({ ...prev, companyId: newCompanyId }));
                  loadToursForCompany(newCompanyId);
                }}
                className={inputCls}
                required={!formData.companyDetails}
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
              )}
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  companyDetails: prev.companyDetails.trim() ? '' : '_',
                  companyId: prev.companyDetails.trim() ? prev.companyId : '',
                }))}
                className="mt-1 text-xs text-blue-500 hover:text-blue-700 underline"
              >
                {formData.companyDetails ? '← Выбрать из списка' : '✏ Вписать вручную'}
              </button>
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

        {/* Remarks — shown right after client block */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <label className={labelCls}>{t.formRemarks}</label>
          <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={2} className={inputCls} />
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
              {/* MODE 1: manual text (no tourId) */}
              {formData.tourDetails.trim() && !tourEditOverride ? (
                <input
                  type="text"
                  placeholder="Название тура / детали услуги..."
                  value={formData.tourDetails === '_' ? '' : formData.tourDetails}
                  onChange={e => setFormData(prev => ({ ...prev, tourDetails: e.target.value || '_', tourId: '' }))}
                  className={inputCls}
                  autoFocus
                />
              ) : (
              /* MODE 2 & 3: dropdown (+ optional edit field below) */
              <select name="tourId" value={formData.tourId} onChange={e => {
                const newTourId = e.target.value;
                const picked = tours.find((t: any) => String(t.id) === newTourId);
                setTourSearch('');
                const autoCompanyId = picked?.company_id && !formData.companyId
                  ? String(picked.company_id)
                  : null;
                // If in edit-override mode, update tourDetails to new tour name
                const newTourDetails = tourEditOverride && picked ? picked.name : formData.tourDetails;
                setFormData(prev => ({
                  ...prev,
                  tourId: newTourId,
                  tourDetails: newTourDetails,
                  ...(autoCompanyId ? { companyId: autoCompanyId } : {}),
                }));
                if (autoCompanyId) {
                  loadToursForCompany(autoCompanyId, newTourId);
                }
              }} className={inputCls} required={!formData.tourDetails && !tourEditOverride} size={tourSearch ? Math.min(8, tours.filter(tour => {
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
              )}

              {/* MODE 3: editable name input (tourId kept for prices) */}
              {tourEditOverride && (
                <input
                  type="text"
                  placeholder="Название тура (можно дополнить)..."
                  value={formData.tourDetails}
                  onChange={e => setFormData(prev => ({ ...prev, tourDetails: e.target.value }))}
                  className={inputCls + ' mt-1 border-blue-300 bg-blue-50'}
                  autoFocus
                />
              )}

              {/* Action buttons */}
              <div className="mt-1 flex gap-3 flex-wrap">
                {/* Switch to full manual mode */}
                {!tourEditOverride && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      tourDetails: prev.tourDetails.trim() ? '' : '_',
                      tourId: prev.tourDetails.trim() ? prev.tourId : '',
                    }))}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    {formData.tourDetails && !tourEditOverride ? '← Выбрать из списка' : '✏ Вписать вручную'}
                  </button>
                )}
                {/* Toggle edit-override mode */}
                {!formData.tourDetails.trim() && !tourEditOverride && formData.tourId && (
                  <button
                    type="button"
                    onClick={() => {
                      const picked = tours.find((t: any) => String(t.id) === String(formData.tourId));
                      setFormData(prev => ({ ...prev, tourDetails: picked?.name || '' }));
                      setTourEditOverride(true);
                    }}
                    className="text-xs text-green-600 hover:text-green-800 underline"
                  >
                    ✏ Дополнить название
                  </button>
                )}
                {tourEditOverride && (
                  <button
                    type="button"
                    onClick={() => {
                      setTourEditOverride(false);
                      setFormData(prev => ({ ...prev, tourDetails: '' }));
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    ✕ Убрать дополнение
                  </button>
                )}
              </div>
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
                    <option value="jetski">Гидроцикл</option>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t.formHotel}</label>
              <input type="text" name="hotelName" value={formData.hotelName} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.formRoom}</label>
              <input type="text" name="roomNumber" value={formData.roomNumber} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hotline</label>
              <input type="text" name="hotlinePhone" value={formData.hotlinePhone} onChange={handleChange} placeholder="+66 65 706 3341" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Row 4: pax */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          {formData.tourType === 'jetski' ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Гидроциклы ({jetskiPassengers.length} шт.)</h3>
                <button
                  type="button"
                  onClick={() => setJetskiPassengers(prev => [...prev, { adults: 2, children: 0 }])}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition"
                >
                  + Добавить гидроцикл
                </button>
              </div>
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center text-xs font-medium text-gray-500 px-2">
                  <span className="w-8">#</span>
                  <span>Взрослых (макс 2)</span>
                  <span>Детей (макс 1)</span>
                  <span className="w-8"></span>
                </div>
                {jetskiPassengers.map((jp, idx) => (
                  <div key={idx} className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center bg-gray-50 rounded-lg px-2 py-2">
                    <span className="w-8 text-sm font-bold text-gray-500 text-center">{idx + 1}</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      value={jp.adults}
                      onChange={e => {
                        const val = Math.min(2, Math.max(0, Number(e.target.value)));
                        setJetskiPassengers(prev => prev.map((p, i) => i === idx ? { ...p, adults: val } : p));
                      }}
                      className={inputCls}
                    />
                    <input
                      type="number"
                      min="0"
                      max="1"
                      value={jp.children}
                      onChange={e => {
                        const val = Math.min(1, Math.max(0, Number(e.target.value)));
                        setJetskiPassengers(prev => prev.map((p, i) => i === idx ? { ...p, children: val } : p));
                      }}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setJetskiPassengers(prev => prev.filter((_, i) => i !== idx))}
                      className="w-8 text-red-400 hover:text-red-600 text-lg font-bold text-center"
                      title="Удалить"
                    >×</button>
                  </div>
                ))}
              </div>
              {/* Totals summary */}
              <div className="mt-3 text-xs text-gray-500 bg-blue-50 rounded-lg px-3 py-2">
                Итого: {jetskiPassengers.length} гидроцикл(а) •{' '}
                Взрослых: {jetskiPassengers.reduce((s, p) => s + p.adults, 0)} •{' '}
                Детей: {jetskiPassengers.reduce((s, p) => s + p.children, 0)}
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Row 5: prices */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          {formData.tourType === 'jetski' ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.formSalePricesTitle}</h3>
                <div>
                  <label className={labelCls}>Цена за гидроцикл (продажа) ฿</label>
                  <input type="number" name="adultSale" value={formData.adultSale} onChange={handleChange} step="0.01" className={inputCls} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.formNetPricesTitle}</h3>
                <div>
                  <label className={labelCls}>Цена за гидроцикл (нетто) ฿</label>
                  <input type="number" name="adultNet" value={formData.adultNet} onChange={handleChange} step="0.01" className={inputCls} />
                </div>
              </div>
            </div>
          ) : (formData.tourType === 'individual' || formData.tourType === 'tourflot') ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.formSalePricesTitle}</h3>
                <div>
                  <label className={labelCls}>Цена (за группу) ฿</label>
                  <input type="number" name="adultSale" value={formData.adultSale} onChange={handleChange} step="0.01" className={inputCls} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.formNetPricesTitle}</h3>
                <div>
                  <label className={labelCls}>Цена (за группу) ฿</label>
                  <input type="number" name="adultNet" value={formData.adultNet} onChange={handleChange} step="0.01" className={inputCls} />
                </div>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
          )}

          {/* Totals */}
          <div className="mt-4 bg-blue-50 rounded-lg p-3 grid grid-cols-4 gap-4 text-sm font-semibold">
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
            <div>
              <span className="text-gray-600">Кэш на туре</span>
              <span className={`ml-2 font-bold ${totalSale - Number(depositAmount || 0) > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                ฿{Math.max(0, totalSale - Number(depositAmount || 0)).toFixed(2)}
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
            💰 Депозит
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Сумма депозита</label>
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Ожидаемая сумма оплаты. Влияет на кэш на туре.</p>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer select-none mt-4">
                <input
                  type="checkbox"
                  checked={isConfirmedPaid}
                  onChange={e => {
                    setIsConfirmedPaid(e.target.checked);
                    if (e.target.checked && !paymentData.amount) {
                      setPaymentData(prev => ({ ...prev, amount: depositAmount }));
                    }
                  }}
                  className="w-5 h-5 accent-green-600"
                />
                <span className="text-sm font-medium text-gray-700">✅ Оплачено (создать запись об оплате)</span>
              </label>
            </div>
          </div>
          {isConfirmedPaid && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className={labelCls}>Сумма оплаты</label>
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
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
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
          )}
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
