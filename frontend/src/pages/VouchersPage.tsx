import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import { format } from 'date-fns';

const VouchersPage: React.FC = () => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    loadVouchers();
  }, [search, paymentStatus, showDeleted]);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const response = await api.getVouchers({
        search,
        paymentStatus: paymentStatus || undefined,
        showDeleted: showDeleted ? 'true' : 'false',
      });
      setVouchers(response.data);
    } catch (error) {
      console.error('Failed to load vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this voucher?')) return;

    try {
      await api.deleteVoucher(id);
      loadVouchers();
    } catch (error) {
      alert('Failed to delete voucher');
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await api.restoreVoucher(id);
      loadVouchers();
    } catch (error) {
      alert('Failed to restore voucher');
    }
  };

  const handleCopy = async (id: number) => {
    try {
      await api.copyVoucher(id);
      loadVouchers();
      alert('Voucher copied successfully!');
    } catch (error) {
      alert('Failed to copy voucher');
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
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Vouchers</h1>
        <Link
          to="/vouchers/new"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          + New Voucher
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search by voucher #, phone, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>

          <label className="flex items-center space-x-2 px-4">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-gray-700">Show Deleted</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : vouchers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No vouchers found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Voucher #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tour Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tour</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Sale</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vouchers.map((voucher) => (
                  <tr key={voucher.id} className={voucher.is_deleted ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-blue-600">
                      <Link to={`/vouchers/${voucher.id}`}>{voucher.voucher_number}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {format(new Date(voucher.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {format(new Date(voucher.tour_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{voucher.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{voucher.client_phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{voucher.company_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{voucher.tour_name}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      ฿{Number(voucher.total_sale).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(voucher.payment_status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end space-x-2">
                        {voucher.is_deleted ? (
                          <button
                            onClick={() => handleRestore(voucher.id)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleCopy(voucher.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Copy
                            </button>
                            <Link
                              to={`/vouchers/${voucher.id}/edit`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(voucher.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VouchersPage;
