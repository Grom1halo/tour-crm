import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../api';

const VoucherFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

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
    if (isEdit) loadVoucher();
  }, [id]);

  // When company changes — load tours for that company
  useEffect(() => {
    if (formData.companyId) {
      api.getToursByCompany(Number(formData.companyId)).then(res => {
        setTours(res.data);
        // If current tour not in new list — reset
        if (!res.data.find((t: any) => String(t.id) === String(formData.tourId))) {
          setFormData(prev => ({ ...prev, tourId: '' }));
        }
      }).catch(() => {});
    } else {
      api.getTours().then(res => setTours(res.data)).catch(() => {});
    }
  }, [formData.companyId]);

  // Auto-fill prices when tour + company + date all selected
  useEffect(() => {
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
            adultSale: Number(p.adult_sale) || prev.adultSale,
            childSale: Number(p.child_sale) || prev.childSale,
            infantSale: Number(p.infant_sale) || prev.infantSale,
            transferSale: Number(p.transfer_sale) || prev.transferSale,
            otherSale: Number(p.other_sale) || prev.otherSale,
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
        clientId: v.client_id,
        companyId: v.company_id,
        tourId: v.tour_id,
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
    } catch (error) {
      alert('Failed to load voucher');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.updateVoucher(Number(id), formData);
      } else {
        await api.createVoucher(formData);
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

  const calculateTotals = () => {
    const totalNet =
      formData.adults * formData.adultNet +
      formData.children * formData.childNet +
      formData.infants * formData.infantNet +
      (formData.adults + formData.children) * formData.transferNet +
      formData.otherNet;
    const totalSale =
      formData.adults * formData.adultSale +
      formData.children * formData.childSale +
      formData.infants * formData.infantSale +
      (formData.adults + formData.children) * formData.transferSale +
      formData.otherSale;
    return { totalNet, totalSale };
  };

  const { totalNet, totalSale } = calculateTotals();

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEdit ? 'Edit Voucher' : 'New Voucher'}
        </h1>
        {formData.isImportant && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">ВАЖНО</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Row 1: type + client + company */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Тип тура</label>
              <select name="tourType" value={formData.tourType} onChange={handleChange} className={inputCls} required>
                <option value="group">Групповой</option>
                <option value="individual">Индивидуальный</option>
                <option value="tourflot">ТурФлот</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Клиент *</label>
              <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputCls} required>
                <option value="">Выбрать клиента</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Компания *</label>
              <select name="companyId" value={formData.companyId} onChange={handleChange} className={inputCls} required>
                <option value="">Выбрать компанию</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: tour + dates */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>
                Тур *
                {loadingPrices && <span className="ml-2 text-blue-500 text-xs">загрузка цен...</span>}
              </label>
              <select name="tourId" value={formData.tourId} onChange={handleChange} className={inputCls} required>
                <option value="">Выбрать тур</option>
                {tours.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Дата тура *</label>
              <input type="date" name="tourDate" value={formData.tourDate} onChange={handleChange} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Дата окончания</label>
              <input type="date" name="tourDateEnd" value={formData.tourDateEnd} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelCls}>Время тура</label>
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
                Важный ваучер
              </label>
            </div>
          </div>
        </div>

        {/* Row 3: hotel */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Отель</label>
              <input type="text" name="hotelName" value={formData.hotelName} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Номер комнаты</label>
              <input type="text" name="roomNumber" value={formData.roomNumber} onChange={handleChange} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Row 4: pax */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Количество гостей</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Взрослые</label>
              <input type="number" name="adults" value={formData.adults} onChange={handleChange} min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Дети</label>
              <input type="number" name="children" value={formData.children} onChange={handleChange} min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Младенцы</label>
              <input type="number" name="infants" value={formData.infants} onChange={handleChange} min="0" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Row 5: prices */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Net */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Нетто цены (฿)</h3>
              <div className="grid grid-cols-2 gap-3">
                {[['adultNet','Взрослый'],['childNet','Ребёнок'],['infantNet','Младенец'],['transferNet','Трансфер'],['otherNet','Прочее']].map(([name, label]) => (
                  <div key={name}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" name={name} value={(formData as any)[name]} onChange={handleChange} step="0.01" className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
            {/* Sale */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Продажные цены (฿)</h3>
              <div className="grid grid-cols-2 gap-3">
                {[['adultSale','Взрослый'],['childSale','Ребёнок'],['infantSale','Младенец'],['transferSale','Трансфер'],['otherSale','Прочее']].map(([name, label]) => (
                  <div key={name}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" name={name} value={(formData as any)[name]} onChange={handleChange} step="0.01" className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 bg-blue-50 rounded-lg p-3 grid grid-cols-3 gap-4 text-sm font-semibold">
            <div>
              <span className="text-gray-600">Нетто итого:</span>
              <span className="ml-2 text-blue-700">฿{totalNet.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Продажа итого:</span>
              <span className="ml-2 text-green-700">฿{totalSale.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Прибыль:</span>
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
              <label className={labelCls}>Агент</label>
              <select name="agentId" value={formData.agentId} onChange={handleAgentChange} className={inputCls}>
                <option value="">Без агента</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.commission_percentage}%)</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Комиссия агента %</label>
              <input type="number" name="agentCommissionPercentage" value={formData.agentCommissionPercentage} onChange={handleChange} step="0.01" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelCls}>Примечания</label>
              <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Отмена / примечания об отмене</label>
              <textarea name="cancellationNotes" value={formData.cancellationNotes} onChange={handleChange} rows={3} className={`${inputCls} border-orange-300`} placeholder="Причина отмены, дата..." />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pb-8">
          <button type="button" onClick={() => navigate('/')} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
            Отмена
          </button>
          <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400">
            {loading ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать ваучер'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VoucherFormPage;
