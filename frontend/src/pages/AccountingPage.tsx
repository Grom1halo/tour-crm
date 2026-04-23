import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../contexts/AuthContext';
// PAYMENT_METHODS constant replaced by dynamic API — see paymentMethods state

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

type Tab = 'cashflow' | 'operators' | 'agents' | 'employees' | 'accounting' | 'revenue';

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
  const { hasRole } = useAuth();
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

  // Cashflow category group filter: '' = все, 'cash' = только касса, 'internal' = операторские и списания
  const [cfCategoryFilter, setCfCategoryFilter] = useState(() => localStorage.getItem('ac_cat') || '');

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
    currency: 'THB',
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
  const [cfSortBy, setCfSortBy] = useState<string>('date');
  const [cfSortDir, setCfSortDir] = useState<'asc' | 'desc'>('asc');
  const [cfCurrency, setCfCurrency] = useState<string>('THB');
  const [showPaidVouchers, setShowPaidVouchers] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState<Record<number, boolean>>({});
  const [voucherSort, setVoucherSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'tour_date', dir: 'asc' });
  const [showOpPayModal, setShowOpPayModal] = useState(false);
  const [opPayCompany, setOpPayCompany] = useState<any>(null);
  const [opPayForm, setOpPayForm] = useState({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '', amount: '' });

  // Agents tab
  const [agentsData, setAgentsData] = useState<any[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [agentsAllTime, setAgentsAllTime] = useState(false);
  const [showPaidAgentVouchers, setShowPaidAgentVouchers] = useState(false);
  const [selectedAgentVouchers, setSelectedAgentVouchers] = useState<Record<number, boolean>>({});
  const [showAgentPayModal, setShowAgentPayModal] = useState(false);
  const [agentPayAgent, setAgentPayAgent] = useState<any>(null);
  const [agentPayForm, setAgentPayForm] = useState({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '', amount: '' });
  const [agentSearch, setAgentSearch] = useState('');
  const [showAgentWriteOffModal, setShowAgentWriteOffModal] = useState(false);
  const [writeOffAgent, setWriteOffAgent] = useState<any>(null);
  const [agentWriteOffForm, setAgentWriteOffForm] = useState({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '' });

  // Operators search
  const [operatorSearch, setOperatorSearch] = useState('');

  // Revenue custom expenses (localStorage)
  const [customExpenses, setCustomExpenses] = useState<{ id: number; name: string; amount: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('rev_custom_expenses') || '[]'); } catch { return []; }
  });
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  // Close period modal
  const [showClosePeriodModal, setShowClosePeriodModal] = useState(false);
  const [closePeriodForm, setClosePeriodForm] = useState({
    beforeDate: new Date().toISOString().split('T')[0],
    companyId: '',
  });
  const [closePeriodResult, setClosePeriodResult] = useState<{ closed: number; writtenOff: number } | null>(null);

  // Manual correction modal (shared for operators & agents)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionContext, setCorrectionContext] = useState<{ type: 'operator' | 'agent'; id: number; name: string; currency: string } | null>(null);
  const [correctionForm, setCorrectionForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', sign: '+' as '+' | '-', notes: '' });

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

  // Revenue tab
  const [revenueData, setRevenueData] = useState<any>(null);
  const [revenueDataAlt, setRevenueDataAlt] = useState<any>(null); // second currency when 'all'
  const [revCurrency, setRevCurrency] = useState('THB');
  const [revDateType, setRevDateType] = useState('sale');
  const [revIncludes, setRevIncludes] = useState({
    agentCommissions: true,
    managerCommissions: true,
    employeePaid: false,
    cashflowExpenses: false,
  });
  const [revShowManagers, setRevShowManagers] = useState(false);

  const [companies, setCompanies] = useState<any[]>([]);
  const [dashboardMonth, setDashboardMonth] = useState<{ year: number; month: number }>(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() + 1 };
  });

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showManageMethods, setShowManageMethods] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<number | null>(null);
  const [editingMethodName, setEditingMethodName] = useState('');
  const [newMethodName, setNewMethodName] = useState('');

  // Balance edit
  const [editingBalanceMethod, setEditingBalanceMethod] = useState<string | null>(null);
  const [editingBalanceValue, setEditingBalanceValue] = useState('');

  // All-time balances by payment method + currency (independent of date filter)
  const [methodBalances, setMethodBalances] = useState<any[]>([]);

  const loadPaymentMethods = useCallback(() => {
    api.getPaymentMethods().then(r => setPaymentMethods(r.data)).catch(() => {});
  }, []);

  const loadMethodBalances = useCallback(() => {
    (api as any).getPaymentMethodBalances().then((r: any) => setMethodBalances(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.getCompanies(false).then(r => setCompanies(r.data)).catch(() => {});
    loadPaymentMethods();
    loadMethodBalances();
  }, [loadPaymentMethods, loadMethodBalances]);

  // Reload dashboard when selected month changes
  useEffect(() => {
    api.getAccountingDashboard({ year: dashboardMonth.year, month: dashboardMonth.month })
      .then(r => setDashboardData(r.data)).catch(() => {});
  }, [dashboardMonth]);

  const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const shiftMonth = (delta: number) => {
    setDashboardMonth(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { year: y, month: m };
    });
  };
  const isCurrentMonth = (() => { const n = new Date(); return dashboardMonth.year === n.getFullYear() && dashboardMonth.month === n.getMonth() + 1; })();

  const methodNames = paymentMethods.map((m: any) => m.name);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { dateFrom, dateTo };
      if (activeTab === 'cashflow') {
        const r = await api.getAccountingCashflow({ ...params, ...(cfCurrency ? { currency: cfCurrency } : {}) });
        setCashflowData(r.data);
      } else if (activeTab === 'operators') {
        const opParams = operatorsAllTime
          ? { allTime: true, ...(operatorsCurrency ? { currency: operatorsCurrency } : {}) }
          : { ...params, ...(operatorsCurrency ? { currency: operatorsCurrency } : {}) };
        const r = await api.getOperatorReconciliation(opParams);
        setOperatorsData(r.data);
      } else if (activeTab === 'agents') {
        const agentParams = agentsAllTime ? { allTime: true } : params;
        const r = await api.getAgentReconciliation(agentParams);
        setAgentsData(r.data);
      } else if (activeTab === 'employees') {
        const r = await api.getEmployeeData(params);
        setEmployeesData(r.data);
      } else if (activeTab === 'accounting') {
        const r = await api.getReportDetail(params);
        setAccountingDetail(r.data);
      } else if (activeTab === 'revenue') {
        if (revCurrency === 'all') {
          const [thb, vnd] = await Promise.all([
            (api as any).getRevenueBreakdown({ ...params, currency: 'THB', dateType: revDateType }),
            (api as any).getRevenueBreakdown({ ...params, currency: 'VND', dateType: revDateType }),
          ]);
          setRevenueData(thb.data);
          setRevenueDataAlt(vnd.data);
        } else {
          const r = await (api as any).getRevenueBreakdown({ ...params, currency: revCurrency, dateType: revDateType });
          setRevenueData(r.data);
          setRevenueDataAlt(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, operatorsAllTime, operatorsCurrency, agentsAllTime, cfCurrency, revCurrency, revDateType]);

  useEffect(() => { loadData(); }, [loadData]);

  // Persist filter state to localStorage
  useEffect(() => { localStorage.setItem('ac_tab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('ac_from', dateFrom); }, [dateFrom]);
  useEffect(() => { localStorage.setItem('ac_to', dateTo); }, [dateTo]);
  useEffect(() => { localStorage.setItem('ac_method', cfMethodFilter); }, [cfMethodFilter]);
  useEffect(() => { localStorage.setItem('ac_cat', cfCategoryFilter); }, [cfCategoryFilter]);

  // Refresh dashboard after cashflow changes
  const reloadAll = () => {
    loadData();
    loadMethodBalances();
    api.getAccountingDashboard().then(r => setDashboardData(r.data)).catch(() => {});
  };

  // ===== DATE SHORTCUTS =====
  const setCurrentMonth = () => { const r = getMonthRange(0); setDateFrom(r.from); setDateTo(r.to); };
  const setPrevMonth = () => { const r = getMonthRange(-1); setDateFrom(r.from); setDateTo(r.to); };

  const handleExport = async (currency?: string) => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (currency) params.set('currency', currency);
      const res = await fetch(`/api/reports/export/accounting?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currency
        ? `accounting_${currency}_${dateFrom}_${dateTo}.xlsx`
        : `accounting_${dateFrom}_${dateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  // ===== FILTERED ENTRIES WITH RECALCULATED BALANCE =====

  // Категории, которые относятся к оплате операторов/агентов, а не к реальному движению кассы
  const INTERNAL_CATEGORIES = ['Комиссия оператору', 'Списание долга', 'Списание долга агенту', 'Ручная коррекция'];

  const filteredEntries = useMemo(() => {
    if (!cashflowData?.entries) return [];
    let entries = cashflowData.entries;

    // Method filter
    if (cfMethodFilter) {
      entries = entries.filter((e: any) => e.payment_method === cfMethodFilter);
    }

    // Category group filter
    if (cfCategoryFilter === 'cash') {
      entries = entries.filter((e: any) => !INTERNAL_CATEGORIES.includes(e.category));
    } else if (cfCategoryFilter === 'internal') {
      entries = entries.filter((e: any) => INTERNAL_CATEGORIES.includes(e.category));
    }

    // Calculate running balance in original (chronological) order
    let bal = 0;
    const withBalance = entries.map((e: any) => {
      const amount = parseFloat(e.amount);
      bal += e.entry_type === 'income' ? amount : -amount;
      return { ...e, running_balance: bal };
    });
    // Apply sort
    if (cfSortBy === 'date') {
      return cfSortDir === 'asc' ? withBalance : [...withBalance].reverse();
    }
    return [...withBalance].sort((a, b) => {
      let va: any, vb: any;
      if (cfSortBy === 'type') { va = a.entry_type; vb = b.entry_type; }
      else if (cfSortBy === 'category') { va = a.category || ''; vb = b.category || ''; }
      else if (cfSortBy === 'counterparty') { va = a.counterparty_name || a.company_name || ''; vb = b.counterparty_name || b.company_name || ''; }
      else if (cfSortBy === 'method') { va = a.payment_method || ''; vb = b.payment_method || ''; }
      else if (cfSortBy === 'amount') { va = parseFloat(a.amount); vb = parseFloat(b.amount); }
      else { va = a.entry_date; vb = b.entry_date; }
      if (typeof va === 'number') return cfSortDir === 'asc' ? va - vb : vb - va;
      return cfSortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [cashflowData, cfMethodFilter, cfCategoryFilter, cfSortBy, cfSortDir]);

  // Summary пересчитывается из filteredEntries (а не из backend summary, который всегда за весь период)
  const filteredSummary = useMemo(() => {
    const income = filteredEntries.filter((e: any) => e.entry_type === 'income').reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const expense = filteredEntries.filter((e: any) => e.entry_type === 'expense').reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    return { total_income: income, total_expense: expense, balance: income - expense };
  }, [filteredEntries]);

  const handleCfSort = (col: string) => {
    if (cfSortBy === col) setCfSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setCfSortBy(col); setCfSortDir('asc'); }
  };
  const sortIcon = (col: string) => cfSortBy === col ? (cfSortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  // ===== CASHFLOW ACTIONS =====
  const openAddEntry = () => {
    setEditingEntry(null);
    setCfForm({
      entryDate: new Date().toISOString().split('T')[0],
      entryType: 'expense', paymentMethod: '', counterpartyName: '', companyId: '', amount: '', notes: '', category: '', invoiceNumber: '', currency: 'THB',
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
      currency: entry.currency || 'THB',
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
        currency: cfForm.currency || 'THB',
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

  const confirmDeposit = async (id: number) => {
    try {
      await api.confirmDepositEntry(id);
      reloadAll();
    } catch (err) {
      alert('Ошибка подтверждения');
    }
  };

  // ===== AGENT PAYMENT HANDLERS =====
  const openAgentPayModal = (agent: any) => {
    setAgentPayAgent(agent);
    const unpaidVouchers = (agent.vouchers || []).filter((v: any) => !v.agent_commission_paid);
    const selected: Record<number, boolean> = {};
    unpaidVouchers.forEach((v: any) => { selected[v.id] = false; });
    setSelectedAgentVouchers(selected);
    const totalComm = unpaidVouchers.reduce((s: number, v: any) => s + parseFloat(v.commission_amount || 0), 0);
    setAgentPayForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '', amount: String(Math.max(0, Math.round(totalComm))) });
    setShowAgentPayModal(true);
  };

  const selectedAgentTotal = useMemo(() => {
    if (!agentPayAgent) return 0;
    return (agentPayAgent.vouchers || [])
      .filter((v: any) => selectedAgentVouchers[v.id])
      .reduce((s: number, v: any) => s + parseFloat(v.commission_amount || 0), 0);
  }, [selectedAgentVouchers, agentPayAgent]);

  const saveAgentPayment = async () => {
    if (!agentPayAgent) return;
    const voucherIds = Object.entries(selectedAgentVouchers).filter(([, v]) => v).map(([k]) => Number(k));
    if (voucherIds.length === 0) { alert('Выберите хотя бы один ваучер'); return; }
    try {
      await api.payAgentVouchers({
        voucherIds,
        agentId: agentPayAgent.agent_id,
        paymentDate: agentPayForm.paymentDate,
        paymentMethod: agentPayForm.paymentMethod || null,
        amount: Number(agentPayForm.amount),
        notes: agentPayForm.notes || null,
      });
      setShowAgentPayModal(false);
      setSelectedAgentVouchers({});
      loadData();
    } catch (err) {
      alert('Ошибка сохранения');
    }
  };

  // ===== AGENT WRITE-OFF HANDLER =====
  const openAgentWriteOffModal = (agent: any) => {
    setWriteOffAgent(agent);
    setAgentWriteOffForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '' });
    setShowAgentWriteOffModal(true);
  };

  const saveAgentWriteOff = async () => {
    if (!writeOffAgent) return;
    try {
      await (api as any).writeOffAgentDebt({
        agentId: writeOffAgent.agent_id,
        paymentDate: agentWriteOffForm.paymentDate,
        paymentMethod: agentWriteOffForm.paymentMethod || null,
        notes: agentWriteOffForm.notes || null,
      });
      setShowAgentWriteOffModal(false);
      loadData();
    } catch { alert('Ошибка сохранения'); }
  };

  // ===== MANUAL CORRECTION HANDLER =====
  const openCorrectionModal = (type: 'operator' | 'agent', id: number, name: string, currency = 'THB') => {
    setCorrectionContext({ type, id, name, currency });
    setCorrectionForm({ date: new Date().toISOString().split('T')[0], amount: '', sign: '+', notes: '' });
    setShowCorrectionModal(true);
  };

  const saveCorrection = async () => {
    if (!correctionContext || !correctionForm.amount) { alert('Введите сумму'); return; }
    const raw = parseFloat(correctionForm.amount);
    if (isNaN(raw) || raw <= 0) { alert('Введите положительное число'); return; }
    const amount = correctionForm.sign === '+' ? raw : -raw;
    try {
      await api.addAccountingEntry({
        entryDate: correctionForm.date,
        entryType: 'expense',
        amount,
        category: 'Ручная коррекция',
        notes: correctionForm.notes || null,
        ...(correctionContext.type === 'operator'
          ? { companyId: correctionContext.id, currency: correctionContext.currency }
          : { agentId: correctionContext.id }),
      });
      setShowCorrectionModal(false);
      loadData();
    } catch { alert('Ошибка сохранения'); }
  };

  // ===== REVENUE CUSTOM EXPENSES =====
  const saveCustomExpenses = (items: typeof customExpenses) => {
    setCustomExpenses(items);
    localStorage.setItem('rev_custom_expenses', JSON.stringify(items));
  };

  const addCustomExpense = () => {
    if (!newExpenseName.trim() || !newExpenseAmount) return;
    const item = { id: Date.now(), name: newExpenseName.trim(), amount: newExpenseAmount };
    saveCustomExpenses([...customExpenses, item]);
    setNewExpenseName(''); setNewExpenseAmount('');
  };

  const removeCustomExpense = (id: number) => saveCustomExpenses(customExpenses.filter(e => e.id !== id));

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
    setWriteOffForm({
      paymentDate: new Date().toISOString().split('T')[0],
      amount: '',
      paymentMethod: '',
      category: 'Списание долга',
      notes: '',
      markAllPaid: true,
    });
    setShowWriteOffModal(true);
  };

  const saveWriteOff = async () => {
    if (!writeOffCompany) return;
    try {
      await api.writeOffOperatorDebt({
        companyId: writeOffCompany.company_id,
        paymentDate: writeOffForm.paymentDate,
        paymentMethod: writeOffForm.paymentMethod || null,
        notes: writeOffForm.notes || null,
      });
      setShowWriteOffModal(false);
      loadData();
      api.getAccountingDashboard().then(r => setDashboardData(r.data)).catch(() => {});
    } catch (err) {
      alert('Ошибка сохранения');
    }
  };

  const saveClosePeriod = async () => {
    if (!closePeriodForm.beforeDate) { alert('Укажите дату'); return; }
    const companyName = closePeriodForm.companyId
      ? companies.find((c: any) => String(c.id) === closePeriodForm.companyId)?.name || `Компания #${closePeriodForm.companyId}`
      : 'все компании';
    if (!confirm(`Закрыть исторический долг до ${closePeriodForm.beforeDate} для: ${companyName}?\n\nВаучеры будут отмечены как «оплачено», невыплаченный остаток — списан.\nЭто действие нельзя отменить автоматически.`)) return;
    try {
      const r = await api.closeOperatorPeriod({
        beforeDate: closePeriodForm.beforeDate,
        currency: operatorsCurrency || undefined,
        companyId: closePeriodForm.companyId ? Number(closePeriodForm.companyId) : undefined,
      });
      setClosePeriodResult({ closed: r.data.closed, writtenOff: r.data.writtenOff || 0 });
      loadData();
      api.getAccountingDashboard().then(res => setDashboardData(res.data)).catch(() => {});
    } catch {
      alert('Ошибка');
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

          {/* Revenue this month — split by currency */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase">
                Выручка {isCurrentMonth ? '(этот месяц)' : `(${MONTH_NAMES[dashboardMonth.month - 1]} ${dashboardMonth.year})`}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => shiftMonth(-1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition text-sm">◀</button>
                {!isCurrentMonth && (
                  <button onClick={() => { const n = new Date(); setDashboardMonth({ year: n.getFullYear(), month: n.getMonth() + 1 }); }}
                    className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition">сейчас</button>
                )}
                <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth}
                  className={`w-6 h-6 flex items-center justify-center rounded transition text-sm ${isCurrentMonth ? 'text-gray-200 cursor-default' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>▶</button>
              </div>
            </div>
            {(dashboardData.thisMonth.byCurrency || []).map((cur: any) => {
              const s = cur.currency === 'VND' ? '₫' : cur.currency === 'USD' ? '$' : '฿';
              return (
                <div key={cur.currency} className="mb-3 last:mb-0">
                  <div className="text-xs font-medium text-gray-400 mb-1">{cur.currency}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Продажи</span>
                      <span className="text-sm font-semibold text-gray-800">{fmt(cur.totalSale)} {s}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Прибыль</span>
                      <span className="text-sm font-semibold text-green-700">{fmt(cur.profit)} {s}</span>
                    </div>
                    {cur.todaySale > 0 && (
                      <div className="flex justify-between text-xs text-gray-400 pl-2">
                        <span>Сегодня:</span>
                        <span>{fmt(cur.todaySale)} {s} / прибыль {fmt(cur.todayProfit)} {s}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Fallback if byCurrency not yet returned (old API) */}
            {!dashboardData.thisMonth.byCurrency && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Продажи</span>
                  <span className="text-sm font-semibold text-gray-800">{fmt(dashboardData.thisMonth.totalSale)} ฿</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Прибыль</span>
                  <span className="text-sm font-semibold text-green-700">{fmt(dashboardData.thisMonth.profit)} ฿</span>
                </div>
              </div>
            )}
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
              {dashboardData.operatorDebtUSD > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-red-600">
                    {fmt(dashboardData.operatorDebtUSD)} $
                  </span>
                  <span className="text-xs text-gray-400">🇺🇸 USD</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {(dashboardData.operatorDebt > 0 || dashboardData.operatorDebtVND > 0 || dashboardData.operatorDebtUSD > 0) ? 'Нужно заплатить операторам' : 'Долгов нет'}
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
        <div className="ml-auto flex gap-1">
          {[
            { cur: 'THB', label: '฿ THB', cls: 'bg-green-600 hover:bg-green-700' },
            { cur: 'USD', label: '$ USD', cls: 'bg-blue-600 hover:bg-blue-700' },
            { cur: 'VND', label: '₫ VND', cls: 'bg-yellow-600 hover:bg-yellow-700' },
          ].map(({ cur, label, cls }) => (
            <button
              key={cur}
              onClick={() => handleExport(cur)}
              disabled={exporting}
              className={`px-3 py-1.5 ${cls} text-white text-sm rounded-lg transition disabled:opacity-50`}
            >
              {exporting ? '⏳' : label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {([
          { key: 'cashflow', label: 'Движение средств' },
          { key: 'operators', label: 'Оплата счетов' },
          { key: 'agents', label: 'Агенты' },
          { key: 'employees', label: 'Сотрудники' },
          { key: 'accounting', label: 'Бух. отчёт' },
          { key: 'revenue', label: 'Выручка' },
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
          {/* Balance by payment method — always shown at top */}
          {(() => {
            // Group all-time balances by method → currency (from dedicated endpoint, independent of date filter)
            const byMethodCur: Record<string, Record<string, number>> = {};
            methodBalances.forEach((row: any) => {
              const m = row.payment_method || 'Не указан';
              const cur = row.currency || 'THB';
              if (!byMethodCur[m]) byMethodCur[m] = {};
              byMethodCur[m][cur] = parseFloat(row.balance);
            });
            const curSym = (c: string) => c === 'VND' ? '₫' : c === 'USD' ? '$' : '฿';

            const saveBalance = async (method: string, currency: string, currentBalance: number) => {
              const newBal = parseFloat(editingBalanceValue);
              if (isNaN(newBal)) { setEditingBalanceMethod(null); return; }
              const delta = newBal - currentBalance;
              if (Math.abs(delta) < 0.01) { setEditingBalanceMethod(null); return; }
              await api.addAccountingEntry({
                entryDate: new Date().toISOString().split('T')[0],
                entryType: delta > 0 ? 'income' : 'expense',
                amount: Math.abs(delta),
                paymentMethod: method,
                category: 'Корректировка баланса',
                notes: `Корректировка: ${fmt(currentBalance)} → ${fmt(newBal)} ${curSym(currency)}`,
                currency,
              });
              setEditingBalanceMethod(null);
              loadMethodBalances();
            };

            return (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Баланс по методам оплаты (всё время)</h2>
                  <button
                    onClick={() => setShowManageMethods(true)}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                  >
                    ⚙ Управление методами
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(byMethodCur).length === 0 && (
                    <span className="text-sm text-gray-400">Загрузка...</span>
                  )}
                  {Object.entries(byMethodCur).map(([method, curMap]) => {
                    const currencies = Object.keys(curMap);
                    const overallPositive = currencies.every(c => curMap[c] >= 0);
                    const overallNegative = currencies.every(c => curMap[c] < 0);
                    const cardClass = overallPositive
                      ? 'bg-green-50 border-green-200'
                      : overallNegative
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200';
                    return (
                      <div key={method} className={`border rounded-lg px-3 py-2 text-sm flex flex-col min-w-[150px] group relative ${cardClass}`}>
                        <span className="text-gray-500 text-xs mb-1.5 font-medium">{method}</span>
                        {currencies.map(cur => {
                          const bal = curMap[cur];
                          const editKey = `${method}__${cur}`;
                          const isEditing = editingBalanceMethod === editKey;
                          return (
                            <div key={cur} className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <input
                                    autoFocus
                                    type="number"
                                    className="w-24 border border-blue-400 rounded px-1.5 py-0.5 text-sm font-semibold focus:outline-none"
                                    value={editingBalanceValue}
                                    onChange={e => setEditingBalanceValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveBalance(method, cur, bal);
                                      if (e.key === 'Escape') setEditingBalanceMethod(null);
                                    }}
                                  />
                                  <button onClick={() => saveBalance(method, cur, bal)}
                                    className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">✓</button>
                                  <button onClick={() => setEditingBalanceMethod(null)}
                                    className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300">✕</button>
                                </>
                              ) : (
                                <>
                                  <span className={`font-semibold ${bal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                    {bal >= 0 ? '+' : ''}{fmt(bal)} {curSym(cur)}
                                  </span>
                                  <button
                                    onClick={() => { setEditingBalanceMethod(editKey); setEditingBalanceValue(String(Math.round(bal))); }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-xs px-1 transition"
                                    title="Изменить баланс"
                                  >✏</button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-700">Движение средств</h2>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                {[{ v: 'THB', label: '🇹🇭 THB' }, { v: 'VND', label: '🇻🇳 VND' }, { v: 'USD', label: '🇺🇸 USD' }, { v: '', label: 'Все' }].map(({ v, label }) => (
                  <button key={v} onClick={() => setCfCurrency(v)}
                    className={`px-2 py-1.5 ${cfCurrency === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={openAddEntry} className={btnPrimary}>+ Добавить запись</button>
          </div>
          {cfCurrency === '' && (() => {
            const byCur: Record<string, { income: number; expense: number }> = {};
            (cashflowData?.entries || []).forEach((e: any) => {
              const c = e.currency || 'THB';
              if (!byCur[c]) byCur[c] = { income: 0, expense: 0 };
              const amt = parseFloat(e.amount);
              if (e.entry_type === 'income') byCur[c].income += amt;
              else byCur[c].expense += amt;
            });
            const symFor = (c: string) => c === 'VND' ? '₫' : c === 'USD' ? '$' : '฿';
            const fmtC = (n: number) => Math.round(n).toLocaleString('ru-RU');
            return Object.keys(byCur).length > 0 ? (
              <div className="mb-3 bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Баланс по валютам</div>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(byCur).sort(([a], [b]) => a === 'THB' ? -1 : b === 'THB' ? 1 : 0).map(([cur, d]) => {
                    const bal = d.income - d.expense;
                    return (
                      <div key={cur} className={`rounded-lg px-4 py-2 border text-sm min-w-[180px] ${bal >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="text-xs text-gray-500 mb-1">{cur === 'THB' ? '🇹🇭 THB' : cur === 'VND' ? '🇻🇳 VND' : cur === 'USD' ? '🇺🇸 USD' : cur}</div>
                        <div className="flex gap-3 text-xs text-gray-500 mb-1">
                          <span>▲ {fmtC(d.income)}</span>
                          <span>▼ {fmtC(d.expense)}</span>
                        </div>
                        <div className={`font-bold ${bal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {bal >= 0 ? '+' : ''}{fmtC(bal)} {symFor(cur)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;
          })()}

          {/* Category group filter */}
          <div className="flex flex-wrap gap-1 mb-2">
            {[
              { v: '',         label: 'Все движения' },
              { v: 'cash',     label: '💵 Только касса' },
              { v: 'internal', label: '🏢 Операторские и списания' },
            ].map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setCfCategoryFilter(v)}
                className={`px-3 py-1 text-xs rounded-full border transition ${cfCategoryFilter === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Method filter buttons */}
          <div className="flex flex-wrap gap-1 mb-3">
            <button
              onClick={() => setCfMethodFilter('')}
              className={`px-3 py-1 text-xs rounded-full border transition ${cfMethodFilter === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              Все
            </button>
            {methodNames.map((m: string) => (
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
                  {[
                    { key: 'date', label: 'Дата' },
                    { key: 'type', label: 'Тип' },
                    { key: 'category', label: 'Категория' },
                    { key: 'counterparty', label: 'Контрагент' },
                    { key: 'method', label: 'Метод оплаты' },
                  ].map(col => (
                    <th key={col.key} className={thCls + ' cursor-pointer select-none hover:bg-gray-100'}
                      onClick={() => handleCfSort(col.key)}>
                      {col.label}<span className="text-gray-400 text-xs">{sortIcon(col.key)}</span>
                    </th>
                  ))}
                  <th className={thCls + ' text-right cursor-pointer select-none hover:bg-gray-100'} onClick={() => handleCfSort('amount')}>
                    Приход<span className="text-gray-400 text-xs">{sortIcon('amount')}</span>
                  </th>
                  <th className={thCls + ' text-right cursor-pointer select-none hover:bg-gray-100'} onClick={() => handleCfSort('amount')}>
                    Расход<span className="text-gray-400 text-xs">{sortIcon('amount')}</span>
                  </th>
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
                    <tr key={entry.id} className={`border-b border-gray-100 ${entry.requires_confirmation ? 'bg-orange-50 border-l-2 border-l-orange-400' : isAuto ? 'bg-gray-50' : 'hover:bg-blue-50 cursor-pointer'}`}
                      onClick={() => !isAuto && !entry.requires_confirmation && openEditEntry(entry)}>
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
                        {entry.requires_confirmation && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                            ⚠ Ожидает подтверждения
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{entry.payment_method || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-600">
                        {isIncome ? `+${fmt(entry.amount)}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-red-600">
                        {!isIncome ? `-${fmt(entry.amount)}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        {fmt(entry.running_balance)} {cfCurrency === 'VND' ? '₫' : cfCurrency === 'USD' ? '$' : '฿'}
                      </td>
                      <td className="px-3 py-2 space-y-1" onClick={e => e.stopPropagation()}>
                        {!isAuto && (
                          <button onClick={() => deleteEntry(entry.id)} className={btnDanger}>✕</button>
                        )}
                        {entry.requires_confirmation && hasRole('admin', 'accountant') && (
                          <button
                            onClick={() => confirmDeposit(entry.id)}
                            className="block w-full px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100 transition"
                          >
                            ✓ Подтвердить
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredEntries.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                    <td colSpan={5} className="px-3 py-3 text-gray-600">
                      Итого за период
                      {cfCategoryFilter === 'cash' && <span className="ml-2 text-xs font-normal text-indigo-500">(только касса)</span>}
                      {cfCategoryFilter === 'internal' && <span className="ml-2 text-xs font-normal text-indigo-500">(операторские и списания)</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-green-700">+{fmt(filteredSummary.total_income)} {cfCurrency === 'VND' ? '₫' : cfCurrency === 'USD' ? '$' : '฿'}</td>
                    <td className="px-3 py-3 text-right text-red-700">-{fmt(filteredSummary.total_expense)} {cfCurrency === 'VND' ? '₫' : cfCurrency === 'USD' ? '$' : '฿'}</td>
                    <td className={`px-3 py-3 text-right text-lg font-bold ${filteredSummary.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(filteredSummary.balance)} {cfCurrency === 'VND' ? '₫' : cfCurrency === 'USD' ? '$' : '฿'}
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
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-700">Оплата счетов</h2>
              <input
                type="text" value={operatorSearch} onChange={e => setOperatorSearch(e.target.value)}
                placeholder="Поиск компании..." className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-400 w-48"
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                <button onClick={() => setOperatorsCurrency('')} className={`px-2 py-1.5 ${operatorsCurrency === '' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Все</button>
                <button onClick={() => setOperatorsCurrency('THB')} className={`px-2 py-1.5 ${operatorsCurrency === 'THB' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🇹🇭 Тай</button>
                <button onClick={() => setOperatorsCurrency('VND')} className={`px-2 py-1.5 ${operatorsCurrency === 'VND' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🇻🇳 Вьетнам</button>
                <button onClick={() => setOperatorsCurrency('USD')} className={`px-2 py-1.5 ${operatorsCurrency === 'USD' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🇺🇸 USD</button>
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
              <button
                onClick={() => { setClosePeriodResult(null); setShowClosePeriodModal(true); }}
                className="px-3 py-1.5 text-sm rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition font-medium"
              >
                🗂 Закрыть исторический долг
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
          <div className="mb-2 px-1 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>📌 <b>К оплате</b> = нетто − кэш с тура − депозит</span>
            <span>📌 <b>Депозиты</b> — клиент оплатил напрямую оператору (Депозит в компанию)</span>
            <span>📌 <b>Отправлено</b> — фактически переведено компании (из движения средств)</span>
            <span>📌 <b>Баланс</b> = Отправлено + Кэш + Депозиты − Нетто. <span className="text-green-600">Зелёный</span> = переплата, <span className="text-red-600">Красный</span> = долг</span>
            <span>📌 <b>Оплата компании</b> — дата, когда ваучер был закрыт платежом</span>
            <span>⚠️ <b>Баланс и суммы — всегда за всё время.</b> Период влияет только на список ваучеров ниже.</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className={thCls}>Компания</th>
                  <th className={thCls + ' text-right'}>Ваучеров</th>
                  <th className={thCls + ' text-right'}>Нетто итого</th>
                  <th className={thCls + ' text-right'}>Кэш с тура</th>
                  <th className={thCls + ' text-right'}>Депозиты</th>
                  <th className={thCls + ' text-right'}>Отправлено</th>
                  <th className={thCls + ' text-right'}>Баланс {operatorsCurrency === 'VND' ? '₫' : operatorsCurrency === 'USD' ? '$' : '฿'}</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {operatorsData.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Нет данных за период</td></tr>
                )}
                {operatorsData.filter((op: any) => !operatorSearch || op.company_name?.toLowerCase().includes(operatorSearch.toLowerCase())).map((op: any) => {
                  const balance = parseFloat(op.balance);
                  const isExpanded = expandedOperator === op.company_id;
                  const hasZeroNetto = parseFloat(op.total_owed_to_operator) === 0 && parseInt(op.voucher_count) > 0;
                  const rowBg = hasZeroNetto ? 'bg-yellow-50' : balance > 0 ? 'bg-green-50' : balance < 0 ? 'bg-red-50' : '';
                  const balanceColor = balance > 0 ? 'text-green-700 font-bold' : balance < 0 ? 'text-red-700 font-bold' : 'text-gray-500';
                  const visibleVouchers = [...(op.vouchers || []).filter((v: any) => showPaidVouchers || !v.operator_paid)].sort((a: any, b: any) => {
                    const dir = voucherSort.dir === 'asc' ? 1 : -1;
                    if (voucherSort.col === 'tour_date') {
                      return (a.tour_date || '').localeCompare(b.tour_date || '') * dir;
                    } else if (voucherSort.col === 'voucher_number') {
                      return ((a.voucher_number || 0) - (b.voucher_number || 0)) * dir;
                    } else if (voucherSort.col === 'total_net') {
                      return (parseFloat(a.total_net || 0) - parseFloat(b.total_net || 0)) * dir;
                    } else if (voucherSort.col === 'due') {
                      const dueA = parseFloat(a.total_net||0) - parseFloat(a.cash_on_tour||0) - parseFloat(a.deposit_in_company||0);
                      const dueB = parseFloat(b.total_net||0) - parseFloat(b.cash_on_tour||0) - parseFloat(b.deposit_in_company||0);
                      return (dueA - dueB) * dir;
                    }
                    return 0;
                  });
                  const sym = operatorsCurrency === 'VND' ? '₫' : operatorsCurrency === 'USD' ? '$' : '฿';
                  return (
                    <React.Fragment key={op.company_id}>
                      <tr className={`border-b border-gray-100 cursor-pointer hover:brightness-95 ${rowBg}`}
                        onClick={() => setExpandedOperator(isExpanded ? null : op.company_id)}>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {isExpanded ? '▼' : '▶'} {op.company_name}
                          {hasZeroNetto && <span className="ml-2 text-xs text-yellow-700 font-semibold">⚠ нетто не указано</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{op.voucher_count}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(op.total_owed_to_operator)} {sym}</td>
                        <td className="px-3 py-2.5 text-right">
                          {parseFloat(op.total_cash_on_tour) > 0
                            ? <span className="text-amber-700 font-medium">+{fmt(op.total_cash_on_tour)} {sym}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {parseFloat(op.total_deposit_in_company) > 0
                            ? <span className="text-blue-700 font-medium">+{fmt(op.total_deposit_in_company)} {sym}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
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
                            <button onClick={() => openCorrectionModal('operator', op.company_id, op.company_name, operatorsCurrency || 'THB')} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded border border-purple-200 hover:bg-purple-100 transition">
                              ±
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={rowBg}>
                          <td colSpan={8} className="px-6 py-3">
                            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase">Ваучеры:</div>
                            {visibleVouchers.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="text-xs w-full">
                                  <thead>
                                    {(() => {
                                      const sortTh = (col: string, label: string, align: 'left' | 'right' = 'left') => {
                                        const active = voucherSort.col === col;
                                        return (
                                          <th
                                            className={`py-1 pr-4 text-${align} cursor-pointer select-none hover:text-gray-600 whitespace-nowrap ${active ? 'text-blue-500' : 'text-gray-400'}`}
                                            onClick={() => setVoucherSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }))}
                                          >
                                            {label} {active ? (voucherSort.dir === 'asc' ? '↑' : '↓') : ''}
                                          </th>
                                        );
                                      };
                                      return (
                                        <tr>
                                          <th className="py-1 pr-2 w-6"></th>
                                          {sortTh('voucher_number', 'Ваучер')}
                                          {sortTh('tour_date', 'Дата тура')}
                                          {sortTh('total_net', 'Нетто', 'right')}
                                          <th className="text-right py-1 pr-4 text-gray-400">Кэш</th>
                                          <th className="text-right py-1 pr-4 text-gray-400">Депозит</th>
                                          {sortTh('due', 'К оплате', 'right')}
                                          <th className="text-left py-1 pr-4 text-gray-400">Статус клиента</th>
                                          <th className="text-left py-1 text-gray-400">Оплата компании</th>
                                        </tr>
                                      );
                                    })()}

                                  </thead>
                                  <tbody>
                                    {visibleVouchers.map((v: any) => {
                                      const net = parseFloat(v.total_net || 0);
                                      const cash = parseFloat(v.cash_on_tour || 0);
                                      const deposit = parseFloat(v.deposit_in_company || 0);
                                      // К оплате = нетто − кэш на туре − депозит в компанию
                                      // Отрицательное значение = переплата
                                      const due = net - cash - deposit;
                                      return (
                                        <tr key={v.id} className={`border-t border-gray-100 ${v.operator_paid ? 'opacity-50' : net === 0 ? 'bg-yellow-50' : ''}`}>
                                          <td className="py-1 pr-2">
                                            {!v.operator_paid && hasRole('admin', 'accountant') && (
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
                                          <td className="py-1 pr-4 text-right text-gray-700">{fmt(net)} {sym}</td>
                                          <td className="py-1 pr-4 text-right text-blue-600">{cash > 0 ? `${fmt(cash)} ${sym}` : '—'}</td>
                                          <td className="py-1 pr-4 text-right text-green-600">{deposit > 0 ? `+${fmt(deposit)} ${sym}` : '—'}</td>
                                          <td className={`py-1 pr-4 text-right font-semibold ${due < 0 ? 'text-green-600' : due === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                                            {due < 0 ? `−${fmt(Math.abs(due))}` : fmt(due)} {sym}
                                          </td>
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
                                          <td className="py-1 whitespace-nowrap text-xs">
                                            {v.operator_paid ? (
                                              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                                                ✓ {v.operator_paid_date ? new Date(v.operator_paid_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Оплачено'}
                                              </span>
                                            ) : (
                                              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">Не оплачено</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {visibleVouchers.length > 1 && (() => {
                                      const totNet = visibleVouchers.reduce((s: number, v: any) => s + parseFloat(v.total_net || 0), 0);
                                      const totCash = visibleVouchers.reduce((s: number, v: any) => s + parseFloat(v.cash_on_tour || 0), 0);
                                      const totDep = visibleVouchers.reduce((s: number, v: any) => s + parseFloat(v.deposit_in_company || 0), 0);
                                      const totDue = totNet - totCash - totDep;
                                      return (
                                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-xs">
                                          <td className="py-1.5 pr-2"></td>
                                          <td className="py-1.5 pr-4 text-gray-500">Итого ({visibleVouchers.length})</td>
                                          <td className="py-1.5 pr-4"></td>
                                          <td className="py-1.5 pr-4 text-right text-gray-800">{fmt(totNet)} {sym}</td>
                                          <td className="py-1.5 pr-4 text-right text-blue-600">{totCash > 0 ? `${fmt(totCash)} ${sym}` : '—'}</td>
                                          <td className="py-1.5 pr-4 text-right text-green-600">{totDep > 0 ? `+${fmt(totDep)} ${sym}` : '—'}</td>
                                          <td className={`py-1.5 pr-4 text-right ${totDue < 0 ? 'text-green-600' : totDue === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                                            {totDue < 0 ? `−${fmt(Math.abs(totDue))}` : fmt(totDue)} {sym}
                                          </td>
                                          <td colSpan={2}></td>
                                        </tr>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-xs">Нет ваучеров за период</div>
                            )}

                            {/* All deposits to this operator (own vouchers + external) */}
                            {(op.deposits_list || []).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-blue-200">
                                <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                                  💰 Депозиты в {op.company_name}:
                                </div>
                                <table className="text-xs w-full">
                                  <thead>
                                    <tr className="text-gray-400">
                                      <th className="text-left py-1 pr-4">Дата</th>
                                      <th className="text-left py-1 pr-4">Ваучер</th>
                                      <th className="text-left py-1 pr-4">Компания тура</th>
                                      <th className="text-right py-1 pr-4">Сумма</th>
                                      <th className="text-left py-1">Статус</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(op.deposits_list || []).map((dep: any) => (
                                      <tr key={dep.payment_id} className={`border-t ${dep.requires_confirmation ? 'border-orange-100 bg-orange-50' : 'border-gray-100'}`}>
                                        <td className="py-1 pr-4 text-gray-600">
                                          {dep.payment_date ? new Date(dep.payment_date).toLocaleDateString('ru-RU') : '—'}
                                        </td>
                                        <td className="py-1 pr-4">
                                          <Link to={`/vouchers/${dep.voucher_id}`} className="text-blue-600 hover:underline font-medium">
                                            #{dep.voucher_number}
                                          </Link>
                                        </td>
                                        <td className="py-1 pr-4 text-gray-600">
                                          {dep.from_company_name}
                                          {dep.is_external && <span className="ml-1 text-orange-500 text-xs">(чужой тур)</span>}
                                        </td>
                                        <td className="py-1 pr-4 text-right font-semibold text-blue-600">+{fmt(dep.amount)} {sym}</td>
                                        <td className="py-1">
                                          {dep.requires_confirmation ? (
                                            <div className="flex items-center gap-2">
                                              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">⚠ Ожидает</span>
                                              {dep.accounting_entry_id && (
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                      const token = localStorage.getItem('token');
                                                      await fetch(`/api/accounting/cashflow/${dep.accounting_entry_id}/confirm`, {
                                                        method: 'PATCH',
                                                        headers: { Authorization: `Bearer ${token}` },
                                                      });
                                                      reloadAll();
                                                    } catch { alert('Ошибка подтверждения'); }
                                                  }}
                                                  className="px-2 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                                                >
                                                  ✓ Подтвердить
                                                </button>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">✓ Зачтено</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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

          {/* Ручная коррекция — модал (операторы) */}
          {showCorrectionModal && correctionContext?.type === 'operator' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Ручная коррекция</h3>
                <div className="text-sm text-gray-500 mb-4">{correctionContext.name}</div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Дата *</label>
                    <input type="date" value={correctionForm.date}
                      onChange={e => setCorrectionForm(p => ({ ...p, date: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Сумма *</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                        <button onClick={() => setCorrectionForm(p => ({ ...p, sign: '+' }))}
                          className={`px-3 py-1.5 font-bold transition ${correctionForm.sign === '+' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          + Плюс
                        </button>
                        <button onClick={() => setCorrectionForm(p => ({ ...p, sign: '-' }))}
                          className={`px-3 py-1.5 font-bold transition ${correctionForm.sign === '-' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          − Минус
                        </button>
                      </div>
                      <input type="number" value={correctionForm.amount} min="0" step="1"
                        onChange={e => setCorrectionForm(p => ({ ...p, amount: e.target.value }))}
                        className={inputCls + ' flex-1'} placeholder="0" />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {correctionForm.sign === '+' ? '+ уменьшает долг (добавляет к отправленному)' : '− увеличивает долг (убирает из отправленного)'}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Примечание</label>
                    <input type="text" value={correctionForm.notes}
                      onChange={e => setCorrectionForm(p => ({ ...p, notes: e.target.value }))}
                      className={inputCls} placeholder="Причина коррекции..." />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowCorrectionModal(false)} className={btnSecondary}>Отмена</button>
                  <button onClick={saveCorrection} className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition">
                    Применить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Закрыть исторический долг — модал */}
          {showClosePeriodModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">🗂 Закрыть исторический долг</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Ваучеры до даты отмечаются как «оплачено», невыплаченный остаток — списывается в расход.
                  Если баланс положительный (переплата) — запись <strong>не создаётся</strong>.
                  {operatorsCurrency && <span className="ml-1">Валюта: <strong>{operatorsCurrency === 'THB' ? '🇹🇭 THB' : operatorsCurrency === 'VND' ? '🇻🇳 VND' : operatorsCurrency}</strong></span>}
                </p>
                {closePeriodResult !== null ? (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-3">✅</div>
                    <div className="text-lg font-bold text-green-700 mb-1">Закрыто ваучеров: {closePeriodResult.closed}</div>
                    {closePeriodResult.writtenOff > 0
                      ? <div className="text-sm text-orange-700">Списано долга: {fmt(closePeriodResult.writtenOff)} {operatorsCurrency === 'VND' ? '₫' : operatorsCurrency === 'USD' ? '$' : '฿'}</div>
                      : <div className="text-sm text-gray-500">Долга не было (баланс нулевой или положительный)</div>
                    }
                    <button onClick={() => { setShowClosePeriodModal(false); setClosePeriodResult(null); }}
                      className={btnPrimary + ' mt-4'}>Готово</button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>Компания</label>
                        <select value={closePeriodForm.companyId}
                          onChange={e => setClosePeriodForm(p => ({ ...p, companyId: e.target.value }))}
                          className={inputCls}>
                          <option value="">Все компании</option>
                          {companies.filter((c: any) => c.is_active).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Закрыть долг до даты *</label>
                        <input type="date" value={closePeriodForm.beforeDate}
                          onChange={e => setClosePeriodForm(p => ({ ...p, beforeDate: e.target.value }))}
                          className={inputCls} />
                        <p className="text-xs text-gray-400 mt-1">
                          Все ваучеры с датой тура раньше этой даты будут считаться оплаченными оператору
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-5">
                      <button onClick={() => setShowClosePeriodModal(false)} className={btnSecondary}>Отмена</button>
                      <button onClick={saveClosePeriod}
                        className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition">
                        Закрыть период
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Списание долга — модал */}
          {showWriteOffModal && writeOffCompany && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Списание долга</h3>
                <div className="text-sm font-semibold text-gray-700 mb-1">{writeOffCompany.company_name}</div>
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  Система автоматически рассчитает точную сумму остатка и занулит задолженность.
                  Все ваучеры будут отмечены как оплаченные.
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Дата *</label>
                    <input type="date" value={writeOffForm.paymentDate}
                      onChange={e => setWriteOffForm(p => ({ ...p, paymentDate: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Метод оплаты</label>
                    <select value={writeOffForm.paymentMethod}
                      onChange={e => setWriteOffForm(p => ({ ...p, paymentMethod: e.target.value }))}
                      className={inputCls}>
                      <option value="">Не указан</option>
                      {methodNames.filter((m: string) => m !== 'Депозит в компанию').map((m: string) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Примечание</label>
                    <input type="text" value={writeOffForm.notes}
                      onChange={e => setWriteOffForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Счёт №, доп. информация..."
                      className={inputCls} />
                  </div>
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
                      {methodNames.filter((m: string) => m !== 'Депозит в компанию').map((m: string) => <option key={m} value={m}>{m}</option>)}
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

      {/* ===== TAB: AGENTS ===== */}
      {!loading && activeTab === 'agents' && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-700">Комиссии агентов</h2>
              <input
                type="text" value={agentSearch} onChange={e => setAgentSearch(e.target.value)}
                placeholder="Поиск агента..." className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-400 w-48"
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={() => setShowPaidAgentVouchers(v => !v)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${showPaidAgentVouchers ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {showPaidAgentVouchers ? '👁 Все ваучеры' : '✓ Скрыть оплаченные'}
              </button>
              <button
                onClick={() => setAgentsAllTime(v => !v)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition font-medium ${agentsAllTime ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {agentsAllTime ? '🌐 За всё время' : '📅 За период'}
              </button>
            </div>
          </div>
          {agentsAllTime && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Показаны данные за <strong>всё время</strong> — накопленный долг по комиссиям
            </div>
          )}
          <div className="mb-2 px-1 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            <span><b>К выплате</b> = Σ (валовая прибыль ваучера × % комиссии агента)</span>
            <span><b>Баланс</b> = Выплачено − К выплате. <span className="text-green-600">Зелёный</span> = переплата, <span className="text-red-600">Красный</span> = долг</span>
            <span><b>Баланс и суммы — всегда за всё время.</b> Период влияет только на список ваучеров.</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className={thCls}>Агент</th>
                  <th className={thCls + ' text-right'}>Ваучеров</th>
                  <th className={thCls + ' text-right'}>К выплате ฿</th>
                  <th className={thCls + ' text-right'}>Выплачено ฿</th>
                  <th className={thCls + ' text-right'}>Баланс ฿</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {agentsData.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Нет данных за период</td></tr>
                )}
                {agentsData.filter((ag: any) => !agentSearch || ag.agent_name?.toLowerCase().includes(agentSearch.toLowerCase())).map((ag: any) => {
                  const balance = parseFloat(ag.balance);
                  const isExpanded = expandedAgent === ag.agent_id;
                  const rowBg = balance > 0 ? 'bg-green-50' : balance < 0 ? 'bg-red-50' : '';
                  const balanceColor = balance > 0 ? 'text-green-700 font-bold' : balance < 0 ? 'text-red-700 font-bold' : 'text-gray-500';
                  const visibleVouchers = (ag.vouchers || []).filter((v: any) => showPaidAgentVouchers || !v.agent_commission_paid);
                  return (
                    <React.Fragment key={ag.agent_id}>
                      <tr className={`border-b border-gray-100 cursor-pointer hover:brightness-95 ${rowBg}`}
                        onClick={() => setExpandedAgent(isExpanded ? null : ag.agent_id)}>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {isExpanded ? '▼' : '▶'} {ag.agent_name}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{ag.voucher_count}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(ag.total_commission_owed)} ฿</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(ag.total_paid_to_agent)} ฿</td>
                        <td className={`px-3 py-2.5 text-right ${balanceColor}`}>
                          {balance > 0 ? '+' : ''}{fmt(balance)} ฿
                          {balance > 0 && <span className="ml-1 text-xs">🟢</span>}
                          {balance < 0 && <span className="ml-1 text-xs">🔴</span>}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={() => openAgentPayModal(ag)} className={btnPrimary + ' text-xs'}>
                              + Выплатить
                            </button>
                            <button onClick={() => openAgentWriteOffModal(ag)} className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded border border-orange-200 hover:bg-orange-100 transition">
                              Списать
                            </button>
                            <button onClick={() => openCorrectionModal('agent', ag.agent_id, ag.agent_name)} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded border border-purple-200 hover:bg-purple-100 transition">
                              ±
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
                                      <th className="text-right py-1 pr-4">Продажа</th>
                                      <th className="text-right py-1 pr-4">Нетто</th>
                                      <th className="text-right py-1 pr-4">Прибыль</th>
                                      <th className="text-right py-1 pr-4">% агента</th>
                                      <th className="text-right py-1 pr-4">Комиссия</th>
                                      <th className="text-left py-1">Статус</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleVouchers.map((v: any) => {
                                      const grossProfit = parseFloat(v.total_sale || 0) - parseFloat(v.total_net || 0);
                                      const comm = parseFloat(v.commission_amount || 0);
                                      return (
                                        <tr key={v.id} className={`border-t border-gray-100 ${v.agent_commission_paid ? 'opacity-50' : ''}`}>
                                          <td className="py-1 pr-2">
                                            {!v.agent_commission_paid && (
                                              <input type="checkbox" className="rounded"
                                                checked={!!selectedAgentVouchers[v.id]}
                                                onChange={e => {
                                                  e.stopPropagation();
                                                  setSelectedAgentVouchers(prev => ({ ...prev, [v.id]: e.target.checked }));
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
                                          <td className="py-1 pr-4 text-right text-gray-700">{fmt(v.total_sale)} ฿</td>
                                          <td className="py-1 pr-4 text-right text-gray-500">{fmt(v.total_net)} ฿</td>
                                          <td className="py-1 pr-4 text-right text-blue-700">{fmt(grossProfit)} ฿</td>
                                          <td className="py-1 pr-4 text-right text-gray-600">{v.agent_commission_percentage}%</td>
                                          <td className="py-1 pr-4 text-right font-semibold text-orange-700">{fmt(comm)} ฿</td>
                                          <td className="py-1">
                                            {v.agent_commission_paid ? (
                                              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                                                ✓ {v.agent_commission_paid_date ? new Date(v.agent_commission_paid_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Оплачено'}
                                              </span>
                                            ) : (
                                              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">Не оплачено</span>
                                            )}
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

          {/* Выплата агенту — модал */}
          {showAgentPayModal && agentPayAgent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Выплата агенту</h3>
                <div className="text-sm text-gray-500 mb-4">{agentPayAgent.agent_name}</div>

                <div className="border rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left w-6">
                          <input type="checkbox"
                            onChange={e => {
                              const unpaid = (agentPayAgent.vouchers || []).filter((v: any) => !v.agent_commission_paid);
                              const next: Record<number, boolean> = {};
                              unpaid.forEach((v: any) => { next[v.id] = e.target.checked; });
                              setSelectedAgentVouchers(next);
                            }}
                            checked={(agentPayAgent.vouchers || []).filter((v: any) => !v.agent_commission_paid).every((v: any) => selectedAgentVouchers[v.id])}
                          />
                        </th>
                        <th className="px-2 py-1.5 text-left">Ваучер</th>
                        <th className="px-2 py-1.5 text-left">Дата тура</th>
                        <th className="px-2 py-1.5 text-right">Комиссия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(agentPayAgent.vouchers || []).filter((v: any) => !v.agent_commission_paid).map((v: any) => (
                        <tr key={v.id} className={`border-t border-gray-100 ${selectedAgentVouchers[v.id] ? 'bg-blue-50' : ''}`}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={!!selectedAgentVouchers[v.id]}
                              onChange={e => setSelectedAgentVouchers(prev => ({ ...prev, [v.id]: e.target.checked }))} />
                          </td>
                          <td className="px-2 py-1.5 font-medium">#{v.voucher_number}</td>
                          <td className="px-2 py-1.5 text-gray-500">
                            {v.tour_date ? new Date(v.tour_date).toLocaleDateString('ru-RU') : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-orange-700">{fmt(v.commission_amount)} ฿</td>
                        </tr>
                      ))}
                      {(agentPayAgent.vouchers || []).filter((v: any) => !v.agent_commission_paid).length === 0 && (
                        <tr><td colSpan={4} className="text-center py-4 text-gray-400">Все ваучеры оплачены</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mb-4 px-2 py-2 bg-orange-50 rounded-lg">
                  <span className="text-sm text-gray-600">Выбрано ваучеров: {Object.values(selectedAgentVouchers).filter(Boolean).length}</span>
                  <span className="text-base font-bold text-orange-700">{fmt(selectedAgentTotal)} ฿</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Дата оплаты *</label>
                    <input type="date" value={agentPayForm.paymentDate}
                      onChange={e => setAgentPayForm(p => ({ ...p, paymentDate: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Метод оплаты</label>
                    <select value={agentPayForm.paymentMethod} onChange={e => setAgentPayForm(p => ({ ...p, paymentMethod: e.target.value }))} className={inputCls}>
                      <option value="">Не указан</option>
                      {methodNames.filter((m: string) => m !== 'Депозит в компанию').map((m: string) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Сумма выплаты *</label>
                    <input type="number" value={agentPayForm.amount} min="0" step="1"
                      onChange={e => setAgentPayForm(p => ({ ...p, amount: e.target.value }))}
                      className={inputCls} />
                    <button type="button" className="text-xs text-blue-500 mt-1 hover:underline"
                      onClick={() => setAgentPayForm(p => ({ ...p, amount: String(Math.round(selectedAgentTotal)) }))}>
                      ← Использовать сумму выбранных ({fmt(selectedAgentTotal)} ฿)
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>Примечание</label>
                    <input type="text" value={agentPayForm.notes} onChange={e => setAgentPayForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} placeholder="Доп. информация..." />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowAgentPayModal(false)} className={btnSecondary}>Отмена</button>
                  <button onClick={saveAgentPayment} className={btnPrimary}>Сохранить выплату</button>
                </div>
              </div>
            </div>
          )}
          {/* Ручная коррекция — модал (agentы) */}
          {showCorrectionModal && correctionContext?.type === 'agent' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Ручная коррекция</h3>
                <div className="text-sm text-gray-500 mb-4">{correctionContext.name}</div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Дата *</label>
                    <input type="date" value={correctionForm.date}
                      onChange={e => setCorrectionForm(p => ({ ...p, date: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Сумма *</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                        <button onClick={() => setCorrectionForm(p => ({ ...p, sign: '+' }))}
                          className={`px-3 py-1.5 font-bold transition ${correctionForm.sign === '+' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          + Плюс
                        </button>
                        <button onClick={() => setCorrectionForm(p => ({ ...p, sign: '-' }))}
                          className={`px-3 py-1.5 font-bold transition ${correctionForm.sign === '-' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          − Минус
                        </button>
                      </div>
                      <input type="number" value={correctionForm.amount} min="0" step="1"
                        onChange={e => setCorrectionForm(p => ({ ...p, amount: e.target.value }))}
                        className={inputCls + ' flex-1'} placeholder="0" />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {correctionForm.sign === '+' ? '+ уменьшает долг (добавляет к выплаченному)' : '− увеличивает долг (убирает из выплаченного)'}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Примечание</label>
                    <input type="text" value={correctionForm.notes}
                      onChange={e => setCorrectionForm(p => ({ ...p, notes: e.target.value }))}
                      className={inputCls} placeholder="Причина коррекции..." />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowCorrectionModal(false)} className={btnSecondary}>Отмена</button>
                  <button onClick={saveCorrection} className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition">
                    Применить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Списание долга агенту — модал */}
          {showAgentWriteOffModal && writeOffAgent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Списание долга агенту</h3>
                <div className="text-sm font-semibold text-gray-700 mb-1">{writeOffAgent.agent_name}</div>
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  Система рассчитает точную сумму задолженности и занулит долг.
                  Все ваучеры агента будут отмечены как «комиссия выплачена».
                  <br/>Если баланс положительный — запись в кассу создана не будет.
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Дата *</label>
                    <input type="date" value={agentWriteOffForm.paymentDate}
                      onChange={e => setAgentWriteOffForm(p => ({ ...p, paymentDate: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Метод оплаты</label>
                    <select value={agentWriteOffForm.paymentMethod}
                      onChange={e => setAgentWriteOffForm(p => ({ ...p, paymentMethod: e.target.value }))}
                      className={inputCls}>
                      <option value="">Не указан</option>
                      {methodNames.filter((m: string) => m !== 'Депозит в компанию').map((m: string) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Примечание</label>
                    <input type="text" value={agentWriteOffForm.notes}
                      onChange={e => setAgentWriteOffForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Доп. информация..."
                      className={inputCls} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowAgentWriteOffModal(false)} className={btnSecondary}>Отмена</button>
                  <button onClick={saveAgentWriteOff} className="px-4 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition">
                    Списать долг
                  </button>
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
              // Per-currency calculated salaries
              const calcThb = parseFloat(emp.calculated_salary_thb || emp.calculated_salary || 0);
              const calcVnd = parseFloat(emp.calculated_salary_vnd || 0);
              const calcUsd = parseFloat(emp.calculated_salary_usd || 0);
              const remaining = calcThb - totalPaid;
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
                      <div className="text-gray-500 mb-0.5">Начислено</div>
                      <div className="font-bold text-purple-700">{fmt(calcThb)} ฿</div>
                      {calcVnd > 0 && <div className="font-semibold text-purple-500 text-xs">{Number(calcVnd).toLocaleString('ru-RU')} ₫</div>}
                      {calcUsd > 0 && <div className="font-semibold text-purple-500 text-xs">{fmt(calcUsd)} $</div>}
                    </div>
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="text-gray-500">Выплачено</div>
                      <div className="font-bold text-blue-700">{fmt(totalPaid)} ฿</div>
                    </div>
                    <div className={`p-2 rounded ${remaining <= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-gray-500">Остаток ฿</div>
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

      {/* ===== TAB 5: REVENUE CONSTRUCTOR ===== */}
      {!loading && activeTab === 'revenue' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className={labelCls}>Валюта</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                {['THB', 'VND', 'all'].map(c => (
                  <button key={c} onClick={() => { setRevCurrency(c); }}
                    className={`px-3 py-1.5 ${revCurrency === c ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {c === 'all' ? 'Все' : c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Дата по</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                <button onClick={() => setRevDateType('sale')}
                  className={`px-3 py-1.5 ${revDateType === 'sale' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  Продажи
                </button>
                <button onClick={() => setRevDateType('tour')}
                  className={`px-3 py-1.5 ${revDateType === 'tour' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  Выезд
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {revenueData && <span>Ваучеров: <b>{revenueData.voucherCount}</b> · Пассажиров: <b>{revenueData.totalPax}</b></span>}
            </div>
          </div>

          {revenueData && (() => {
            const fmtN = (n: number) => Math.round(n).toLocaleString('ru-RU');
            const totalCustomExpenses = customExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            const renderWaterfall = (data: any, sym: string, title?: string) => {
              let selected = data.profitAfterAgent;
              if (revIncludes.agentCommissions) {/* already deducted in profitAfterAgent */}
              if (revIncludes.managerCommissions) selected -= data.managerCommissions;
              if (revIncludes.employeePaid) selected -= data.employeePaid;
              if (revIncludes.cashflowExpenses) selected -= data.cashflowExpenses;
              selected -= totalCustomExpenses;
              const margin = data.totalSale > 0
                ? ((data.grossProfit / data.totalSale) * 100).toFixed(1) : '0';

              const Row = ({ label, value, color = 'text-gray-700', sub, minus = false, toggled, onToggle }: any) => (
                <div className={`flex items-center justify-between py-2.5 px-4 ${toggled === false ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-2">
                    {onToggle && (
                      <button onClick={onToggle}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs transition flex-shrink-0 ${toggled ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                        {toggled ? '✓' : ''}
                      </button>
                    )}
                    <span className="text-sm text-gray-600">{label}</span>
                    {sub && <span className="text-xs text-gray-400">{sub}</span>}
                  </div>
                  <span className={`font-semibold text-sm ${color} whitespace-nowrap ml-2`}>
                    {minus ? '−' : ''}{sym}{fmtN(value)}
                  </span>
                </div>
              );

              return (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{title || 'Конструктор выручки'}</h3>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{data.voucherCount} ваучеров · {data.totalPax} чел.</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    <Row label="Выручка (продажи)" value={data.totalSale} color="text-blue-700" />
                    <Row label="Себестоимость (нетто)" value={data.totalNet} minus color="text-gray-500" />
                    <div className="px-4 py-2 bg-blue-50 flex justify-between items-center">
                      <span className="text-sm font-semibold text-blue-800">= Валовая прибыль</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded">{margin}%</span>
                        <span className="font-bold text-blue-800">{sym}{fmtN(data.grossProfit)}</span>
                      </div>
                    </div>
                    <Row label="Комиссии агентов" value={data.agentCommissions} minus color="text-orange-500"
                      toggled={revIncludes.agentCommissions}
                      onToggle={() => setRevIncludes(p => ({ ...p, agentCommissions: !p.agentCommissions }))} />
                    <div className="px-4 py-2 bg-blue-50 flex justify-between items-center">
                      <span className="text-sm font-semibold text-blue-800">= Прибыль после агентов</span>
                      <span className="font-bold text-blue-800">{sym}{fmtN(data.profitAfterAgent)}</span>
                    </div>
                    <Row label="ЗП менеджеров (% расчётно)" value={data.managerCommissions} minus color="text-purple-500"
                      toggled={revIncludes.managerCommissions}
                      onToggle={() => setRevIncludes(p => ({ ...p, managerCommissions: !p.managerCommissions }))} />
                    <Row label="Выплачено сотрудникам" sub="(касса)" value={data.employeePaid} minus color="text-purple-400"
                      toggled={revIncludes.employeePaid}
                      onToggle={() => setRevIncludes(p => ({ ...p, employeePaid: !p.employeePaid }))} />
                    <Row label="Прочие расходы (касса)" value={data.cashflowExpenses} minus color="text-red-400"
                      toggled={revIncludes.cashflowExpenses}
                      onToggle={() => setRevIncludes(p => ({ ...p, cashflowExpenses: !p.cashflowExpenses }))} />
                    {customExpenses.map(exp => (
                      <Row key={exp.id} label={exp.name} value={parseFloat(exp.amount) || 0} minus color="text-red-500" />
                    ))}
                    <div className={`px-4 py-3 ${selected >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-bold text-sm ${selected >= 0 ? 'text-green-800' : 'text-red-800'}`}>ЧИСТАЯ ВЫРУЧКА</span>
                        <span className={`font-bold text-lg ${selected >= 0 ? 'text-green-700' : 'text-red-600'}`}>{sym}{fmtN(selected)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Manager breakdown */}
                  {data.byManager?.length > 0 && (
                    <div className="border-t border-gray-100">
                      <button onClick={() => setRevShowManagers(p => !p)}
                        className="w-full px-4 py-2 flex justify-between items-center hover:bg-gray-50 text-sm">
                        <span className="font-medium text-gray-600">По менеджерам</span>
                        <span className="text-gray-400 text-xs">{revShowManagers ? '▲' : '▼'}</span>
                      </button>
                      {revShowManagers && (
                        <div className="divide-y divide-gray-100">
                          {data.byManager.map((m: any) => (
                            <div key={m.manager_id} className="px-4 py-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-700">{m.manager_name}</span>
                                <span className="text-xs text-gray-400">{m.commission_pct}%</span>
                              </div>
                              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                                <span>Продажи: {sym}{fmtN(m.total_sale)}</span>
                                <span className="text-purple-500">ЗП: {sym}{fmtN(m.manager_pay)}</span>
                              </div>
                              <div className="text-xs text-blue-600 font-medium">Профит: {sym}{fmtN(m.profit_after_agent)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            return revCurrency === 'all' && revenueDataAlt ? (
              // TWO SIDE-BY-SIDE PANELS — currencies never mixed
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ⚠ Валюты показаны раздельно — складывать ฿ и ₫ нельзя
                  </span>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {renderWaterfall(revenueData, '฿', '🇹🇭 Тайланд (THB)')}
                  {renderWaterfall(revenueDataAlt, '₫', '🇻🇳 Вьетнам (VND)')}
                </div>
              </div>
            ) : (
              renderWaterfall(revenueData, revCurrency === 'VND' ? '₫' : '฿')
            );
          })()}

          {/* Custom expenses editor */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-600 mb-3">➕ Кастомные расходы</div>
            {customExpenses.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {customExpenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between py-1.5 px-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                    <span className="text-gray-700">{exp.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-red-600">−{fmt(exp.amount)}</span>
                      <button onClick={() => removeCustomExpense(exp.id)} className="text-gray-400 hover:text-red-600 text-xs px-1">✕</button>
                    </div>
                  </div>
                ))}
                {customExpenses.length > 1 && (
                  <div className="flex justify-end text-xs text-gray-500 pr-8">
                    Итого: <span className="ml-1 font-semibold text-red-600">−{fmt(customExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0))}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input type="text" placeholder="Название (Реклама, Аренда...)" value={newExpenseName}
                onChange={e => setNewExpenseName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomExpense()}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              <input type="number" placeholder="Сумма" value={newExpenseAmount}
                onChange={e => setNewExpenseAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomExpense()}
                className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              <button onClick={addCustomExpense} className={btnPrimary}>+ Добавить</button>
            </div>
          </div>

          {!revenueData && (
            <div className="text-center py-12 text-gray-400">Выберите период и загрузите данные</div>
          )}
        </div>
      )}

      {/* ===== MANAGE PAYMENT METHODS MODAL ===== */}
      {showManageMethods && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Методы оплаты</h3>
              <button onClick={() => { setShowManageMethods(false); setEditingMethodId(null); setNewMethodName(''); }} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
              {paymentMethods.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 py-1">
                  {editingMethodId === m.id ? (
                    <>
                      <input
                        autoFocus
                        className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm"
                        value={editingMethodName}
                        onChange={e => setEditingMethodName(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            await api.updatePaymentMethod(m.id, editingMethodName);
                            setEditingMethodId(null);
                            loadPaymentMethods();
                          }
                          if (e.key === 'Escape') setEditingMethodId(null);
                        }}
                      />
                      <button onClick={async () => { await api.updatePaymentMethod(m.id, editingMethodName); setEditingMethodId(null); loadPaymentMethods(); }}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">✓</button>
                      <button onClick={() => setEditingMethodId(null)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-700">{m.name}</span>
                      {m.is_system && <span className="text-xs text-gray-400 px-1">система</span>}
                      {!m.is_system && (
                        <>
                          <button onClick={() => { setEditingMethodId(m.id); setEditingMethodName(m.name); }}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">✏</button>
                          <button onClick={async () => {
                            if (!confirm(`Удалить метод "${m.name}"?`)) return;
                            await api.deletePaymentMethod(m.id);
                            loadPaymentMethods();
                          }} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">✕</button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Новый метод оплаты..."
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={newMethodName}
                  onChange={e => setNewMethodName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newMethodName.trim()) {
                      await api.createPaymentMethod(newMethodName.trim());
                      setNewMethodName('');
                      loadPaymentMethods();
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (!newMethodName.trim()) return;
                    await api.createPaymentMethod(newMethodName.trim());
                    setNewMethodName('');
                    loadPaymentMethods();
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                >
                  + Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
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
                <label className={labelCls}>Валюта</label>
                <select value={cfForm.currency}
                  onChange={e => setCfForm(p => ({ ...p, currency: e.target.value }))} className={inputCls}>
                  <option value="THB">฿ THB (Тайланд)</option>
                  <option value="VND">₫ VND (Вьетнам)</option>
                  <option value="USD">$ USD</option>
                  <option value="RUB">₽ RUB</option>
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
                  {methodNames.map((m: string) => <option key={m} value={m}>{m}</option>)}
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
                  {methodNames.map((m: string) => <option key={m} value={m}>{m}</option>)}
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
    acc.paidTotal += Number(r.paid_total || 0) || (Number(r.paid_to_agency || 0) + Number(r.cash_on_tour || 0));
    acc.sale += Number(r.total_sale || 0);
    acc.net += Number(r.total_net || 0);
    acc.profit += Number(r.profit || 0);
    acc.agentComm += Number(r.agent_commission || 0);
    acc.profitAg += Number(r.profit_after_agent || 0);
    acc.managerPay += Number(r.manager_pay || 0);
    return acc;
  }, { adults: 0, children: 0, paid: 0, cash: 0, paidTotal: 0, sale: 0, net: 0, profit: 0, agentComm: 0, profitAg: 0, managerPay: 0 });

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
            <th className={thCls + ' text-right'}>Оплачено (итого)</th>
            <th className={thCls + ' text-right'}>Депозит в компанию</th>
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
                <td className={tdR + ' ' + paidCls}>{fB(Number(r.paid_total || 0) || (Number(r.paid_to_agency || 0) + Number(r.cash_on_tour || 0)))}</td>
                <td className={tdR + (Number(r.cash_on_tour) > 0 ? ' text-amber-600 font-semibold' : '')}>{Number(r.cash_on_tour) > 0 ? `+${fB(Number(r.cash_on_tour))}` : '—'}</td>
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
            <td className={tdR}>{fB(totals.paidTotal)}</td>
            <td className={tdR + ' text-amber-600'}>{fB(totals.cash)}</td>
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
