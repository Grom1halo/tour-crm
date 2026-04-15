import React, { useState, useEffect } from 'react';
import * as api from '../api';

const fmt = (n: any) => Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtB = (n: any) => `฿${fmt(n)}`;

const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200';
const thR = thCls + ' text-right';
const tdCls = 'px-3 py-2 text-sm text-gray-800';
const tdR = 'px-3 py-2 text-sm text-right';

const Bar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
        <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs w-24 text-right font-medium">{fmtB(value)}</span>
    </div>
  );
};

const StatisticsPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any[]>([]);
  const [allTimeData, setAllTimeData] = useState<any[]>([]);
  const [tourData, setTourData] = useState<any[]>([]);
  const [companyData, setCompanyData] = useState<any[]>([]);
  const [clientData, setClientData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, [selectedYear]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [monthly, seasons, allTime, tours, companies, clients] = await Promise.all([
        api.getMonthlyStats(selectedYear),
        api.getSeasonStats(),
        api.getAllTimeStats(),
        api.getStatsByTour(selectedYear),
        api.getStatsByCompany(selectedYear),
        api.getStatsByClient(selectedYear),
      ]);
      setMonthlyData(monthly.data);
      setSeasonData(seasons.data);
      setAllTimeData(allTime.data);
      setTourData(tours.data);
      setCompanyData(companies.data);
      setClientData(clients.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const yearNav = (
    <div className="flex items-center gap-2">
      <button onClick={() => setSelectedYear(y => y - 1)} className="px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">◀</button>
      <span className="text-base font-bold text-gray-800 w-14 text-center">{selectedYear}</span>
      <button
        onClick={() => setSelectedYear(y => y + 1)}
        disabled={selectedYear >= currentYear}
        className="px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200 disabled:opacity-40"
      >▶</button>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Статистика</h1>
        <button onClick={loadAll} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          Обновить
        </button>
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Загрузка...</div>}

      {!loading && (
        <>
          {/* ── MONTHLY STATS ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Выручка по месяцам</h2>
              {yearNav}
            </div>

            {monthlyData && (() => {
              const months = monthlyData.months || [];
              const maxSale = Math.max(...months.map((m: any) => Number(m.total_sale || 0)), 1);
              const maxProfit = Math.max(...months.map((m: any) => Number(m.profit || 0)), 1);
              const yearSale = months.reduce((s: number, m: any) => s + Number(m.total_sale || 0), 0);
              const yearProfit = months.reduce((s: number, m: any) => s + Number(m.profit || 0), 0);
              const yearVouchers = months.reduce((s: number, m: any) => s + Number(m.voucher_count || 0), 0);

              return (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">Ваучеров за год</div>
                      <div className="text-xl font-bold text-blue-700">{yearVouchers}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">Продажи за год</div>
                      <div className="text-xl font-bold text-green-700">{fmtB(yearSale)}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">Прибыль за год</div>
                      <div className="text-xl font-bold text-purple-700">{fmtB(yearProfit)}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className={thCls} style={{ width: 60 }}>Месяц</th>
                          <th className={thR} style={{ width: 70 }}>Ваучеров</th>
                          <th className={thR} style={{ width: 70 }}>Пакс</th>
                          <th className={thCls} style={{ minWidth: 200 }}>Продажи (Sale)</th>
                          <th className={thCls} style={{ minWidth: 200 }}>Прибыль</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {months.map((m: any) => {
                          const isCurrentMonth = m.month === new Date().getMonth() + 1 && selectedYear === currentYear;
                          const isEmpty = Number(m.voucher_count) === 0;
                          return (
                            <tr key={m.month} className={`${isCurrentMonth ? 'bg-blue-50' : ''} ${isEmpty ? 'opacity-40' : ''}`}>
                              <td className={tdCls + ' font-semibold'}>{MONTH_NAMES[m.month - 1]}</td>
                              <td className={tdR}>{Number(m.voucher_count)}</td>
                              <td className={tdR}>{Number(m.total_pax || 0)}</td>
                              <td className="px-3 py-2"><Bar value={Number(m.total_sale || 0)} max={maxSale} color="bg-green-400" /></td>
                              <td className="px-3 py-2"><Bar value={Number(m.profit || 0)} max={maxProfit} color="bg-purple-400" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                        <tr>
                          <td className={tdCls}>Итого</td>
                          <td className={tdR + ' font-bold'}>{yearVouchers}</td>
                          <td className={tdR + ' font-bold'}>{months.reduce((s: number, m: any) => s + Number(m.total_pax || 0), 0)}</td>
                          <td className="px-3 py-2 text-sm font-bold text-green-700">{fmtB(yearSale)}</td>
                          <td className="px-3 py-2 text-sm font-bold text-purple-700">{fmtB(yearProfit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── BY TOUR ── */}
          {tourData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700">По турам</h2>
                {yearNav}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thCls}>Тур</th>
                      <th className={thR}>Ваучеров</th>
                      <th className={thR}>Пакс</th>
                      <th className={thR}>Sale</th>
                      <th className={thR}>Net</th>
                      <th className={thR}>Прибыль</th>
                      <th className={thR}>Маржа %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tourData.map((r: any, i: number) => {
                      const margin = Number(r.total_sale) > 0 ? Math.round(Number(r.profit) / Number(r.total_sale) * 100) : 0;
                      return (
                        <tr key={r.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                          <td className={tdCls + ' font-medium'}>{r.tour_name}</td>
                          <td className={tdR}>{Number(r.voucher_count)}</td>
                          <td className={tdR}>{Number(r.total_pax || 0)}</td>
                          <td className={tdR + ' font-medium text-green-700'}>{fmtB(r.total_sale)}</td>
                          <td className={tdR + ' text-gray-500'}>{fmtB(r.total_net)}</td>
                          <td className={tdR + ' font-bold text-purple-700'}>{fmtB(r.profit)}</td>
                          <td className={tdR + ' text-gray-600'}>{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <tr>
                      <td className={tdCls}>Итого</td>
                      <td className={tdR}>{tourData.reduce((s, r) => s + Number(r.voucher_count || 0), 0)}</td>
                      <td className={tdR}>{tourData.reduce((s, r) => s + Number(r.total_pax || 0), 0)}</td>
                      <td className={tdR + ' text-green-700'}>{fmtB(tourData.reduce((s, r) => s + Number(r.total_sale || 0), 0))}</td>
                      <td className={tdR + ' text-gray-500'}>{fmtB(tourData.reduce((s, r) => s + Number(r.total_net || 0), 0))}</td>
                      <td className={tdR + ' text-purple-700'}>{fmtB(tourData.reduce((s, r) => s + Number(r.profit || 0), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── BY COMPANY ── */}
          {companyData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700">По компаниям</h2>
                {yearNav}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thCls}>Компания</th>
                      <th className={thR}>Ваучеров</th>
                      <th className={thR}>Пакс</th>
                      <th className={thR}>Sale</th>
                      <th className={thR}>Net</th>
                      <th className={thR}>Прибыль</th>
                      <th className={thR}>Маржа %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {companyData.map((r: any, i: number) => {
                      const margin = Number(r.total_sale) > 0 ? Math.round(Number(r.profit) / Number(r.total_sale) * 100) : 0;
                      return (
                        <tr key={r.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                          <td className={tdCls + ' font-medium'}>{r.company_name}</td>
                          <td className={tdR}>{Number(r.voucher_count)}</td>
                          <td className={tdR}>{Number(r.total_pax || 0)}</td>
                          <td className={tdR + ' font-medium text-green-700'}>{fmtB(r.total_sale)}</td>
                          <td className={tdR + ' text-gray-500'}>{fmtB(r.total_net)}</td>
                          <td className={tdR + ' font-bold text-purple-700'}>{fmtB(r.profit)}</td>
                          <td className={tdR + ' text-gray-600'}>{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <tr>
                      <td className={tdCls}>Итого</td>
                      <td className={tdR}>{companyData.reduce((s, r) => s + Number(r.voucher_count || 0), 0)}</td>
                      <td className={tdR}>{companyData.reduce((s, r) => s + Number(r.total_pax || 0), 0)}</td>
                      <td className={tdR + ' text-green-700'}>{fmtB(companyData.reduce((s, r) => s + Number(r.total_sale || 0), 0))}</td>
                      <td className={tdR + ' text-gray-500'}>{fmtB(companyData.reduce((s, r) => s + Number(r.total_net || 0), 0))}</td>
                      <td className={tdR + ' text-purple-700'}>{fmtB(companyData.reduce((s, r) => s + Number(r.profit || 0), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── BY CLIENT ── */}
          {clientData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700">По клиентам</h2>
                {yearNav}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thCls}>Клиент</th>
                      <th className={thCls}>Телефон</th>
                      <th className={thR}>Ваучеров</th>
                      <th className={thR}>Пакс</th>
                      <th className={thR}>Sale</th>
                      <th className={thR}>Оплачено</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientData.map((r: any, i: number) => (
                      <tr key={r.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                        <td className={tdCls + ' font-medium'}>{r.client_name}</td>
                        <td className={tdCls + ' text-gray-500 text-xs'}>{r.client_phone || '—'}</td>
                        <td className={tdR + ' font-bold text-blue-700'}>{Number(r.voucher_count)}</td>
                        <td className={tdR}>{Number(r.total_pax || 0)}</td>
                        <td className={tdR + ' font-medium text-green-700'}>{fmtB(r.total_sale)}</td>
                        <td className={tdR + ' text-gray-600'}>{fmtB(r.total_paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={2} className={tdCls}>Итого ({clientData.length} клиентов)</td>
                      <td className={tdR}>{clientData.reduce((s, r) => s + Number(r.voucher_count || 0), 0)}</td>
                      <td className={tdR}>{clientData.reduce((s, r) => s + Number(r.total_pax || 0), 0)}</td>
                      <td className={tdR + ' text-green-700'}>{fmtB(clientData.reduce((s, r) => s + Number(r.total_sale || 0), 0))}</td>
                      <td className={tdR + ' text-gray-600'}>{fmtB(clientData.reduce((s, r) => s + Number(r.total_paid || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── SEASON STATS ── */}
          {seasonData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">По сезонам</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thCls}>Сезон</th>
                      <th className={thCls}>Период</th>
                      <th className={thR}>Ваучеров</th>
                      <th className={thR}>Пакс</th>
                      <th className={thR}>Sale</th>
                      <th className={thR}>Net</th>
                      <th className={thR}>Прибыль</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {seasonData.map((s: any, i: number) => (
                      <tr key={s.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                        <td className={tdCls + ' font-semibold'}>{s.label}</td>
                        <td className={tdCls + ' text-gray-500 text-xs'}>
                          {s.valid_from ? new Date(s.valid_from).toLocaleDateString('ru-RU') : '—'}
                          {' – '}
                          {s.valid_to ? new Date(s.valid_to).toLocaleDateString('ru-RU') : '—'}
                        </td>
                        <td className={tdR}>{Number(s.voucher_count)}</td>
                        <td className={tdR}>{Number(s.total_pax || 0)}</td>
                        <td className={tdR + ' font-medium text-green-700'}>{fmtB(s.total_sale)}</td>
                        <td className={tdR + ' text-gray-500'}>{fmtB(s.total_net)}</td>
                        <td className={tdR + ' font-bold text-purple-700'}>{fmtB(s.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={2} className={tdCls}>Итого</td>
                      <td className={tdR}>{seasonData.reduce((s, r) => s + Number(r.voucher_count || 0), 0)}</td>
                      <td className={tdR}>{seasonData.reduce((s, r) => s + Number(r.total_pax || 0), 0)}</td>
                      <td className={tdR + ' text-green-700'}>{fmtB(seasonData.reduce((s, r) => s + Number(r.total_sale || 0), 0))}</td>
                      <td className={tdR + ' text-gray-500'}>{fmtB(seasonData.reduce((s, r) => s + Number(r.total_net || 0), 0))}</td>
                      <td className={tdR + ' text-purple-700'}>{fmtB(seasonData.reduce((s, r) => s + Number(r.profit || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── ALL TIME STATS ── */}
          {allTimeData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">По годам (всё время)</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thCls}>Год</th>
                      <th className={thR}>Ваучеров</th>
                      <th className={thR}>Пакс</th>
                      <th className={thR}>Sale</th>
                      <th className={thR}>Net</th>
                      <th className={thR}>Прибыль</th>
                      <th className={thR}>Маржа %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allTimeData.map((r: any, i: number) => {
                      const margin = Number(r.total_sale) > 0
                        ? Math.round(Number(r.profit) / Number(r.total_sale) * 100)
                        : 0;
                      return (
                        <tr key={r.year} className={`${r.year === currentYear ? 'bg-blue-50 font-semibold' : i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                          <td className={tdCls + ' font-bold'}>{r.year}</td>
                          <td className={tdR}>{Number(r.voucher_count)}</td>
                          <td className={tdR}>{Number(r.total_pax || 0)}</td>
                          <td className={tdR + ' text-green-700 font-medium'}>{fmtB(r.total_sale)}</td>
                          <td className={tdR + ' text-gray-500'}>{fmtB(r.total_net)}</td>
                          <td className={tdR + ' font-bold text-purple-700'}>{fmtB(r.profit)}</td>
                          <td className={tdR + ' text-gray-600'}>{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <tr>
                      <td className={tdCls}>Итого</td>
                      <td className={tdR}>{allTimeData.reduce((s, r) => s + Number(r.voucher_count || 0), 0)}</td>
                      <td className={tdR}>{allTimeData.reduce((s, r) => s + Number(r.total_pax || 0), 0)}</td>
                      <td className={tdR + ' text-green-700'}>{fmtB(allTimeData.reduce((s, r) => s + Number(r.total_sale || 0), 0))}</td>
                      <td className={tdR + ' text-gray-500'}>{fmtB(allTimeData.reduce((s, r) => s + Number(r.total_net || 0), 0))}</td>
                      <td className={tdR + ' text-purple-700'}>{fmtB(allTimeData.reduce((s, r) => s + Number(r.profit || 0), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StatisticsPage;
