import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type GroupBy = 'manager' | 'company' | 'tour' | 'day';
type ReportTab = 'summary' | 'payments';

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
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
  const [loading, setLoading] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [exportDateTo, setExportDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const [dateType, setDateType] = useState<'sale' | 'tour'>('sale');

  useEffect(() => {
    if (!user?.roles?.includes('manager') || user?.roles?.includes('admin')) {
      api.getManagers().then(r => {
        // Only show active managers
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
      } else {
        const paymentsRes = await api.getReportPayments(params);
        setPayments(paymentsRes.data);
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
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-4 py-2 border border-green-200">
          <span className="text-sm text-gray-600 font-medium">{t.reportsDailyAccounting}</span>
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
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {exporting ? t.reportsExporting : t.reportsExportBtn}
          </button>
          <button
            onClick={handleManagerExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            Менеджер XLS
          </button>
          <button
            onClick={handleHtmlReport}
            className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
          >
            HTML
          </button>
        </div>
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
          {(!user?.roles?.includes('manager') || user?.roles?.includes('admin')) && (
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
                  ...(!user?.roles?.includes('manager') || user?.roles?.includes('admin') ? [
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
