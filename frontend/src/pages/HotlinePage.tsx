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

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-800';
  const tdCls = 'px-3 py-2 text-sm text-gray-800';

  const totalPax = vouchers.reduce((s, v) => s + (v.adults||0) + (v.children||0) + (v.infants||0), 0);

  return (
    <div className="p-6 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Хотлайн</h1>
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
        </div>
      </div>

      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span>Ваучеров: <strong className="text-gray-900">{vouchers.length}</strong></span>
        <span>Пассажиров: <strong className="text-gray-900">{totalPax}</strong></span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Загрузка...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Нет ваучеров на эту дату</div>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className={thCls} onClick={() => toggleSort('voucher_number')}>№{arrow('voucher_number')}</th>
                <th className={thCls} onClick={() => toggleSort('tour_time')}>Время{arrow('tour_time')}</th>
                <th className={thCls} onClick={() => toggleSort('company_name')}>Компания{arrow('company_name')}</th>
                <th className={thCls} onClick={() => toggleSort('tour_name')}>Тур{arrow('tour_name')}</th>
                <th className={thCls} onClick={() => toggleSort('hotel_name')}>Отель{arrow('hotel_name')}</th>
                <th className={thCls} onClick={() => toggleSort('room_number')}>№ комнаты{arrow('room_number')}</th>
                <th className={thCls} onClick={() => toggleSort('pax')}>Чел.{arrow('pax')}</th>
                <th className={thCls} onClick={() => toggleSort('client_phone')}>Телефон{arrow('client_phone')}</th>
                <th className={thCls} onClick={() => toggleSort('payment_status')}>Статус{arrow('payment_status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(v => {
                const pax = (v.adults||0) + (v.children||0) + (v.infants||0);
                const status = STATUS_LABEL[v.payment_status];
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className={tdCls}>
                      <a href={`/vouchers/${v.id}`} className="text-blue-600 hover:underline font-medium">
                        {v.voucher_number}
                        {v.is_important && <span className="ml-1 text-red-500">★</span>}
                      </a>
                    </td>
                    <td className={tdCls + ' font-medium text-gray-900'}>{v.tour_time || '—'}</td>
                    <td className={tdCls}>{v.company_name || '—'}</td>
                    <td className={tdCls}>{v.tour_name || '—'}</td>
                    <td className={tdCls}>{v.hotel_name || '—'}</td>
                    <td className={tdCls}>{v.room_number || '—'}</td>
                    <td className={tdCls + ' text-center font-medium'}>{pax}</td>
                    <td className={tdCls}>{v.client_phone || '—'}</td>
                    <td className={tdCls}>
                      {status
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>{status.label}</span>
                        : v.payment_status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default HotlinePage;
