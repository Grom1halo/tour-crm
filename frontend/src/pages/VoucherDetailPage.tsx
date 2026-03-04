import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api';
import { format } from 'date-fns';
import VoucherGenerator from '../components/VoucherGenerator';

const VoucherDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: 'Оплата в офисе',
    notes: '',
  });

  useEffect(() => {
    loadVoucher();
  }, [id]);

  const loadVoucher = async () => {
    try {
      setLoading(true);
      const response = await api.getVoucherById(Number(id));
      setVoucher(response.data);
    } catch (error) {
      console.error('Failed to load voucher:', error);
      alert('Failed to load voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.addPayment({
        voucherId: Number(id),
        paymentDate: new Date(paymentForm.paymentDate).toISOString(),
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        notes: paymentForm.notes,
      });

      setShowPaymentModal(false);
      setPaymentForm({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMethod: 'Оплата в офисе',
        notes: '',
      });
      loadVoucher();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add payment');
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Delete this payment?')) return;

    try {
      await api.deletePayment(paymentId);
      loadVoucher();
    } catch (error) {
      alert('Failed to delete payment');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      unpaid: 'bg-red-100 text-red-700',
      partial: 'bg-yellow-100 text-yellow-700',
      paid: 'bg-green-100 text-green-700',
    };
    const labels = {
      unpaid: 'Unpaid',
      partial: 'Partial',
      paid: 'Paid',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Voucher not found</div>
      </div>
    );
  }

  const paymentMethods = [
    'Оплата в офисе',
    'Оплата курьеру',
    'Обменник',
    'ИП',
    'Usdt обменник',
    'Наличные на туре',
    'Тайский счёт',
    'В компанию',
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
          >
            ← Back to Vouchers
          </button>
          <h1 className="text-3xl font-bold text-gray-800">
            Voucher {voucher.voucher_number}
          </h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowGenerator(true)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition flex items-center"
          >
            🖼️ Generate Voucher
          </button>
          <button
            onClick={() => navigate(`/vouchers/${id}/edit`)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Voucher Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Voucher Details</h2>
              {getStatusBadge(voucher.payment_status)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Tour Type</div>
                <div className="font-semibold text-gray-800 capitalize">{voucher.tour_type}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Created</div>
                <div className="font-semibold text-gray-800">
                  {format(new Date(voucher.created_at), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Client</div>
                <div className="font-semibold text-gray-800">{voucher.client_name}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Phone</div>
                <div className="font-semibold text-gray-800">{voucher.client_phone}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Company</div>
                <div className="font-semibold text-gray-800">{voucher.company_name}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Tour</div>
                <div className="font-semibold text-gray-800">{voucher.tour_name}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Tour Date</div>
                <div className="font-semibold text-gray-800">
                  {format(new Date(voucher.tour_date), 'dd/MM/yyyy')}
                  {voucher.tour_time && ` ${voucher.tour_time}`}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Manager</div>
                <div className="font-semibold text-gray-800">{voucher.manager_name}</div>
              </div>
              {voucher.hotel_name && (
                <div>
                  <div className="text-gray-500 mb-1">Hotel</div>
                  <div className="font-semibold text-gray-800">{voucher.hotel_name}</div>
                </div>
              )}
              {voucher.room_number && (
                <div>
                  <div className="text-gray-500 mb-1">Room Number</div>
                  <div className="font-semibold text-gray-800">{voucher.room_number}</div>
                </div>
              )}
            </div>

            {/* Passengers */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-800 mb-3">Passengers</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center bg-blue-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-600">{voucher.adults}</div>
                  <div className="text-sm text-gray-600">Adults</div>
                </div>
                <div className="text-center bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">{voucher.children}</div>
                  <div className="text-sm text-gray-600">Children</div>
                </div>
                <div className="text-center bg-purple-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-600">{voucher.infants}</div>
                  <div className="text-sm text-gray-600">Infants</div>
                </div>
              </div>
            </div>

            {/* Remarks */}
            {voucher.remarks && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-gray-800 mb-2">Remarks</h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-gray-700">
                  {voucher.remarks}
                </div>
              </div>
            )}

            {/* Agent */}
            {voucher.agent_name && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-gray-800 mb-2">Agent</h3>
                <div className="text-sm text-gray-700">
                  {voucher.agent_name} ({voucher.agent_commission_percentage}% commission)
                </div>
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Payments</h2>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
              >
                + Add Payment
              </button>
            </div>

            {voucher.payments && voucher.payments.length > 0 ? (
              <div className="space-y-3">
                {voucher.payments.map((payment: any) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center bg-gray-50 rounded-lg p-4"
                  >
                    <div>
                      <div className="font-semibold text-gray-800">
                        ฿{Number(payment.amount).toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {payment.payment_method}
                        {payment.company_name && ` • ${payment.company_name}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(payment.payment_date), 'dd/MM/yyyy HH:mm')}
                      </div>
                      {payment.notes && (
                        <div className="text-xs text-gray-500 mt-1">{payment.notes}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No payments yet</div>
            )}
          </div>
        </div>

        {/* Price Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Price Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Net:</span>
                <span className="font-semibold">฿{Number(voucher.total_net).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sale:</span>
                <span className="font-semibold">฿{Number(voucher.total_sale).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-600">Paid to Agency:</span>
                <span className="font-semibold text-green-600">
                  ฿{Number(voucher.paid_to_agency).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pb-3 border-b">
                <span className="text-gray-600">Cash on Tour:</span>
                <span className={`font-semibold ${voucher.cash_on_tour > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  ฿{Number(voucher.cash_on_tour).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-3">
                <span className="text-gray-600">Profit:</span>
                <span className="font-semibold text-blue-600">
                  ฿{Number(voucher.total_sale - voucher.total_net).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Generator Modal */}
      {showGenerator && (
        <VoucherGenerator voucher={voucher} onClose={() => setShowGenerator(false)} />
      )}

      {/* Add Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Add Payment</h2>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherDetailPage;
