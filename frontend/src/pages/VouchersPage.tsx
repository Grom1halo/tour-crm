import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

const VouchersPage: React.FC = () => {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [managerId, setManagerId] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [tourDateFrom, setTourDateFrom] = useState('');
  const [tourDateTo, setTourDateTo] = useState('');

  useEffect(() => {
    if (user?.role !== 'manager') {
      api.getManagers().then(res => setManagers(res.data)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    loadVouchers();
  }, [search, paymentStatus, managerId, showDeleted, isImportant, tourDateFrom, tourDateTo]);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const response = await api.getVouchers({
        search: search || undefined,
        paymentStatus: paymentStatus || undefined,
        managerId: managerId || undefined,
        showDeleted: showDeleted ? 'true' : 'false',
        isImportant: isImportant ? 'true' : undefined,
        tourDateFrom: tourDateFrom || undefined,
        tourDateTo: tourDateTo || undefined,
      });
      setVouchers(response.data);
    } catch (error) {
      console.error('Failed to load vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить ваучер?')) return;
    try { await api.deleteVoucher(id); loadVouchers(); }
    catch { alert('Ошибка удаления'); }
  };

  const handleRestore = async (id: number) => {
    try { await api.restoreVoucher(id); loadVouchers(); }
    catch { alert('Ошибка восстановления'); }
  };

  const handleCopy = async (id: number) => {
    try { await api.copyVoucher(id); loadVouchers(); alert('Ваучер скопирован!'); }
    catch { alert('Ошибка копирования'); }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      unpaid: 'bg-red-100 text-red-700',
      partial: 'bg-yellow-100 text-yellow-700',
      paid: 'bg-green-100 text-green-700',
    };
    const labels: Record<string, string> = { unpaid: 'Не оплачен', partial: 'Частично', paid: 'Оплачен' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    );
  };

  const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Ваучеры</h1>
        <Link to="/vouchers/new" className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">
          + Новый ваучер
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <input
            type="text"
            placeholder="Поиск: №, телефон, клиент..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={inputCls}
          />
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className={inputCls}>
            <option value="">Все статусы</option>
            <option value="unpaid">Не оплачен</option>
            <option value="partial">Частично</option>
            <option value="paid">Оплачен</option>
          </select>

          {user?.role !== 'manager' && (
            <select value={managerId} onChange={e => setManagerId(e.target.value)} className={inputCls}>
              <option value="">Все менеджеры</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          )}

          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="w-4 h-4" />
              Удалённые
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer text-red-600">
              <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="w-4 h-4" />
              Важные
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Тур с:</label>
            <input type="date" value={tourDateFrom} onChange={e => setTourDateFrom(e.target.value)} className={inputCls + ' flex-1'} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">по:</label>
            <input type="date" value={tourDateTo} onChange={e => setTourDateTo(e.target.value)} className={inputCls + ' flex-1'} />
          </div>
          <div className="col-span-2 text-xs text-gray-400 flex items-center">
            Найдено: {vouchers.length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Загрузка...</div>
        ) : vouchers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Ваучеры не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ваучер</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Создан</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Дата тура</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Клиент</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Телефон</th>
                  {user?.role !== 'manager' && (
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Менеджер</th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Компания</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Тур</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Сумма</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Статус</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vouchers.map(v => (
                  <tr
                    key={v.id}
                    className={[
                      v.is_deleted ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50',
                      v.is_important && !v.is_deleted ? 'border-l-4 border-l-red-400' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap">
                      <Link to={`/vouchers/${v.id}`}>{v.voucher_number}</Link>
                      {v.is_important && <span className="ml-1 text-red-500 text-xs">★</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {format(new Date(v.created_at), 'dd/MM/yy')}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {format(new Date(v.tour_date), 'dd/MM/yy')}
                    </td>
                    <td className="px-3 py-2 text-gray-800">{v.client_name}</td>
                    <td className="px-3 py-2 text-gray-500">{v.client_phone}</td>
                    {user?.role !== 'manager' && (
                      <td className="px-3 py-2 text-gray-500">{v.manager_name}</td>
                    )}
                    <td className="px-3 py-2 text-gray-500">{v.company_name}</td>
                    <td className="px-3 py-2 text-gray-500">{v.tour_name}</td>
                    <td className="px-3 py-2 text-right font-medium">฿{Number(v.total_sale).toFixed(0)}</td>
                    <td className="px-3 py-2 text-center">{getStatusBadge(v.payment_status)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {v.is_deleted ? (
                        <button onClick={() => handleRestore(v.id)} className="text-green-600 hover:text-green-800 text-xs font-medium">Восстановить</button>
                      ) : (
                        <div className="flex justify-end gap-3">
                          <button onClick={() => handleCopy(v.id)} className="text-blue-500 hover:text-blue-700 text-xs">Копия</button>
                          <Link to={`/vouchers/${v.id}/edit`} className="text-blue-600 hover:text-blue-800 text-xs">Ред.</Link>
                          <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-700 text-xs">Удалить</button>
                        </div>
                      )}
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
