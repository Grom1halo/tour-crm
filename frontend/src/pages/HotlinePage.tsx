import React, { useState, useEffect } from 'react';
import * as api from '../api';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  paid:    { label: 'Оплачен',  cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Частично', cls: 'bg-yellow-100 text-yellow-700' },
  unpaid:  { label: 'Не оплачен', cls: 'bg-red-100 text-red-700' },
};

const toInputDate = (d: Date) => d.toISOString().split('T')[0];

const HotlinePage: React.FC = () => {
  const today = toInputDate(new Date());
  const [date, setDate] = useState(today);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string>('tour_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = async (d: string) => {
    setLoading(true);
    try {
      const res = await api.getVouchers({ tourDateFrom: d, tourDateTo: d, limit: 500 });
      setVouchers(Array.isArray(res.data) ? res.data : res.data.vouchers || []);
    } catch {
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/export/hotline?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hotline_${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка экспорта');
    }
  };

  useEffect(() => { load(date); }, [date]);

  const sorted = [...vouchers].sort((a, b) => {
    let av = a[sortKey] ?? '';
    let bv = b[sortKey] ?? '';
    if (sortKey === 'pax') { av = (a.adults||0)+(a.children||0)+(a.infants||0); bv = (b.adults||0)+(b.children||0)+(b.infants||0); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const arrow = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const thCls = 'px-1.5 py-1.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none whitespace-nowrap hover:text-gray-800';
  const tdCls = 'px-1.5 py-1 text-xs text-gray-800';

  const totalPax = vouchers.reduce((s, v) => s + (v.adults||0) + (v.children||0) + (v.infants||0), 0);

  return (
    <div className="p-2 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-lg font-bold text-gray-800">Хотлайн</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(toInputDate(new Date(new Date(date).getTime() - 86400000)))}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >←</button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setDate(toInputDate(new Date(new Date(date).getTime() + 86400000)))}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >→</button>
          <button
            onClick={() => setDate(today)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >Сегодня</button>
          <button
            onClick={handleExcelDownload}
            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium"
          >↓ Excel</button>
        </div>
      </div>

      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span>Ваучеров: <strong className="text-gray-900">{vouchers.length}</strong></span>
        <span>Пассажиров: <strong className="text-gray-900">{totalPax}</strong></span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Загрузка...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Нет ваучеров на эту дату</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className={thCls} onClick={() => toggleSort('voucher_number')}>Ваучер{arrow('voucher_number')}</th>
                  <th className={thCls} onClick={() => toggleSort('created_at')}>Создан{arrow('created_at')}</th>
                  <th className={thCls} onClick={() => toggleSort('tour_date')}>Дата выезда{arrow('tour_date')}</th>
                  <th className={thCls} onClick={() => toggleSort('tour_time')}>Время{arrow('tour_time')}</th>
                  <th className={thCls} onClick={() => toggleSort('company_name')}>Компания{arrow('company_name')}</th>
                  <th className={thCls} onClick={() => toggleSort('tour_name')}>Тур{arrow('tour_name')}</th>
                  <th className={thCls} onClick={() => toggleSort('hotel_name')}>Отель{arrow('hotel_name')}</th>
                  <th className={thCls} onClick={() => toggleSort('room_number')}>Комната{arrow('room_number')}</th>
                  <th className={thCls} onClick={() => toggleSort('client_name')}>Клиент{arrow('client_name')}</th>
                  <th className={thCls} onClick={() => toggleSort('client_phone')}>Телефон{arrow('client_phone')}</th>
                  <th className={thCls} onClick={() => toggleSort('adults')}>Взр{arrow('adults')}</th>
                  <th className={thCls} onClick={() => toggleSort('children')}>Дет{arrow('children')}</th>
                  <th className={thCls} onClick={() => toggleSort('infants')}>Мл{arrow('infants')}</th>
                  <th className={thCls} onClick={() => toggleSort('paid_to_agency')}>Оплачено{arrow('paid_to_agency')}</th>
                  <th className={thCls} onClick={() => toggleSort('cash_on_tour')}>Наличные{arrow('cash_on_tour')}</th>
                  <th className={thCls} onClick={() => toggleSort('total_sale')}>Продажа{arrow('total_sale')}</th>
                  <th className={thCls} onClick={() => toggleSort('agent_name')}>Агент{arrow('agent_name')}</th>
                  <th className={thCls} onClick={() => toggleSort('payment_status')}>Статус{arrow('payment_status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((v, i) => {
                  const status = STATUS_LABEL[v.payment_status];
                  const fmtB = (val: any) => Number(val||0) > 0 ? `฿${Number(val).toLocaleString('ru')}` : '—';
                  const fmtD = (val: any) => {
                    if (!val) return '—';
                    const d = new Date(val);
                    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
                  };
                  const bg = i % 2 === 0 ? '' : 'bg-gray-50';
                  return (
                    <tr key={v.id} className={`${bg} hover:bg-blue-50`}>
                      <td className={tdCls + ' font-mono text-blue-600'}>{v.voucher_number || '—'}</td>
                      <td className={tdCls + ' text-gray-400'}>{fmtD(v.created_at)}</td>
                      <td className={tdCls + ' font-medium'}>{fmtD(v.tour_date)}</td>
                      <td className={tdCls + ' font-bold text-blue-700'}>{v.tour_time || '—'}</td>
                      <td className={tdCls}>{v.company_name || '—'}</td>
                      <td className={tdCls}>
                        <a href={`/vouchers/${v.id}`} className="text-blue-600 hover:underline font-medium">
                          {v.tour_name || v.voucher_number}
                          {v.is_important && <span className="ml-1 text-red-500">★</span>}
                        </a>
                      </td>
                      <td className={tdCls}>{v.hotel_name || '—'}</td>
                      <td className={tdCls + ' text-gray-500'}>{v.room_number || '—'}</td>
                      <td className={tdCls + ' font-medium'}>{v.client_name || '—'}</td>
                      <td className={tdCls + ' text-gray-500'}>{v.client_phone || '—'}</td>
                      <td className={tdCls + ' text-center'}>{v.adults || 0}</td>
                      <td className={tdCls + ' text-center'}>{v.children || 0}</td>
                      <td className={tdCls + ' text-center'}>{v.infants || 0}</td>
                      <td className={tdCls + ' text-right'}>{fmtB(v.paid_to_agency)}</td>
                      <td className={tdCls + ' text-right'}>{fmtB(v.cash_on_tour)}</td>
                      <td className={tdCls + ' text-right font-medium'}>{fmtB(v.total_sale)}</td>
                      <td className={tdCls + ' text-gray-500'}>{v.agent_name || '—'}</td>
                      <td className={tdCls}>
                        {status
                          ? <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${status.cls}`}>{status.label}</span>
                          : v.payment_status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HotlinePage;
