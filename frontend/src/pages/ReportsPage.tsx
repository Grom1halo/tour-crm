import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type GroupBy = 'manager' | 'company' | 'tour' | 'day';
type ReportTab = 'summary' | 'payments' | 'detail';

const ReportsPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { t } = useLanguage();
  const isAdminOrAccountant = hasRole('admin', 'accountant');
  const isManagerOnly = hasRole('manager') && !isAdminOrAccountant;
  const [tab, setTab] = useState<ReportTab>('summary');
  const [groupBy, setGroupBy] = useState<GroupBy>('manager');
  const [managers, setManagers] = useState<any[]>([]);
  const [managerId, setManagerId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [totals, setTotals] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [detail, setDetail] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [exportDateTo, setExportDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const [dateType, setDateType] = useState<'sale' | 'tour'>('sale');

  useEffect(() => {
    if (isAdminOrAccountant) {
      api.getManagers().then(r => {
        setManagers((r.data as any[]).filter((m: any) => m.is_active !== false));
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    loadReport();
  }, [tab, groupBy, managerId, dateFrom, dateTo, dateType]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = { dateFrom, dateTo, managerId: managerId || undefined, dateType };
      const [totalsRes] = await Promise.all([api.getReportTotals(params)]);
      setTotals(totalsRes.data);

      if (tab === 'summary') {
        const summaryRes = await api.getReportSummary({ ...params, groupBy });
        setRows(summaryRes.data);
      } else if (tab === 'payments') {
        const paymentsRes = await api.getReportPayments(params);
        setPayments(paymentsRes.data);
      } else if (tab === 'detail') {
        const detailRes = await api.getReportDetail(params);
        setDetail(detailRes.data);
      }
    } catch (error) {
      console.error('Report error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ dateFrom: exportDateFrom, dateTo: exportDateTo });
      if (managerId) params.append('managerId', managerId);
      const res = await fetch(`/api/reports/export/daily?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounting_${exportDateFrom}_${exportDateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const handleManagerExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ dateFrom: exportDateFrom, dateTo: exportDateTo });
      if (managerId) params.append('managerId', managerId);
      const res = await fetch(`/api/reports/export/manager?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manager_${exportDateFrom}_${exportDateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const handleHtmlReport = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ dateFrom: exportDateFrom, dateTo: exportDateTo });
    if (managerId) params.append('managerId', managerId);
    // Open HTML report in new tab with token in header (via fetch + blob URL)
    fetch(`/api/reports/export/html?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
  };

  const fmt = (v: any) => v ? `฿${Number(v).toLocaleString('ru', { minimumFractionDigits: 0 })}` : '฿0';
  const fmtNum = (v: any) => Number(v || 0).toLocaleString('ru');

  const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500';

  const groupLabels: Record<GroupBy, string> = {
    manager: t.reportsGroupManager,
    company: t.reportsGroupCompany,
    tour: t.reportsGroupTour,
    day: t.reportsGroupDay,
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.reportsTitle}</h1>

        {/* Export block */}
        {(isAdminOrAccountant || isManagerOnly) && (
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-4 py-2 border border-green-200">
          <span className="text-sm text-gray-600 font-medium">{isManagerOnly ? 'Экспорт' : t.reportsDailyAccounting}</span>
          <button
            onClick={() => { const d = new Date().toISOString().split('T')[0]; setExportDateFrom(d); setExportDateTo(d); }}
            className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 whitespace-nowrap"
            title="Сегодня"
          >Сегодня</button>
          <input
            type="date"
            value={exportDateFrom}
            onChange={e => setExportDateFrom(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={exportDateTo}
            onChange={e => setExportDateTo(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-green-500"
          />
          {isAdminOrAccountant && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {exporting ? t.reportsExporting : t.reportsExportBtn}
            </button>
          )}
          <button
            onClick={handleManagerExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            Менеджер XLS
          </button>
          {isAdminOrAccountant && (
            <button
              onClick={handleHtmlReport}
              className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
            >
              HTML
            </button>
          )}
        </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.reportsDateFrom}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.reportsDateTo}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          </div>
          {isAdminOrAccountant && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.reportsManager}</label>
              <select value={managerId} onChange={e => setManagerId(e.target.value)} className={inputCls}>
                <option value="">{t.reportsAllManagers}</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Тип даты</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              <button onClick={() => setDateType('sale')} className={`px-3 py-2 ${dateType === 'sale' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>По продаже</button>
              <button onClick={() => setDateType('tour')} className={`px-3 py-2 ${dateType === 'tour' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>По выезду</button>
            </div>
          </div>
          <button onClick={loadReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            {t.reportsRefresh}
          </button>
        </div>
      </div>

      {/* Totals cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: t.cardVouchers, value: fmtNum(totals.voucher_count), color: 'blue' },
            { label: t.cardSale, value: fmt(totals.total_sale), color: 'green' },
            { label: t.cardNet, value: fmt(totals.total_net), color: 'gray' },
            { label: t.cardProfit, value: fmt(totals.profit), color: Number(totals.profit) >= 0 ? 'green' : 'red' },
            { label: t.cardPaid, value: fmt(totals.total_paid), color: 'blue' },
            { label: t.cardCashOnTour, value: fmt(totals.total_cash_on_tour), color: 'yellow' },
            { label: t.cardPassengers, value: fmtNum(totals.total_pax), color: 'purple' },
            { label: t.cardPaymentStatus, value: `${totals.paid_count} / ${totals.partial_count} / ${totals.unpaid_count}`, color: 'gray' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-lg font-bold text-${card.color}-600`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-4 flex gap-1 pt-2">
          <button
            onClick={() => setTab('summary')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === 'summary' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.reportsTabSummary}
          </button>
          <button
            onClick={() => setTab('payments')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === 'payments' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.reportsTabPayments}
          </button>
          <button
            onClick={() => setTab('detail')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === 'detail' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Детально
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-8 text-center text-gray-400">{t.reportsLoading}</div>
          ) : tab === 'summary' ? (
            <>
              {/* Group selector */}
              <div className="flex gap-2 mb-4">
                {(['manager', 'company', 'tour', 'day'] as GroupBy[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-3 py-1 text-xs rounded-full font-medium ${groupBy === g ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {groupLabels[g]}
                  </button>
                ))}
              </div>

              {rows.length === 0 ? (
                <div className="py-6 text-center text-gray-400">{t.reportsNoData}</div>
              ) : groupBy === 'manager' ? (
                <SummaryTable rows={rows} total={t.reportsTotal} columns={[
                  { key: 'manager_name', label: t.sumManager },
                  { key: 'tour_name', label: t.sumTour },
                  { key: 'voucher_count', label: t.sumVouchers, num: true },
                  { key: 'total_sale', label: t.sumSale, money: true },
                  { key: 'total_net', label: t.sumNet, money: true },
                  { key: 'profit', label: t.sumProfit, money: true, highlight: true },
                  ...(isAdminOrAccountant ? [
                    { key: 'profit_after_agent', label: 'Профит−Агент', money: true },
                    { key: 'manager_pay', label: 'Зарплата', money: true },
                  ] : []),
                  { key: 'total_paid', label: t.sumPaid, money: true },
                  { key: 'paid_count', label: '✓', num: true },
                  { key: 'partial_count', label: '~', num: true },
                  { key: 'unpaid_count', label: '✗', num: true },
                ]} />
              ) : groupBy === 'company' ? (
                <SummaryTable rows={rows} total={t.reportsTotal} columns={[
                  { key: 'company_name', label: t.sumCompany },
                  { key: 'tour_name', label: t.sumTour },
                  { key: 'voucher_count', label: t.sumVouchers, num: true },
                  { key: 'total_pax', label: t.sumPax, num: true },
                  { key: 'total_sale', label: t.sumSale, money: true },
                  { key: 'total_net', label: t.sumNet, money: true },
                  { key: 'profit', label: t.sumProfit, money: true, highlight: true },
                ]} />
              ) : groupBy === 'tour' ? (
                <SummaryTable rows={rows} total={t.reportsTotal} columns={[
                  { key: 'tour_name', label: t.sumTour },
                  { key: 'tour_type', label: t.sumTourType },
                  { key: 'voucher_count', label: t.sumVouchers, num: true },
                  { key: 'total_pax', label: t.sumPax, num: true },
                  { key: 'total_sale', label: t.sumSale, money: true },
                  { key: 'profit', label: t.sumProfit, money: true, highlight: true },
                ]} />
              ) : (
                <SummaryTable rows={rows} total={t.reportsTotal} columns={[
                  { key: 'date', label: t.sumDate, date: true },
                  { key: 'voucher_count', label: t.sumVouchers, num: true },
                  { key: 'total_pax', label: t.sumPax, num: true },
                  { key: 'total_sale', label: t.sumSale, money: true },
                  { key: 'total_net', label: t.sumNet, money: true },
                  { key: 'profit', label: t.sumProfit, money: true, highlight: true },
                ]} />
              )}
            </>
          ) : tab === 'detail' ? (
            <>
              {isAdminOrAccountant && detail.length > 0 && <SalaryBlock rows={detail} />}
              <DetailTable rows={detail} isAdminOrAccountant={isAdminOrAccountant} />
            </>
          ) : (
            payments.length === 0 ? (
              <div className="py-6 text-center text-gray-400">{t.reportsNoPayments}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[t.payDate, t.payVoucher, t.payTourDate, t.payClient, t.payPhone, t.payManager, t.payAmount, t.payCurrency, t.payMethod, t.payNotes].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('ru') : '—'}</td>
                        <td className="px-3 py-2 text-blue-600 font-medium">{p.voucher_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.tour_date ? new Date(p.tour_date).toLocaleDateString('ru') : '—'}</td>
                        <td className="px-3 py-2">{p.client_name}</td>
                        <td className="px-3 py-2 text-gray-500">{p.client_phone}</td>
                        <td className="px-3 py-2 text-gray-500">{p.manager_name}</td>
                        <td className="px-3 py-2 font-medium text-right">฿{Number(p.amount).toFixed(0)}</td>
                        <td className="px-3 py-2">{p.currency || 'THB'}</td>
                        <td className="px-3 py-2">{p.payment_method}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{p.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right text-xs">{t.payTotalLabel}</td>
                      <td className="px-3 py-2 text-right">
                        ฿{payments.reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('ru', { minimumFractionDigits: 0 })}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  paid:    { label: 'Оплачен',   cls: 'text-green-700' },
  partial: { label: 'Частично',  cls: 'text-yellow-700' },
  unpaid:  { label: 'Не оплачен', cls: 'text-red-600' },
};

const fmtB = (v: any) => `฿${Number(v || 0).toLocaleString('ru', { minimumFractionDigits: 0 })}`;
const fmtD = (v: any) => v ? new Date(v).toLocaleDateString('ru') : '—';

const SalaryBlock: React.FC<{ rows: any[] }> = ({ rows }) => {
  // Group by manager
  const mgMap: Record<string, any> = {};
  rows.forEach(r => {
    const key = r.manager_name || '—';
    if (!mgMap[key]) mgMap[key] = { name: key, count: 0, sale: 0, profit: 0, agentComm: 0, profitAfterAgent: 0, pay: 0 };
    const m = mgMap[key];
    m.count++;
    m.sale += Number(r.total_sale || 0);
    m.profit += Number(r.profit || 0);
    m.agentComm += Number(r.agent_commission || 0);
    m.profitAfterAgent += Number(r.profit_after_agent || 0);
    m.pay += Number(r.manager_pay || 0);
  });
  const mgList = Object.values(mgMap).sort((a: any, b: any) => b.pay - a.pay);

  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-bold text-blue-800 mb-3">💰 Зарплата менеджеров за период</h3>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="text-left text-gray-500 border-b border-blue-200">
              <th className="pb-1 pr-4">Менеджер</th>
              <th className="pb-1 pr-4 text-right">Ваучеров</th>
              <th className="pb-1 pr-4 text-right">Sale</th>
              <th className="pb-1 pr-4 text-right">Профит</th>
              <th className="pb-1 pr-4 text-right">Ком. агентов</th>
              <th className="pb-1 pr-4 text-right">Профит−Аг.</th>
              <th className="pb-1 text-right font-bold text-blue-700">Зарплата</th>
            </tr>
          </thead>
          <tbody>
            {mgList.map((m: any) => (
              <tr key={m.name} className="border-b border-blue-100">
                <td className="py-1 pr-4 font-medium text-gray-800">{m.name}</td>
                <td className="py-1 pr-4 text-right text-gray-600">{m.count}</td>
                <td className="py-1 pr-4 text-right">{fmtB(m.sale)}</td>
                <td className="py-1 pr-4 text-right">{fmtB(m.profit)}</td>
                <td className="py-1 pr-4 text-right text-orange-600">{fmtB(m.agentComm)}</td>
                <td className="py-1 pr-4 text-right">{fmtB(m.profitAfterAgent)}</td>
                <td className="py-1 text-right font-bold text-blue-700 text-sm">{fmtB(m.pay)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-blue-300 font-semibold">
            <tr>
              <td className="pt-1 pr-4 text-gray-600">Итого</td>
              <td className="pt-1 pr-4 text-right">{mgList.reduce((s: number, m: any) => s + m.count, 0)}</td>
              <td className="pt-1 pr-4 text-right">{fmtB(mgList.reduce((s: number, m: any) => s + m.sale, 0))}</td>
              <td className="pt-1 pr-4 text-right">{fmtB(mgList.reduce((s: number, m: any) => s + m.profit, 0))}</td>
              <td className="pt-1 pr-4 text-right text-orange-600">{fmtB(mgList.reduce((s: number, m: any) => s + m.agentComm, 0))}</td>
              <td className="pt-1 pr-4 text-right">{fmtB(mgList.reduce((s: number, m: any) => s + m.profitAfterAgent, 0))}</td>
              <td className="pt-1 text-right text-blue-700 text-sm">{fmtB(mgList.reduce((s: number, m: any) => s + m.pay, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const DetailTable: React.FC<{ rows: any[]; isAdminOrAccountant: boolean }> = ({ rows, isAdminOrAccountant }) => {
  const thCls = 'px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200';
  const tdCls = 'px-2 py-1.5 text-xs text-gray-800 whitespace-nowrap';
  const tdR   = 'px-2 py-1.5 text-xs text-right whitespace-nowrap';

  if (rows.length === 0) return <div className="py-6 text-center text-gray-400">Нет данных</div>;

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-gray-500 mb-2">Ваучеров: {rows.length}</div>
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className={thCls}>Дата создания</th>
            <th className={thCls}>Дата выезда</th>
            <th className={thCls}>Время</th>
            <th className={thCls}>Компания</th>
            <th className={thCls}>Тур</th>
            <th className={thCls}>Отель</th>
            <th className={thCls + ' text-right'}>Взр</th>
            <th className={thCls + ' text-right'}>Дет</th>
            <th className={thCls + ' text-right'}>Мл</th>
            <th className={thCls + ' text-right'}>Оплачено</th>
            <th className={thCls + ' text-right'}>Наличные</th>
            <th className={thCls + ' text-right'}>Продажа</th>
            <th className={thCls + ' text-right'}>Нетто</th>
            <th className={thCls + ' text-right'}>Профит</th>
            {isAdminOrAccountant && <>
              <th className={thCls}>Агент</th>
              <th className={thCls + ' text-right'}>Ком.агента</th>
              <th className={thCls + ' text-right'}>Профит−Аг.</th>
              <th className={thCls + ' text-right'}>Зарплата</th>
            </>}
            <th className={thCls}>Статус</th>
            <th className={thCls}>Примечание</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => {
            const st = STATUS_LABEL[r.payment_status];
            const agentLabel = r.agent_name
              ? `${r.agent_name}${r.agent_commission_percentage ? ` (${r.agent_commission_percentage}%)` : ''}`
              : '—';
            return (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className={tdCls}>{fmtD(r.created_at)}</td>
                <td className={tdCls}>{fmtD(r.tour_date)}</td>
                <td className={tdCls}>{r.tour_time || '—'}</td>
                <td className={tdCls}>{r.company_name || '—'}</td>
                <td className={tdCls + ' max-w-[150px] truncate'} title={r.tour_name}>{r.tour_name || '—'}</td>
                <td className={tdCls + ' max-w-[120px] truncate'} title={r.hotel_name}>{r.hotel_name || '—'}</td>
                <td className={tdR}>{r.adults}</td>
                <td className={tdR}>{r.children}</td>
                <td className={tdR}>{r.infants}</td>
                <td className={tdR}>{fmtB(r.paid_to_agency)}</td>
                <td className={tdR}>{fmtB(r.cash_on_tour)}</td>
                <td className={tdR + ' font-medium'}>{fmtB(r.total_sale)}</td>
                <td className={tdR}>{fmtB(r.total_net)}</td>
                <td className={tdR + ' font-semibold ' + (Number(r.profit) >= 0 ? 'text-green-700' : 'text-red-600')}>{fmtB(r.profit)}</td>
                {isAdminOrAccountant && <>
                  <td className={tdCls}>{agentLabel}</td>
                  <td className={tdR}>{fmtB(r.agent_commission)}</td>
                  <td className={tdR}>{fmtB(r.profit_after_agent)}</td>
                  <td className={tdR + ' font-semibold text-blue-700'}>{fmtB(r.manager_pay)}</td>
                </>}
                <td className={tdCls}>
                  {st ? <span className={'font-medium ' + st.cls}>{st.label}</span> : r.payment_status}
                  {r.last_payment_date && <span className="text-gray-400 ml-1">{fmtD(r.last_payment_date)}</span>}
                </td>
                <td className={tdCls + ' max-w-[140px] truncate text-gray-400'} title={r.remarks}>{r.remarks || ''}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100 font-semibold text-xs border-t-2 border-gray-300">
          <tr>
            <td colSpan={9} className="px-2 py-2 text-gray-600">Итого ({rows.length})</td>
            <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.paid_to_agency || 0), 0))}</td>
            <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.cash_on_tour || 0), 0))}</td>
            <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.total_sale || 0), 0))}</td>
            <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.total_net || 0), 0))}</td>
            <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.profit || 0), 0))}</td>
            {isAdminOrAccountant && <>
              <td />
              <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.agent_commission || 0), 0))}</td>
              <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.profit_after_agent || 0), 0))}</td>
              <td className={tdR}>{fmtB(rows.reduce((s, r) => s + Number(r.manager_pay || 0), 0))}</td>
            </>}
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

type ColDef = { key: string; label: string; money?: boolean; num?: boolean; highlight?: boolean; date?: boolean };

const SummaryTable: React.FC<{ rows: any[]; columns: ColDef[]; total: string }> = ({ rows, columns, total }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          {columns.map(c => (
            <th key={c.key} className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase ${c.money || c.num ? 'text-right' : 'text-left'}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-gray-50">
            {columns.map(c => (
              <td key={c.key} className={`px-3 py-2 ${c.money || c.num ? 'text-right' : ''} ${c.highlight ? 'font-bold ' + (Number(row[c.key]) >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                {c.money
                  ? `฿${Number(row[c.key] || 0).toLocaleString('ru', { minimumFractionDigits: 0 })}`
                  : c.date
                  ? (row[c.key] ? new Date(row[c.key]).toLocaleDateString('ru') : '—')
                  : row[c.key] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-gray-50 font-semibold text-sm">
        <tr>
          {columns.map((c, i) => (
            <td key={c.key} className={`px-3 py-2 ${c.money || c.num ? 'text-right' : ''}`}>
              {i === 0
                ? `${total} (${rows.length})`
                : c.money
                ? `฿${rows.reduce((s, r) => s + Number(r[c.key] || 0), 0).toLocaleString('ru', { minimumFractionDigits: 0 })}`
                : c.num
                ? rows.reduce((s, r) => s + Number(r[c.key] || 0), 0)
                : ''}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  </div>
);

export default ReportsPage;
