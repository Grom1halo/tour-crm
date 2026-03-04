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

  const [formData, setFormData] = useState({
    tourType: 'group',
    clientId: '',
    companyId: '',
    tourId: '',
    tourDate: '',
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
  });

  useEffect(() => {
    loadReferenceData();
    if (isEdit) {
      loadVoucher();
    }
  }, [id]);

  const loadReferenceData = async () => {
    try {
      const [clientsRes, companiesRes, toursRes, agentsRes] = await Promise.all([
        api.getClients(),
        api.getCompanies(),
        api.getTours(),
        api.getAgents(),
      ]);
      setClients(clientsRes.data);
      setCompanies(companiesRes.data);
      setTours(toursRes.data);
      setAgents(agentsRes.data);
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  };

  const loadVoucher = async () => {
    try {
      const response = await api.getVoucherById(Number(id));
      const voucher = response.data;
      setFormData({
        tourType: voucher.tour_type,
        clientId: voucher.client_id,
        companyId: voucher.company_id,
        tourId: voucher.tour_id,
        tourDate: voucher.tour_date,
        tourTime: voucher.tour_time || '',
        hotelName: voucher.hotel_name || '',
        roomNumber: voucher.room_number || '',
        adults: voucher.adults,
        children: voucher.children,
        infants: voucher.infants,
        adultNet: voucher.adult_net,
        childNet: voucher.child_net,
        infantNet: voucher.infant_net,
        transferNet: voucher.transfer_net,
        otherNet: voucher.other_net,
        adultSale: voucher.adult_sale,
        childSale: voucher.child_sale,
        infantSale: voucher.infant_sale,
        transferSale: voucher.transfer_sale,
        otherSale: voucher.other_sale,
        agentId: voucher.agent_id || '',
        agentCommissionPercentage: voucher.agent_commission_percentage,
        remarks: voucher.remarks || '',
      });
    } catch (error) {
      console.error('Failed to load voucher:', error);
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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          {isEdit ? 'Edit Voucher' : 'Create New Voucher'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tour Type</label>
            <select
              name="tourType"
              value={formData.tourType}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value="group">Group Tour</option>
              <option value="individual">Individual Tour</option>
              <option value="tourflot">TourFlot</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
            <select
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value="">Select Client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company *</label>
            <select
              name="companyId"
              value={formData.companyId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value="">Select Company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tour *</label>
            <select
              name="tourId"
              value={formData.tourId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value="">Select Tour</option>
              {tours.map(tour => (
                <option key={tour.id} value={tour.id}>{tour.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tour Date *</label>
              <input
                type="date"
                name="tourDate"
                value={formData.tourDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tour Time</label>
              <input
                type="time"
                name="tourTime"
                value={formData.tourTime}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Hotel Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hotel Name</label>
            <input
              type="text"
              name="hotelName"
              value={formData.hotelName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Room Number</label>
            <input
              type="text"
              name="roomNumber"
              value={formData.roomNumber}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Quantities */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Number of Passengers</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Adults</label>
              <input
                type="number"
                name="adults"
                value={formData.adults}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Children</label>
              <input
                type="number"
                name="children"
                value={formData.children}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Infants</label>
              <input
                type="number"
                name="infants"
                value={formData.infants}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Prices */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Net Prices</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Adult Net</label>
              <input
                type="number"
                name="adultNet"
                value={formData.adultNet}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Child Net</label>
              <input
                type="number"
                name="childNet"
                value={formData.childNet}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Infant Net</label>
              <input
                type="number"
                name="infantNet"
                value={formData.infantNet}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Net</label>
              <input
                type="number"
                name="transferNet"
                value={formData.transferNet}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Other Net</label>
              <input
                type="number"
                name="otherNet"
                value={formData.otherNet}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Sale Prices</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Adult Sale</label>
              <input
                type="number"
                name="adultSale"
                value={formData.adultSale}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Child Sale</label>
              <input
                type="number"
                name="childSale"
                value={formData.childSale}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Infant Sale</label>
              <input
                type="number"
                name="infantSale"
                value={formData.infantSale}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Sale</label>
              <input
                type="number"
                name="transferSale"
                value={formData.transferSale}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Other Sale</label>
              <input
                type="number"
                name="otherSale"
                value={formData.otherSale}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-lg font-semibold">
            <div>
              <span className="text-gray-700">Total Net:</span>
              <span className="ml-2 text-blue-600">฿{totalNet.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-700">Total Sale:</span>
              <span className="ml-2 text-green-600">฿{totalSale.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Agent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Agent (Optional)</label>
            <select
              name="agentId"
              value={formData.agentId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">No Agent</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.commission_percentage}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Agent Commission %</label>
            <input
              type="number"
              name="agentCommissionPercentage"
              value={formData.agentCommissionPercentage}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Voucher' : 'Create Voucher'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VoucherFormPage;
