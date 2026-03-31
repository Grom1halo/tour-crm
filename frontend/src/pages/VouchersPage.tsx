import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { format } from 'date-fns';

const VouchersPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { t } = useLanguage();
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [sortKey, setSortKey] = useState<'voucher_number'|'created_at'|'tour_date'|'client_name'|'company_name'|'total_sale'|'payment_status'>('tour_date');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    <span className="ml-1 opacity-50">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>;

  const sorted = [...vouchers].sort((a, b) => {
    const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
    const cmp = (sortKey === 'total_sale')
      ? Number(av) - Number(bv)
      : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  useEffect(() => {
    if (hasRole('admin', 'accountant')) {
      api.getManagers().then(res => setManagers(res.data)).catch(() => {});
    }
  }, [user]);

  useEffect(() => { setPage(1); }, [search, paymentStatus, managerId, showDeleted, isImportant, tourDateFrom, tourDateTo]);

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
    if (!confirm(t.vouchersDeleteConfirm)) return;
    try { await api.deleteVoucher(id); loadVouchers(); }
    catch { alert('Ошибка удаления'); }
  };

  const handleRestore = async (id: number) => {
    try { await api.restoreVoucher(id); loadVouchers(); }
    catch { alert('Ошибка восстановления'); }
  };

  const handleCopy = async (id: number) => {
    try { await api.copyVoucher(id); loadVouchers(); alert(t.voucherCopied); }
    catch { alert('Ошибка копирования'); }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      unpaid: 'bg-red-100 text-red-700',
      partial: 'bg-yellow-100 text-yellow-700',
      paid: 'bg-green-100 text-green-700',
    };
    const labels: Record<string, string> = {
      unpaid: t.statusUnpaid,
      partial: t.statusPartial,
      paid: t.statusPaid,
    };
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
        <h1 className="text-2xl font-bold text-gray-800">{t.vouchersTitle}</h1>
        <Link to="/vouchers/new" className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">
          {t.vouchersNew}
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <input
            type="text"
            placeholder={t.vouchersSearchHolder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={inputCls}
          />
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className={inputCls}>
            <option value="">{t.vouchersAllStatuses}</option>
            <option value="unpaid">{t.statusUnpaid}</option>
            <option value="partial">{t.statusPartial}</option>
            <option value="paid">{t.statusPaid}</option>
          </select>

          {hasRole('admin', 'accountant') && (
            <select value={managerId} onChange={e => setManagerId(e.target.value)} className={inputCls}>
              <option value="">{t.vouchersAllManagers}</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          )}

          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="w-4 h-4" />
              {t.vouchersShowDeleted}
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer text-red-600">
              <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="w-4 h-4" />
              {t.vouchersImportant}
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">{t.vouchersTourFrom}</label>
            <input type="date" value={tourDateFrom} onChange={e => setTourDateFrom(e.target.value)} className={inputCls + ' flex-1'} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">{t.vouchersTourTo}</label>
            <input type="date" value={tourDateTo} onChange={e => setTourDateTo(e.target.value)} className={inputCls + ' flex-1'} />
          </div>
          <div className="col-span-2 text-xs text-gray-400 flex items-center">
            {t.vouchersFound}: {vouchers.length} | {t.vouchersPage} {page} {t.vouchersOf} {Math.max(1, Math.ceil(vouchers.length / PAGE_SIZE))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{t.loading}</div>
        ) : vouchers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t.vouchersNotFound}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {(() => {
                    const th = (label: string, k?: typeof sortKey, align = 'text-left') => k
                      ? <th key={k} onClick={() => handleSort(k)} className={`px-3 py-3 ${align} text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap`}>{label}<SortIcon k={k} /></th>
                      : <th key={label} className={`px-3 py-3 ${align} text-xs font-semibold text-gray-500 uppercase whitespace-nowrap`}>{label}</th>;
                    return [
                      th(t.colVoucher,  'voucher_number'),
                      th(t.colCreated,  'created_at'),
                      th(t.colTourDate, 'tour_date'),
                      th(t.colClient,   'client_name'),
                      th(t.colPhone),
                      hasRole('admin', 'accountant') ? th(t.colManager) : null,
                      th(t.colCompany,  'company_name'),
                      th(t.colTour),
                      th(t.colAmount,   'total_sale', 'text-right'),
                      th(t.colStatus,   'payment_status', 'text-center'),
                      th(t.actions,     undefined, 'text-right'),
                    ];
                  })()}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(v => (
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
                    {hasRole('admin', 'accountant') && (
                      <td className="px-3 py-2 text-gray-500">{v.manager_name}</td>
                    )}
                    <td className="px-3 py-2 text-gray-500">{v.company_name}</td>
                    <td className="px-3 py-2 text-gray-500">{v.tour_name}</td>
                    <td className="px-3 py-2 text-right font-medium">฿{Number(v.total_sale).toFixed(0)}</td>
                    <td className="px-3 py-2 text-center">{getStatusBadge(v.payment_status)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {v.is_deleted ? (
                        <button onClick={() => handleRestore(v.id)} className="text-green-600 hover:text-green-800 text-xs font-medium">{t.restoreBtn}</button>
                      ) : (
                        <div className="flex justify-end gap-3">
                          <button onClick={() => handleCopy(v.id)} className="text-blue-500 hover:text-blue-700 text-xs">{t.copyBtn}</button>
                          <Link to={`/vouchers/${v.id}/edit`} className="text-blue-600 hover:text-blue-800 text-xs">{t.editBtn}</Link>
                          <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-700 text-xs">{t.deleteBtn}</button>
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

      {/* Pagination */}
      {vouchers.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            {t.vouchersShowing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, vouchers.length)} {t.vouchersOf} {vouchers.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
            {Array.from({ length: Math.ceil(vouchers.length / PAGE_SIZE) }, (_, i) => i + 1)
              .filter(n => n === 1 || n === Math.ceil(vouchers.length / PAGE_SIZE) || Math.abs(n - page) <= 2)
              .reduce<(number | '...')[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('...');
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === '...' ? (
                  <span key={`e${i}`} className="px-2 py-1 text-sm text-gray-400">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    className={`px-3 py-1 text-sm border rounded ${page === n ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
                  >{n}</button>
                )
              )}
            <button onClick={() => setPage(p => Math.min(Math.ceil(vouchers.length / PAGE_SIZE), p + 1))} disabled={page === Math.ceil(vouchers.length / PAGE_SIZE)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">›</button>
            <button onClick={() => setPage(Math.ceil(vouchers.length / PAGE_SIZE))} disabled={page === Math.ceil(vouchers.length / PAGE_SIZE)} className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VouchersPage;
