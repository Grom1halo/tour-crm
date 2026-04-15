import React, { useState, useEffect } from 'react';
import * as api from '../api';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  paid:    { label: 'Оплачен',  cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Частично', cls: 'bg-yellow-100 text-yellow-700' },
  unpaid:  { label: 'Не оплачен', cls: 'bg-red-100 text-red-700' },
};

const toInputDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toInputDate(d);
};

const HotlinePage: React.FC = () => {
  const today = toInputDate(new Date());
  const [date, setDate] = useState(today);
  const [spread, setSpread] = useState<number>(() => {
    const saved = localStorage.getItem('hotline_spread');
    return saved !== null ? Number(saved) : 3;
  });
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hideServed, setHideServed] = useState(true);

  const handleToggleServed = async (id: number) => {
    try {
      await api.toggleServed(id);
      setVouchers(prev => prev.map(v => v.id === id ? { ...v, is_served: !v.is_served } : v));
    } catch { alert('Ошибка'); }
  };
  const [sortKey, setSortKey] = useState<string>('tour_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const dateFrom = addDays(date, -spread);
  const dateTo   = addDays(date, spread);

  const fmtShort = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`;
  };

  const load = async (from: string, to: string) => {
    setLoading(true);
    try {
      const res = await api.getVouchers({ tourDateFrom: from, tourDateTo: to, limit: 500, allManagers: 'true' });
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

  useEffect(() => { load(dateFrom, dateTo); }, [date, spread]);

  const visibleVouchers = hideServed ? vouchers.filter(v => !v.is_served) : vouchers;
  const sorted = [...visibleVouchers].sort((a, b) => {
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

  const totalPax = visibleVouchers.reduce((s, v) => s + (v.adults||0) + (v.children||0) + (v.infants||0), 0);

  return (
    <div className="p-2 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-lg font-bold text-gray-800">Хотлайн</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >←</button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setDate(addDays(date, 1))}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >→</button>
          <button
            onClick={() => setDate(today)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >Сегодня</button>
          <div className="flex items-center gap-1.5 border border-gray-300 rounded px-2 py-1">
            <span className="text-xs text-gray-500 whitespace-nowrap">±</span>
            <input
              type="number"
              min={0}
              max={14}
              value={spread}
              onChange={e => {
                const v = Math.min(14, Math.max(0, Number(e.target.value)));
                setSpread(v);
                localStorage.setItem('hotline_spread', String(v));
              }}
              className="w-10 text-sm text-center outline-none"
            />
            <span className="text-xs text-gray-500">дн</span>
          </div>
          {spread > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1 whitespace-nowrap">
              {fmtShort(dateFrom)} — {fmtShort(dateTo)}
            </span>
          )}
          <button
            onClick={handleExcelDownload}
            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium"
          >↓ Excel</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600 items-center">
        <span>Ваучеров: <strong className="text-gray-900">{visibleVouchers.length}</strong>{hideServed && vouchers.length !== visibleVouchers.length ? <span className="text-gray-400 ml-1">/ {vouchers.length}</span> : ''}</span>
        <span>Пассажиров: <strong className="text-gray-900">{totalPax}</strong></span>
        <label className="flex items-center gap-1.5 cursor-pointer text-green-700 ml-2">
          <input type="checkbox" checked={hideServed} onChange={e => setHideServed(e.target.checked)} className="w-4 h-4 accent-green-600" />
          Скрыть обслуженные
        </label>
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
                  <th className={thCls}>✓</th>
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
                    <tr key={v.id} className={`${bg} ${v.is_served ? 'opacity-40' : 'hover:bg-blue-50'}`}>
                      <td className={tdCls + ' text-center'}>
                        <button
                          onClick={() => handleToggleServed(v.id)}
                          title={v.is_served ? 'Снять отметку' : 'Отметить обслуженным'}
                          className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center text-xs font-bold transition ${v.is_served ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-green-400'}`}
                        >✓</button>
                      </td>
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
