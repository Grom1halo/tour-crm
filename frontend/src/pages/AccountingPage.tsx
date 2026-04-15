import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import { PAYMENT_METHODS } from '../constants/paymentMethods';

const fmt = (n: any) => Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const getMonthRange = (offset = 0) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const from = new Date(year, month, 1).toISOString().split('T')[0];
  const to = new Date(year, month + 1, 0).toISOString().split('T')[0];
  return { from, to };
};

const inputCls = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-full';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
const btnPrimary = 'px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition';
const btnSecondary = 'px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition';
const btnDanger = 'px-2 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100 transition';

type Tab = 'cashflow' | 'operators' | 'employees' | 'accounting';

const EMPLOYEE_PAYMENT_TYPES = [
  { value: 'salary', label: 'Зарплата' },
  { value: 'advance', label: 'Аванс' },
  { value: 'bonus', label: 'Бонус' },
  { value: 'expense', label: 'Расход' },
];

const EXPENSE_CATEGORIES = [
  'Аренда',
  'Закупка',
  'Зарплата',
  'Реклама',
  'Комиссия оператору',
  'Перевод между счетами',
  'Прочее',
];

const AccountingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(() => (localStorage.getItem('ac_tab') as Tab) || 'cashflow');
  const [dateFrom, setDateFrom] = useState(() => localStorage.getItem('ac_from') || getMonthRange().from);
  const [dateTo, setDateTo] = useState(() => localStorage.getItem('ac_to') || getMonthRange().to);

  const [cashflowData, setCashflowData] = useState<{ entries: any[]; summary: any } | null>(null);
  const [operatorsData, setOperatorsData] = useState<any[]>([]);
  const [employeesData, setEmployeesData] = useState<any[]>([]);
  const [accountingDetail, setAccountingDetail] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cashflow method filter
  const [cfMethodFilter, setCfMethodFilter] = useState(() => localStorage.getItem('ac_method') || '');

  // Cashflow modal
  const [showCFModal, setShowCFModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [cfForm, setCfForm] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    entryType: 'expense',
    paymentMethod: '',
    counterpartyName: '',
    companyId: '',
    amount: '',
    notes: '',
    category: '',
    invoiceNumber: '',
  });

  // Employee payment modal
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmpPayment, setEditingEmpPayment] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [empForm, setEmpForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentType: 'salary',
    paymentMethod: '',
    notes: '',
  });

  // Salary edit state
  const [editingSalary, setEditingSalary] = useState<{ [id: number]: string }>({});

  // Expanded operators
  const [expandedOperator, setExpandedOperator] = useState<number | null>(null);
  const [operatorsAllTime, setOperatorsAllTime] = useState(false);
  const [operatorsCurrency, setOperatorsCurrency] = useState('THB');
  const [showPaidVouchers, setShowPaidVouchers] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState<Record<number, boolean>>({});
  const [showOpPayModal, setShowOpPayModal] = useState(false);
  const [opPayCompany, setOpPayCompany] = useState<any>(null);
  const [opPayForm, setOpPayForm] = useState({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '', amount: '' });

  // Write-off modal
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffCompany, setWriteOffCompany] = useState<any>(null);
  const [writeOffForm, setWriteOffForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: '',
    category: 'Оплата оператору',
    notes: '',
    markAllPaid: true,
  });

  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    api.getCompanies(false).then(r => setCompanies(r.data)).catch(() => {});
    api.getAccountingDashboard().then(r => setDashboardData(r.data)).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { dateFrom, dateTo };
      if (activeTab === 'cashflow') {
        const r = await api.getAccountingCashflow(params);
        setCashflowData(r.data);
      } else if (activeTab === 'operators') {
        const opParams = operatorsAllTime
          ? { allTime: true, ...(operatorsCurrency ? { currency: operatorsCurrency } : {}) }
          : { ...params, ...(operatorsCurrency ? { currency: operatorsCurrency } : {}) };
        const r = await api.getOperatorReconciliation(opParams);
        setOperatorsData(r.data);
      } else if (activeTab === 'employees') {
        const r = await api.getEmployeeData(params);
        setEmployeesData(r.data);
      } else if (activeTab === 'accounting') {
        const r = await api.getReportDetail(params);
        setAccountingDetail(r.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, operatorsAllTime, operatorsCurrency]);

  useEffect(() => { loadData(); }, [loadData]);

  // Persist filter state to localStorage
  useEffect(() => { localStorage.setItem('ac_tab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('ac_from', dateFrom); }, [dateFrom]);
  useEffect(() => { localStorage.setItem('ac_to', dateTo); }, [dateTo]);
  useEffect(() => { localStorage.setItem('ac_method', cfMethodFilter); }, [cfMethodFilter]);

  // Refresh dashboard after cashflow changes
  const reloadAll = () => {
    loadData();
    api.getAccountingDashboard().then(r => setDashboardData(r.data)).catch(() => {});
  };

  // ===== DATE SHORTCUTS =====
  const setCurrentMonth = () => { const r = getMonthRange(0); setDateFrom(r.from); setDateTo(r.to); };
  const setPrevMonth = () => { const r = getMonthRange(-1); setDateFrom(r.from); setDateTo(r.to); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/reports/export/accounting?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounting_${dateFrom}_${dateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  // ===== FILTERED ENTRIES WITH RECALCULATED BALANCE =====
  const filteredEntries = useMemo(() => {
    if (!cashflowData?.entries) return [];
    const entries = cfMethodFilter
      ? cashflowData.entries.filter((e: any) => e.payment_method === cfMethodFilter)
      : cashflowData.entries;
    let bal = 0;
    return entries.map((e: any) => {
      const amount = parseFloat(e.amount);
      bal += e.entry_type === 'income' ? amount : -amount;
      return { ...e, running_balance: bal };
    });
  }, [cashflowData, cfMethodFilter]);

  // ===== CASHFLOW ACTIONS =====
  const openAddEntry = () => {
    setEditingEntry(null);
    setCfForm({
      entryDate: new Date().toISOString().split('T')[0],
      entryType: 'expense', paymentMethod: '', counterpartyName: '', companyId: '', amount: '', notes: '', category: '', invoiceNumber: '',
    });
    setShowCFModal(true);
  };

  const openEditEntry = (entry: any) => {
    if (entry.source !== 'manual') return;
    setEditingEntry(entry);
    setCfForm({
      entryDate: entry.entry_date?.split('T')[0] || '',
      entryType: entry.entry_type,
      paymentMethod: entry.payment_method || '',
      counterpartyName: entry.counterparty_name || '',
      companyId: entry.company_id || '',
      amount: entry.amount,
      notes: entry.notes || '',
      category: entry.category || '',
      invoiceNumber: entry.invoice_number || '',
    });
    setShowCFModal(true);
  };

  const saveCFEntry = async () => {
    try {
      const data = {
        entryDate: cfForm.entryDate,
        entryType: cfForm.entryType,
        paymentMethod: cfForm.paymentMethod || null,
        counterpartyName: cfForm.counterpartyName || null,
        companyId: cfForm.companyId || null,
        amount: cfForm.amount,
        notes: cfForm.notes || null,
        category: cfForm.category || null,
        invoiceNumber: cfForm.invoiceNumber || null,
      };
      if (editingEntry) {
        await api.updateAccountingEntry(editingEntry.id, data);
      } else {
        await api.addAccountingEntry(data);
      }
      setShowCFModal(false);
      reloadAll();
    } catch (err) {
      console.error(err);
      alert('Ошибка сохранения');
    }
  };

  const deleteEntry = async (id: number) => {
    if (!confirm('Удалить запись?')) return;
    try {
      await api.deleteAccountingEntry(id);
      reloadAll();
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  // Новая кнопка оплаты с галочками ваучеров
  const openOpPayModal = (company: any) => {
    setOpPayCompany(company);
    const unpaidVouchers = (company.vouchers || []).filter((v: any) => !v.operator_paid);
    const selected: Record<number, boolean> = {};
    unpaidVouchers.forEach((v: any) => { selected[v.id] = false; });
    setSelectedVouchers(selected);
    const totalNet = unpaidVouchers.reduce((s: number, v: any) => s + parseFloat(v.total_net || 0) - parseFloat(v.cash_on_tour || 0), 0);
    setOpPayForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '', amount: String(Math.max(0, Math.round(totalNet))) });
    setShowOpPayModal(true);
  };

  const selectedTotal = useMemo(() => {
    if (!opPayCompany) return 0;
    return (opPayCompany.vouchers || [])
      .filter((v: any) => selectedVouchers[v.id])
      .reduce((s: number, v: any) => s + Math.max(0, parseFloat(v.total_net || 0) - parseFloat(v.cash_on_tour || 0)), 0);
  }, [selectedVouchers, opPayCompany]);

  const saveOpPayment = async () => {
    if (!opPayCompany) return;
    const voucherIds = Object.entries(selectedVouchers).filter(([, v]) => v).map(([k]) => Number(k));
    if (voucherIds.length === 0) { alert('Выберите хотя бы один ваучер'); return; }
    try {
      await api.payOperatorVouchers({
        voucherIds,
        companyId: opPayCompany.company_id,
        paymentDate: opPayForm.paymentDate,
        paymentMethod: opPayForm.paymentMethod || null,
        amount: Number(opPayForm.amount),
        notes: opPayForm.notes || null,
      });
      setShowOpPayModal(false);
      setSelectedVouchers({});
      loadData();
    } catch (err) {
      alert('Ошибка сохранения');
    }
  };

  // ===== WRITE-OFF HANDLER =====
  const openWriteOffModal = (company: any) => {
    setWriteOffCompany(company);
    const debt = Math.max(0, parseFloat(company.total_owed_to_operator || 0) - parseFloat(company.total_sent_to_operator || 0));
    setWriteOffForm({
      paymentDate: new Date().toISOString().split('T')[0],
      amount: String(Math.round(debt)),
      paymentMethod: '',
      category: 'Оплата оператору',
      notes: '',
      markAllPaid: true,
    });
    setShowWriteOffModal(true);
  };

  const saveWriteOff = async () => {
    if (!writeOffCompany) return;
    if (!writeOffForm.amount || parseFloat(writeOffForm.amount) <= 0) {
      alert('Укажите сумму');
      return;
    }
    try {
      await api.writeOffOperatorDebt({
        companyId: writeOffCompany.company_id,
        amount: parseFloat(writeOffForm.amount),
        paymentDate: writeOffForm.paymentDate,
        paymentMethod: writeOffForm.paymentMethod || null,
        category: writeOffForm.category || 'Оплата оператору',
        notes: writeOffForm.notes || null,
        markAllPaid: writeOffForm.markAllPaid,
      });
      setShowWriteOffModal(false);
      loadData();
      api.getAccountingDashboard().then(r => setDashboardData(r.data)).catch(() => {});
    } catch (err) {
      alert('Ошибка сохранения');
    }
  };

  // ===== EMPLOYEE ACTIONS =====
  const openAddEmpPayment = (emp: any) => {
    setSelectedEmployee(emp);
    setEditingEmpPayment(null);
    setEmpForm({
      paymentDate: new Date().toISOString().split('T')[0],
      amount: '', paymentType: 'salary', paymentMethod: '', notes: '',
    });
    setShowEmpModal(true);
  };

  const openEditEmpPayment = (emp: any, payment: any) => {
    setSelectedEmployee(emp);
    setEditingEmpPayment(payment);
    setEmpForm({
      paymentDate: payment.payment_date?.split('T')[0] || '',
      amount: payment.amount,
      paymentType: payment.payment_type || 'salary',
      paymentMethod: payment.payment_method || '',
      notes: payment.notes || '',
    });
    setShowEmpModal(true);
  };

  const saveEmpPayment = async () => {
    if (!selectedEmployee) return;
    try {
      const data = {
        userId: selectedEmployee.id,
        paymentDate: empForm.paymentDate,
        amount: empForm.amount,
        paymentType: empForm.paymentType,
        paymentMethod: empForm.paymentMethod || null,
        notes: empForm.notes || null,
      };
      if (editingEmpPayment) {
        await api.updateEmployeePayment(editingEmpPayment.id, data);
      } else {
        await api.addEmployeePayment(data);
      }
      setShowEmpModal(false);
      loadData();
    } catch (err) {
      alert('Ошибка сохранения');
    }
  };

  const deleteEmpPayment = async (id: number) => {
    if (!confirm('Удалить выплату?')) return;
    try {
      await api.deleteEmployeePayment(id);
      loadData();
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  const saveSalary = async (userId: number) => {
    const val = editingSalary[userId];
    if (val === undefined) return;
    try {
      await api.updateEmployeeSalaryPct(userId, parseFloat(val));
      setEditingSalary(prev => { const n = { ...prev }; delete n[userId]; return n; });
      loadData();
    } catch (err) {
      alert('Ошибка сохранения ставки');
    }
  };

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200';

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Бухгалтерия</h1>

      {/* ===== DASHBOARD ===== */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">

          {/* Cash by method */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">Касса (всё время)</div>
            {dashboardData.cashByMethod.length === 0 && (
              <div className="text-sm text-gray-400">Нет данных</div>
            )}
            {dashboardData.cashByMethod.map((m: any) => (
              <div key={m.payment_method} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{m.payment_method}</span>
                <span className={`text-sm font-semibold ${parseFloat(m.balance) >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                  {fmt(m.balance)} ฿
                </span>
              </div>
            ))}
            {dashboardData.cashByMethod.length > 0 && (
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                <span className="text-xs font-semibold text-gray-500">ИТОГО</span>
                <span className="text-sm font-bold text-blue-700">
                  {fmt(dashboardData.cashByMethod.reduce((s: number, m: any) => s + parseFloat(m.balance), 0))} ฿
                </span>
              </div>
            )}
          </div>

          {/* Revenue this month */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">Выручка (этот месяц)</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Продажи</span>
                <span className="text-sm font-semibold text-gray-800">{fmt(dashboardData.thisMonth.totalSale)} ฿</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Прибыль</span>
                <span className="text-sm font-semibold text-green-700">{fmt(dashboardData.thisMonth.profit)} ฿</span>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <div className="text-xs text-gray-400 mb-1">Сегодня</div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Продажи</span>
                  <span className="text-xs font-medium text-gray-700">{fmt(dashboardData.thisMonth.today.totalSale)} ฿</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Прибыль</span>
                  <span className="text-xs font-medium text-green-600">{fmt(dashboardData.thisMonth.today.profit)} ฿</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operator debt */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">Долг операторам</div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold ${dashboardData.operatorDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(dashboardData.operatorDebt)} ฿
                </span>
                <span className="text-xs text-gray-400">🇹🇭 Тай</span>
              </div>
              {dashboardData.operatorDebtVND > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-orange-600">
                    {Number(dashboardData.operatorDebtVND).toLocaleString('ru-RU')} ₫
                  </span>
                  <span className="text-xs text-gray-400">🇻🇳 Вьетнам</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {(dashboardData.operatorDebt > 0 || dashboardData.operatorDebtVND > 0) ? 'Нужно заплатить операторам' : 'Долгов нет'}
            </div>
            <button
              onClick={() => setActiveTab('operators')}
              className="mt-3 text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Смотреть детали
            </button>
          </div>

          {/* Salaries */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">Зарплаты (этот месяц)</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Начислено</span>
                <span className="text-sm font-semibold text-gray-800">{fmt(dashboardData.salaries.calculated)} ฿</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Выплачено</span>
                <span className="text-sm font-semibold text-blue-700">{fmt(dashboardData.salaries.paid)} ฿</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-sm text-gray-500">Остаток</span>
                <span className={`text-sm font-bold ${dashboardData.salaries.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(dashboardData.salaries.remaining)} ฿
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-3 mb-5 bg-white p-4 rounded-xl border border-gray-200">
        <div>
          <label className={labelCls}>Дата с</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls + ' w-36'} />
        </div>
        <div>
          <label className={labelCls}>по</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls + ' w-36'} />
        </div>
        <button onClick={setCurrentMonth} className={btnSecondary}>Текущий месяц</button>
        <button onClick={setPrevMonth} className={btnSecondary}>Прошлый месяц</button>
        <button onClick={loadData} className={btnPrimary}>Обновить</button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 ml-auto"
        >
          {exporting ? '⏳ Формирую...' : 'Экспорт XLS'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {([
          { key: 'cashflow', label: 'Движение средств' },
          { key: 'operators', label: 'Оплата счетов' },
          { key: 'employees', label: 'Сотрудники' },
          { key: 'accounting', label: 'Бух. отчёт' },
        ] as { key: Tab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Загрузка...</div>}

      {/* ===== TAB 1: CASHFLOW ===== */}
      {!loading && activeTab === 'cashflow' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700">Движение средств</h2>
            <button onClick={openAddEntry} className={btnPrimary}>+ Добавить запись</button>
          </div>

          {/* Balance by payment method (current period) */}
          {cashflowData && cashflowData.entries.length > 0 && (() => {
            const byMethod: Record<string, number> = {};
            cashflowData.entries.forEach((e: any) => {
              const m = e.payment_method || 'Не указан';
              const amt = parseFloat(e.amount);
              byMethod[m] = (byMethod[m] || 0) + (e.entry_type === 'income' ? amt : -amt);
            });
            const methods = Object.entries(byMethod).filter(([, v]) => v !== 0);
            if (methods.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-2 mb-3">
                {methods.map(([method, balance]) => (
                  <div key={method} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-500 text-xs">{method}</span>
                    <span className={`ml-2 font-semibold ${balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmt(balance)} ฿
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Method filter buttons */}
          <div className="flex flex-wrap gap-1 mb-3">
            <button
              onClick={() => setCfMethodFilter('')}
              className={`px-3 py-1 text-xs rounded-full border transition ${cfMethodFilter === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              Все
            </button>
            {PAYMENT_METHODS.map(m => (
              <button
                key={m}
                onClick={() => setCfMethodFilter(cfMethodFilter === m ? '' : m)}
                className={`px-3 py-1 text-xs rounded-full border transition ${cfMethodFilter === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className={thCls}>Дата</th>
                  <th className={thCls}>Тип</th>
                  <th className={thCls}>Категория</th>
                  <th className={thCls}>Контрагент</th>
                  <th className={thCls}>Метод оплаты</th>
                  <th className={thCls + ' text-right'}>Приход</th>
                  <th className={thCls + ' text-right'}>Расход</th>
                  <th className={thCls + ' text-right'}>Остаток</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">Нет записей за период</td></tr>
                )}
                {filteredEntries.map((entry: any) => {
                  const isAuto = entry.source === 'auto';
                  const isIncome = entry.entry_type === 'income';
                  return (
                    <tr key={entry.id} className={`border-b border-gray-100 ${isAuto ? 'bg-gray-50' : 'hover:bg-blue-50 cursor-pointer'}`}
                      onClick={() => !isAuto && openEditEntry(entry)}>
                      <td className="px-3 py-2 text-gray-600">
                        {new Date(entry.entry_date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isIncome ? 'Приход' : 'Расход'}
                        </span>
                        {isAuto && <span className="ml-1 text-xs text-gray-400">авто</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{entry.category || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="text-gray-800">{entry.counterparty_name || entry.company_name || '—'}</div>
                        {entry.linked_voucher_number && (
                          <Link to={`/vouchers/${entry.linked_voucher_id}`} onClick={e => e.stopPropagation()}
                            className="text-xs text-blue-500 hover:underline">
                            #{entry.linked_voucher_number}
                          </Link>
                        )}
                        {entry.invoice_number && <div className="text-xs text-indigo-500">📄 {entry.invoice_number}</div>}
                        {entry.notes && <div className="text-xs text-gray-400">{entry.notes}</div>}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{entry.payment_method || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-600">
                        {isIncome ? `+${fmt(entry.amount)}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-red-600">
                        {!isIncome ? `-${fmt(entry.amount)}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        {fmt(entry.running_balance)} ฿
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        {!isAuto && (
                          <button onClick={() => deleteEntry(entry.id)} className={btnDanger}>✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {cashflowData?.summary && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                    <td colSpan={5} className="px-3 py-3 text-gray-600">Итого за период</td>
                    <td className="px-3 py-3 text-right text-green-700">+{fmt(cashflowData.summary.total_income)} ฿</td>
                    <td className="px-3 py-3 text-right text-red-700">-{fmt(cashflowData.summary.total_expense)} ฿</td>
                    <td className={`px-3 py-3 text-right text-lg font-bold ${cashflowData.summary.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(cashflowData.summary.balance)} ฿
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB 2: OPERATORS (Оплата счетов) ===== */}
      {!loading && activeTab === 'operators' && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-700">Оплата счетов</h2>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                <button onClick={() => setOperatorsCurrency('')} className={`px-2 py-1.5 ${operatorsCurrency === '' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Все</button>
                <button onClick={() => setOperatorsCurrency('THB')} className={`px-2 py-1.5 ${operatorsCurrency === 'THB' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🇹🇭 Тай</button>
                <button onClick={() => setOperatorsCurrency('VND')} className={`px-2 py-1.5 ${operatorsCurrency === 'VND' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🇻🇳 Вьетнам</button>
              </div>
              <button
                onClick={() => setShowPaidVouchers(v => !v)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${showPaidVouchers ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {showPaidVouchers ? '👁 Все ваучеры' : '✓ Скрыть оплаченные'}
              </button>
              <button
                onClick={() => setOperatorsAllTime(v => !v)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition font-medium ${operatorsAllTime ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {operatorsAllTime ? '🌐 За всё время' : '📅 За период'}
              </button>
            </div>
          </div>
          {operatorsAllTime && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Показаны данные за <strong>всё время</strong> — накопленный долг/переплата
            </div>
          )}
          {operatorsCurrency === '' && (
            <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
              ⚠️ Показаны все валюты — суммы THB и VND несопоставимы. Используйте фильтр <strong>🇹🇭 Тай</strong> или <strong>🇻🇳 Вьетнам</strong> для корректных данных.
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className={thCls}>Компания</th>
                  <th className={thCls + ' text-right'}>Ваучеров</th>
                  <th className={thCls + ' text-right'}>К оплате (нетто − кэш)</th>
                  <th className={thCls + ' text-right'}>Отправлено</th>
                  <th className={thCls + ' text-right'}>Баланс {operatorsCurrency === 'VND' ? '₫' : '฿'}</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {operatorsData.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Нет данных за период</td></tr>
                )}
                {operatorsData.map((op: any) => {
                  const balance = parseFloat(op.balance);
                  const isExpanded = expandedOperator === op.company_id;
                  const rowBg = balance > 0 ? 'bg-green-50' : balance < 0 ? 'bg-red-50' : '';
                  const balanceColor = balance > 0 ? 'text-green-700 font-bold' : balance < 0 ? 'text-red-700 font-bold' : 'text-gray-500';
                  const visibleVouchers = (op.vouchers || []).filter((v: any) => showPaidVouchers || !v.operator_paid);
                  const sym = operatorsCurrency === 'VND' ? '₫' : '฿';
                  return (
                    <React.Fragment key={op.company_id}>
                      <tr className={`border-b border-gray-100 cursor-pointer hover:brightness-95 ${rowBg}`}
                        onClick={() => setExpandedOperator(isExpanded ? null : op.company_id)}>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {isExpanded ? '▼' : '▶'} {op.company_name}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{op.voucher_count}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(op.total_owed_to_operator)} {sym}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(op.total_sent_to_operator)} {sym}</td>
                        <td className={`px-3 py-2.5 text-right ${balanceColor}`}>
                          {balance > 0 ? '+' : ''}{fmt(balance)} {sym}
                          {balance > 0 && <span className="ml-1 text-xs">🟢</span>}
                          {balance < 0 && <span className="ml-1 text-xs">🔴</span>}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={() => openOpPayModal(op)} className={btnPrimary + ' text-xs'}>
                              + Оплатить
                            </button>
                            <button onClick={() => openWriteOffModal(op)} className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded border border-orange-200 hover:bg-orange-100 transition">
                              Списать
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={rowBg}>
                          <td colSpan={6} className="px-6 py-3">
                            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase">Ваучеры:</div>
                            {visibleVouchers.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="text-xs w-full">
                                  <thead>
                                    <tr className="text-gray-400">
                                      <th className="text-left py-1 pr-2 w-6"></th>
                                      <th className="text-left py-1 pr-4">Ваучер</th>
                                      <th className="text-left py-1 pr-4">Дата тура</th>
                                      <th className="text-right py-1 pr-4">Нетто</th>
                                      <th className="text-right py-1 pr-4">Кэш</th>
                                      <th className="text-right py-1 pr-4">К оплате</th>
                                      <th className="text-left py-1 pr-4">Статус клиента</th>
                                      <th className="text-left py-1">Оплачено опер.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleVouchers.map((v: any) => {
                                      const net = parseFloat(v.total_net || 0);
                                      const cash = parseFloat(v.cash_on_tour || 0);
                                      const due = Math.max(0, net - cash);
                                      return (
                                        <tr key={v.id} className={`border-t border-gray-100 ${v.operator_paid ? 'opacity-50' : ''}`}>
                                          <td className="py-1 pr-2">
                                            {!v.operator_paid && (
                                              <input type="checkbox" className="rounded"
                                                checked={!!selectedVouchers[v.id]}
                                                onChange={e => {
                                                  e.stopPropagation();
                                                  setSelectedVouchers(prev => ({ ...prev, [v.id]: e.target.checked }));
                                                }}
                                              />
                                            )}
                                          </td>
                                          <td className="py-1 pr-4">
                                            <Link to={`/vouchers/${v.id}`} className="text-blue-600 hover:underline font-medium">
                                              #{v.voucher_number}
                                            </Link>
                                          </td>
                                          <td className="py-1 pr-4 text-gray-600">
                                            {v.tour_date ? new Date(v.tour_date).toLocaleDateString('ru-RU') : '—'}
                                          </td>
                                          <td className="py-1 pr-4 text-right text-gray-700">{fmt(net)} ฿</td>
                                          <td className="py-1 pr-4 text-right text-blue-600">{cash > 0 ? `${fmt(cash)} ฿` : '—'}</td>
                                          <td className="py-1 pr-4 text-right font-semibold text-gray-800">{fmt(due)} ฿</td>
                                          <td className="py-1 pr-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                                              v.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                              v.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-gray-100 text-gray-500'
                                            }`}>
                                              {v.payment_status === 'paid' ? 'Оплачен' :
                                               v.payment_status === 'partial' ? 'Частично' : 'Не оплачен'}
                                            </span>
                                          </td>
                                          <td className="py-1">
                                            {v.operator_paid
                                              ? <span className="text-green-600 font-bold">✓ Оплачено</span>
                                              : <span className="text-gray-400">—</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-xs">Нет ваучеров за период</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Списание долга — модал */}
          {showWriteOffModal && writeOffCompany && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Списание долга</h3>
                <div className="text-sm text-gray-500 mb-1">{writeOffCompany.company_name}</div>
                <div className="text-xs text-gray-400 mb-4">
                  Долг: {fmt(Math.max(0, parseFloat(writeOffCompany.total_owed_to_operator || 0) - parseFloat(writeOffCompany.total_sent_to_operator || 0)))} {operatorsCurrency === 'VND' ? '₫' : '฿'}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Дата *</label>
                    <input type="date" value={writeOffForm.paymentDate}
                      onChange={e => setWriteOffForm(p => ({ ...p, paymentDate: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Сумма *</label>
                    <input type="number" value={writeOffForm.amount} min="0" step="1"
                      onChange={e => setWriteOffForm(p => ({ ...p, amount: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Метод оплаты</label>
                    <select value={writeOffForm.paymentMethod}
                      onChange={e => setWriteOffForm(p => ({ ...p, paymentMethod: e.target.value }))}
                      className={inputCls}>
                      <option value="">Не указан</option>
                      {PAYMENT_METHODS.filter(m => m !== 'Депозит в компанию').map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Категория</label>
                    <input type="text" value={writeOffForm.category}
                      onChange={e => setWriteOffForm(p => ({ ...p, category: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Примечание</label>
                    <input type="text" value={writeOffForm.notes}
                      onChange={e => setWriteOffForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Счёт №, доп. информация..."
                      className={inputCls} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={writeOffForm.markAllPaid}
                      onChange={e => setWriteOffForm(p => ({ ...p, markAllPaid: e.target.checked }))}
                      className="rounded" />
                    <span className="text-sm text-gray-700">Отметить все ваучеры как оплаченные оператору</span>
                  </label>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowWriteOffModal(false)} className={btnSecondary}>Отмена</button>
                  <button onClick={saveWriteOff} className="px-4 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition">
                    Списать долг
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Оплата оператору — модал */}
          {showOpPayModal && opPayCompany && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Оплата оператору</h3>
                <div className="text-sm text-gray-500 mb-4">{opPayCompany.company_name}</div>

                {/* Список ваучеров с чекбоксами */}
                <div className="border rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left w-6">
                          <input type="checkbox"
                            onChange={e => {
                              const unpaid = (opPayCompany.vouchers || []).filter((v: any) => !v.operator_paid);
                              const next: Record<number, boolean> = {};
                              unpaid.forEach((v: any) => { next[v.id] = e.target.checked; });
                              setSelectedVouchers(next);
                            }}
                            checked={(opPayCompany.vouchers || []).filter((v: any) => !v.operator_paid).every((v: any) => selectedVouchers[v.id])}
                          />
                        </th>
                        <th className="px-2 py-1.5 text-left">Ваучер</th>
                        <th className="px-2 py-1.5 text-left">Дата тура</th>
                        <th className="px-2 py-1.5 text-right">К оплате</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(opPayCompany.vouchers || []).filter((v: any) => !v.operator_paid).map((v: any) => {
                        const due = Math.max(0, parseFloat(v.total_net || 0) - parseFloat(v.cash_on_tour || 0));
                        return (
                          <tr key={v.id} className={`border-t border-gray-100 ${selectedVouchers[v.id] ? 'bg-blue-50' : ''}`}>
                            <td className="px-2 py-1.5">
                              <input type="checkbox" checked={!!selectedVouchers[v.id]}
                                onChange={e => setSelectedVouchers(prev => ({ ...prev, [v.id]: e.target.checked }))} />
                            </td>
                            <td className="px-2 py-1.5 font-medium">#{v.voucher_number}</td>
                            <td className="px-2 py-1.5 text-gray-500">
                              {v.tour_date ? new Date(v.tour_date).toLocaleDateString('ru-RU') : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">{fmt(due)} ฿</td>
                          </tr>
                        );
                      })}
                      {(opPayCompany.vouchers || []).filter((v: any) => !v.operator_paid).length === 0 && (
                        <tr><td colSpan={4} className="text-center py-4 text-gray-400">Все ваучеры оплачены</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Итого выбрано */}
                <div className="flex justify-between items-center mb-4 px-2 py-2 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">Выбрано ваучеров: {Object.values(selectedVouchers).filter(Boolean).length}</span>
                  <span className="text-base font-bold text-blue-700">{fmt(selectedTotal)} ฿</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Дата оплаты *</label>
                    <input type="date" value={opPayForm.paymentDate}
                      onChange={e => setOpPayForm(p => ({ ...p, paymentDate: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Метод оплаты</label>
                    <select value={opPayForm.paymentMethod} onChange={e => setOpPayForm(p => ({ ...p, paymentMethod: e.target.value }))} className={inputCls}>
                      <option value="">Не указан</option>
                      {PAYMENT_METHODS.filter(m => m !== 'Депозит в компанию').map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Сумма оплаты *</label>
                    <input type="number" value={opPayForm.amount} min="0" step="1"
                      onChange={e => setOpPayForm(p => ({ ...p, amount: e.target.value }))}
                      className={inputCls} />
                    <button type="button" className="text-xs text-blue-500 mt-1 hover:underline"
                      onClick={() => setOpPayForm(p => ({ ...p, amount: String(Math.round(selectedTotal)) }))}>
                      ← Использовать сумму выбранных ({fmt(selectedTotal)} ฿)
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>Примечание</label>
                    <input type="text" value={opPayForm.notes} onChange={e => setOpPayForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} placeholder="Счёт №..." />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowOpPayModal(false)} className={btnSecondary}>Отмена</button>
                  <button onClick={saveOpPayment} className={btnPrimary}>Сохранить оплату</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 3: EMPLOYEES ===== */}
      {!loading && activeTab === 'employees' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Сотрудники</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employeesData.map((emp: any) => {
              const totalPaid = parseFloat(emp.total_paid || 0);
              const calcSalary = parseFloat(emp.calculated_salary || 0);
              const remaining = calcSalary - totalPaid;
              const salaryEditing = editingSalary[emp.id] !== undefined;
              return (
                <div key={emp.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  {/* Employee header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-gray-800 text-base">{emp.full_name}</div>
                      <div className="text-xs text-gray-400 capitalize">{emp.role}{emp.commission_percentage ? ` · ${emp.commission_percentage}% от прибыли` : ''}</div>
                    </div>
                    <button onClick={() => openAddEmpPayment(emp)} className={btnPrimary + ' text-xs'}>+ Выплата</button>
                  </div>

                  {/* Commission % row */}
                  <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-500">Ставка:</span>
                    {salaryEditing ? (
                      <>
                        <input
                          type="number"
                          value={editingSalary[emp.id]}
                          onChange={e => setEditingSalary(prev => ({ ...prev, [emp.id]: e.target.value }))}
                          className="border border-blue-300 rounded px-2 py-0.5 text-sm w-24"
                          autoFocus
                          placeholder="%"
                        />
                        <button onClick={() => saveSalary(emp.id)} className="text-xs text-blue-600 hover:text-blue-800">Сохранить</button>
                        <button onClick={() => setEditingSalary(prev => { const n = { ...prev }; delete n[emp.id]; return n; })}
                          className="text-xs text-gray-400 hover:text-gray-600">Отмена</button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-gray-700">{emp.commission_percentage || 0}%</span>
                        <span className="text-xs text-gray-400">от прибыли после агентов</span>
                        <button onClick={() => setEditingSalary(prev => ({ ...prev, [emp.id]: String(emp.commission_percentage || 0) }))}
                          className="text-xs text-blue-500 hover:text-blue-700 ml-auto">✏</button>
                      </>
                    )}
                  </div>

                  {/* Period summary */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                    <div className="p-2 bg-purple-50 rounded">
                      <div className="text-gray-500">Начислено</div>
                      <div className="font-bold text-purple-700">{fmt(calcSalary)} ฿</div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="text-gray-500">Выплачено</div>
                      <div className="font-bold text-blue-700">{fmt(totalPaid)} ฿</div>
                    </div>
                    <div className={`p-2 rounded ${remaining <= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-gray-500">Остаток</div>
                      <div className={`font-bold ${remaining <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {fmt(remaining)} ฿
                      </div>
                    </div>
                  </div>

                  {/* Payment history */}
                  {Array.isArray(emp.payments) && emp.payments.length > 0 ? (
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase mb-1">История выплат</div>
                      <div className="space-y-1">
                        {emp.payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center py-1 px-2 rounded hover:bg-gray-50 text-xs">
                            <div>
                              <span className="text-gray-500">{new Date(p.payment_date).toLocaleDateString('ru-RU')}</span>
                              <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                {EMPLOYEE_PAYMENT_TYPES.find(t => t.value === p.payment_type)?.label || p.payment_type}
                              </span>
                              {p.payment_method && <span className="ml-1 text-gray-400">{p.payment_method}</span>}
                              {p.notes && <span className="ml-1 text-gray-400 italic">{p.notes}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-700">{fmt(p.amount)} ฿</span>
                              <button onClick={() => openEditEmpPayment(emp, p)} className="text-blue-400 hover:text-blue-600">✏</button>
                              <button onClick={() => deleteEmpPayment(p.id)} className="text-red-400 hover:text-red-600">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2">Выплат за период нет</div>
                  )}
                </div>
              );
            })}
            {employeesData.length === 0 && (
              <div className="col-span-2 text-center py-10 text-gray-400">Нет данных</div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB 4: ACCOUNTING DETAIL ===== */}
      {!loading && activeTab === 'accounting' && (
        <AccountingDetailTable rows={accountingDetail} onConfirmToggle={loadData} />
      )}

      {/* ===== CASHFLOW MODAL ===== */}
      {showCFModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editingEntry ? 'Редактировать запись' : 'Добавить запись'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Дата *</label>
                <input type="date" value={cfForm.entryDate}
                  onChange={e => setCfForm(p => ({ ...p, entryDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Тип *</label>
                <select value={cfForm.entryType}
                  onChange={e => setCfForm(p => ({ ...p, entryType: e.target.value }))} className={inputCls}>
                  <option value="income">Приход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Категория</label>
                <select value={cfForm.category}
                  onChange={e => setCfForm(p => ({ ...p, category: e.target.value }))} className={inputCls}>
                  <option value="">Не указана</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Метод оплаты</label>
                <select value={cfForm.paymentMethod}
                  onChange={e => setCfForm(p => ({ ...p, paymentMethod: e.target.value }))} className={inputCls}>
                  <option value="">Не указан</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Контрагент</label>
                <input type="text" value={cfForm.counterpartyName}
                  onChange={e => setCfForm(p => ({ ...p, counterpartyName: e.target.value }))}
                  placeholder="Название или имя" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Туроператор (связать)</label>
                <select value={cfForm.companyId}
                  onChange={e => setCfForm(p => ({ ...p, companyId: e.target.value }))} className={inputCls}>
                  <option value="">Не указан</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Сумма (฿) *</label>
                <input type="number" value={cfForm.amount}
                  onChange={e => setCfForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Номер счёта / инвойса</label>
                <input type="text" value={cfForm.invoiceNumber}
                  onChange={e => setCfForm(p => ({ ...p, invoiceNumber: e.target.value }))}
                  placeholder="Необязательно" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Примечание</label>
                <input type="text" value={cfForm.notes}
                  onChange={e => setCfForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveCFEntry} className={btnPrimary + ' flex-1'}>Сохранить</button>
              <button onClick={() => setShowCFModal(false)} className={btnSecondary + ' flex-1'}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EMPLOYEE PAYMENT MODAL ===== */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {editingEmpPayment ? 'Редактировать выплату' : 'Добавить выплату'}
            </h3>
            {selectedEmployee && (
              <div className="text-sm text-gray-500 mb-4">{selectedEmployee.full_name}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Дата *</label>
                <input type="date" value={empForm.paymentDate}
                  onChange={e => setEmpForm(p => ({ ...p, paymentDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Тип</label>
                <select value={empForm.paymentType}
                  onChange={e => setEmpForm(p => ({ ...p, paymentType: e.target.value }))} className={inputCls}>
                  {EMPLOYEE_PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Метод оплаты</label>
                <select value={empForm.paymentMethod}
                  onChange={e => setEmpForm(p => ({ ...p, paymentMethod: e.target.value }))} className={inputCls}>
                  <option value="">Не указан</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Сумма (฿) *</label>
                <input type="number" value={empForm.amount}
                  onChange={e => setEmpForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Примечание</label>
                <input type="text" value={empForm.notes}
                  onChange={e => setEmpForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveEmpPayment} className={btnPrimary + ' flex-1'}>Сохранить</button>
              <button onClick={() => setShowEmpModal(false)} className={btnSecondary + ' flex-1'}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ACCOUNTING DETAIL TABLE ──
const AccountingDetailTable: React.FC<{ rows: any[]; onConfirmToggle: () => void }> = ({ rows, onConfirmToggle }) => {
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const toggleConfirm = async (id: number, field: string) => {
    const key = `${id}_${field}`;
    if (confirming === key) return;
    setConfirming(key);
    try {
      await api.confirmVoucher(id, field);
      onConfirmToggle();
    } catch (e) {
      alert('Ошибка сохранения');
    } finally {
      setConfirming(null);
    }
  };

  const thCls = 'px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200';
  const tdCls = 'px-2 py-1.5 text-xs whitespace-nowrap';
  const tdR   = 'px-2 py-1.5 text-xs text-right whitespace-nowrap';

  if (rows.length === 0) return <div className="py-6 text-center text-gray-400">Нет данных</div>;

  const STATUS_ROW_CLS: Record<string, string> = {
    paid: 'bg-green-50',
    partial: 'bg-yellow-50',
    unpaid: 'bg-red-50',
  };
  const STATUS_LABEL: Record<string, string> = { paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен' };

  const fB = (v: number) => `฿${v.toLocaleString('ru', { minimumFractionDigits: 0 })}`;
  const fD = (v: any) => v ? new Date(v).toLocaleDateString('ru') : '—';

  const totals = rows.reduce((acc, r) => {
    acc.adults += Number(r.adults || 0);
    acc.children += Number(r.children || 0);
    acc.paid += Number(r.paid_to_agency || 0);
    acc.cash += Number(r.cash_on_tour || 0);
    acc.sale += Number(r.total_sale || 0);
    acc.net += Number(r.total_net || 0);
    acc.profit += Number(r.profit || 0);
    acc.agentComm += Number(r.agent_commission || 0);
    acc.profitAg += Number(r.profit_after_agent || 0);
    acc.managerPay += Number(r.manager_pay || 0);
    return acc;
  }, { adults: 0, children: 0, paid: 0, cash: 0, sale: 0, net: 0, profit: 0, agentComm: 0, profitAg: 0, managerPay: 0 });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <span className="text-xs text-gray-500">Ваучеров: {rows.length}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className={thCls}>Дата соз.</th>
            <th className={thCls}>Дата выезда</th>
            <th className={thCls}>Компания</th>
            <th className={thCls}>Тур</th>
            <th className={thCls + ' text-right'}>Взр</th>
            <th className={thCls + ' text-right'}>Дет</th>
            <th className={thCls + ' text-right'}>Мл</th>
            <th className={thCls}>Ваучер №</th>
            <th className={thCls + ' text-right'}>Оплачено</th>
            <th className={thCls + ' text-right'}>Cash on tour</th>
            <th className={thCls + ' text-right'}>Sale</th>
            <th className={thCls + ' text-right'}>Нетто</th>
            <th className={thCls + ' text-right'}>Профит</th>
            <th className={thCls}>Агент%</th>
            <th className={thCls + ' text-right'}>Ком.агента</th>
            <th className={thCls + ' text-right'}>Профит-Аг</th>
            <th className={thCls + ' text-right'}>Зарплата</th>
            <th className={thCls}>Статус счёта</th>
            <th className={thCls}>Статус оплаты</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rowBg = STATUS_ROW_CLS[r.payment_status] || '';
            const mgrConf = r.agent_manager_confirmed;
            const accConf = r.agent_accountant_confirmed;
            const confirmedCount = (mgrConf ? 1 : 0) + (accConf ? 1 : 0);
            const paidCls = confirmedCount === 0
              ? 'text-red-700 bg-red-100 rounded px-1'
              : confirmedCount === 1
              ? 'text-yellow-700 bg-yellow-100 rounded px-1'
              : 'text-green-700 bg-green-100 rounded px-1';

            return (
              <tr key={r.id} className={`border-b border-gray-100 hover:brightness-95 ${rowBg}`}>
                <td className={tdCls}>{fD(r.created_at)}</td>
                <td className={tdCls}>{fD(r.tour_date)}</td>
                <td className={tdCls + ' max-w-[120px] truncate'} title={r.company_name}>{r.company_name || '—'}</td>
                <td className={tdCls + ' max-w-[140px] truncate'} title={r.tour_name}>{r.tour_name || '—'}</td>
                <td className={tdR}>{r.adults}</td>
                <td className={tdR}>{r.children}</td>
                <td className={tdR}>{r.infants}</td>
                <td className={tdCls + ' font-medium text-blue-700'}>{r.voucher_number || '—'}</td>
                <td className={tdR + ' ' + paidCls}>{fB(Number(r.paid_to_agency || 0))}</td>
                <td className={tdR}>{fB(Number(r.cash_on_tour || 0))}</td>
                <td className={tdR + ' font-medium'}>{fB(Number(r.total_sale || 0))}</td>
                <td className={tdR}>{fB(Number(r.total_net || 0))}</td>
                <td className={tdR + ' font-semibold ' + (Number(r.profit) >= 0 ? 'text-green-700' : 'text-red-600')}>{fB(Number(r.profit || 0))}</td>
                <td className={tdCls}>{r.agent_name ? `${r.agent_name} (${r.agent_commission_percentage}%)` : '—'}</td>
                <td className={tdR}>{fB(Number(r.agent_commission || 0))}</td>
                <td className={tdR}>{fB(Number(r.profit_after_agent || 0))}</td>
                <td className={tdR + ' font-semibold text-blue-700'}>{fB(Number(r.manager_pay || 0))}</td>
                <td className={tdCls}>
                  <div className="flex flex-col gap-0.5">
                    <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={!!mgrConf}
                        onChange={() => toggleConfirm(r.id, 'agent_manager_confirmed')}
                        disabled={confirming === `${r.id}_agent_manager_confirmed`}
                        className="w-3 h-3"
                      />
                      <span className={mgrConf ? 'text-green-700' : 'text-gray-400'}>Менеджер</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={!!accConf}
                        onChange={() => toggleConfirm(r.id, 'agent_accountant_confirmed')}
                        disabled={confirming === `${r.id}_agent_accountant_confirmed`}
                        className="w-3 h-3"
                      />
                      <span className={accConf ? 'text-green-700' : 'text-gray-400'}>Бухгалтер</span>
                    </label>
                  </div>
                </td>
                <td className={tdCls}>
                  <span className={`font-medium ${r.payment_status === 'paid' ? 'text-green-700' : r.payment_status === 'partial' ? 'text-yellow-700' : 'text-red-600'}`}>
                    {STATUS_LABEL[r.payment_status] || r.payment_status}
                  </span>
                  {r.last_payment_date && <span className="text-gray-400 ml-1">{fD(r.last_payment_date)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100 font-semibold text-xs border-t-2 border-gray-300">
          <tr>
            <td colSpan={4} className="px-2 py-2 text-gray-600">Итого ({rows.length})</td>
            <td className={tdR}>{totals.adults}</td>
            <td className={tdR}>{totals.children}</td>
            <td colSpan={2} />
            <td className={tdR}>{fB(totals.paid)}</td>
            <td className={tdR}>{fB(totals.cash)}</td>
            <td className={tdR}>{fB(totals.sale)}</td>
            <td className={tdR}>{fB(totals.net)}</td>
            <td className={tdR}>{fB(totals.profit)}</td>
            <td />
            <td className={tdR}>{fB(totals.agentComm)}</td>
            <td className={tdR}>{fB(totals.profitAg)}</td>
            <td className={tdR}>{fB(totals.managerPay)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default AccountingPage;
