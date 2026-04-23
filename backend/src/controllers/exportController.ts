import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import ExcelJS from 'exceljs';

const BLUE_HEADER = 'FF1E3A5F';
const LIGHT_BLUE = 'FFD6E4F0';
const LIGHT_GREEN = 'FFE8F5E9';
const LIGHT_RED = 'FFFFF0F0';
const YELLOW = 'FFFFF9C4';
const WHITE = 'FFFFFFFF';
const ORANGE_VND = 'FFFFF3E0';   // light orange — VND rows
const TEAL_USD   = 'FFE0F7FA';   // light teal  — USD rows

function rowBgForCurrency(cur: string, idx: number, isImportant: boolean): string {
  if (isImportant) return YELLOW;
  if (cur === 'VND') return ORANGE_VND;
  if (cur === 'USD') return TEAL_USD;
  return idx % 2 === 0 ? WHITE : LIGHT_BLUE;
}

function hdr(ws: ExcelJS.Worksheet, row: number, col: number, value: string) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF999999' } },
    bottom: { style: 'thin', color: { argb: 'FF999999' } },
    left: { style: 'thin', color: { argb: 'FF999999' } },
    right: { style: 'thin', color: { argb: 'FF999999' } },
  };
}

function cell(ws: ExcelJS.Worksheet, row: number, col: number, value: any, bgColor?: string, bold?: boolean) {
  const c = ws.getCell(row, col);
  c.value = value;
  c.font = { name: 'Arial', size: 10, bold: !!bold };
  if (bgColor) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  c.border = {
    top: { style: 'hair', color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } },
    left: { style: 'hair', color: { argb: 'FFD0D0D0' } },
    right: { style: 'hair', color: { argb: 'FFD0D0D0' } },
  };
}

function money(ws: ExcelJS.Worksheet, row: number, col: number, value: any, bgColor?: string, bold?: boolean) {
  const c = ws.getCell(row, col);
  c.value = Number(value) || 0;
  c.numFmt = '#,##0';
  c.font = { name: 'Arial', size: 10, bold: !!bold };
  c.alignment = { horizontal: 'right' };
  if (bgColor) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  c.border = {
    top: { style: 'hair', color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } },
    left: { style: 'hair', color: { argb: 'FFD0D0D0' } },
    right: { style: 'hair', color: { argb: 'FFD0D0D0' } },
  };
}

function fmt(d: any): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export const exportDailyAccounting = async (req: AuthRequest, res: Response) => {
  try {
    const { date, dateFrom: dfParam, dateTo: dtParam, managerId } = req.query;
    const user = req.user!;

    // Support both single date (legacy) and dateFrom/dateTo range
    const dateFrom = dfParam ? String(dfParam) : (date ? String(date) : null);
    const dateTo   = dtParam ? String(dtParam) : (date ? String(date) : null);

    if (!dateFrom) return res.status(400).json({ error: 'dateFrom required' });

    const params: any[] = [dateFrom, dateTo || dateFrom];
    let managerFilter = '';

    const userRoles = user.roles || [user.role];
    if (userRoles.includes('manager') && !userRoles.includes('admin')) {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(user.id);
    } else if (managerId) {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(managerId);
    }

    // Vouchers sold in the period (by created_at = sale date)
    const vouchersRes = await pool.query(
      `SELECT
        v.id, v.voucher_number, v.tour_type, v.tour_date, v.tour_date_end, v.tour_time,
        v.adults, v.children, v.infants,
        v.total_sale, v.total_net, v.paid_to_agency, v.cash_on_tour,
        v.payment_status, v.hotel_name, v.room_number,
        v.remarks, v.is_important, v.cancellation_notes,
        COALESCE(v.currency, 'THB') as currency,
        v.agent_commission_percentage, v.created_at as sale_date,
        c.name as client_name, c.phone as client_phone,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        u.id as manager_id, u.full_name as manager_name, u.manager_phone,
        u.commission_percentage as manager_commission_percentage,
        a.name as agent_name,
        (SELECT MAX(p2.payment_date) FROM payments p2 WHERE p2.voucher_id = v.id) as last_payment_date,
        (SELECT string_agg(DISTINCT p2.payment_method, ', ' ORDER BY p2.payment_method)
          FROM payments p2 WHERE p2.voucher_id = v.id) as payment_methods
      FROM vouchers v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE v.created_at::date >= $1::date AND v.created_at::date <= $2::date
        AND v.is_deleted = false ${managerFilter}
      ORDER BY v.is_important DESC, co.name, v.created_at`,
      params
    );

    // Payments received in the period
    const paymentsRes = await pool.query(
      `SELECT
        p.payment_date, p.amount, v.currency, p.payment_method, p.notes,
        v.voucher_number, v.tour_date,
        c.name as client_name, c.phone as client_phone,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        u.full_name as manager_name
      FROM payments p
      JOIN vouchers v ON p.voucher_id = v.id
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      WHERE p.payment_date::date >= $1::date AND p.payment_date::date <= $2::date
        AND v.is_deleted = false ${managerFilter}
      ORDER BY p.payment_date`,
      params
    );

    const vouchers = vouchersRes.rows;
    const payments = paymentsRes.rows;

    // Pre-compute payments total by currency (used in Sheet 2 header + Sheet 4 summary)
    const payByCur: Record<string, number> = {};
    payments.forEach((p: any) => {
      const pc = p.currency || 'THB';
      payByCur[pc] = (payByCur[pc] || 0) + Number(p.amount || 0);
    });

    // ── BUILD EXCEL ──────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tour Tour Phuket CRM';
    wb.created = new Date();

    const dateFormatted = dateFrom === dateTo
      ? new Date(dateFrom).toLocaleDateString('ru-RU')
      : `${new Date(dateFrom).toLocaleDateString('ru-RU')} – ${new Date(dateTo!).toLocaleDateString('ru-RU')}`;

    // ═══════════════════════════════════════════════
    // SHEET 1: БУХГАЛТЕРИЯ
    // ═══════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Бухгалтерия');
    ws1.views = [{ state: 'frozen', ySplit: 4 }];

    const COL_COUNT = 21;
    ws1.mergeCells(`A1:U1`);
    const title1 = ws1.getCell('A1');
    title1.value = `БУХГАЛТЕРСКИЙ ОТЧЁТ — ${dateFormatted}`;
    title1.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    title1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 28;

    ws1.mergeCells('A2:U2');
    const sub1 = ws1.getCell('A2');
    sub1.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Ваучеров: ${vouchers.length} | Пассажиров: ${vouchers.reduce((s, v) => s + Number(v.adults || 0) + Number(v.children || 0), 0)}`;
    sub1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    sub1.alignment = { horizontal: 'center' };
    ws1.getRow(2).height = 16;
    ws1.getRow(3).height = 4;

    const vHeaders = [
      'Дата создания', 'Дата выезда', 'Компания', 'Тур', 'Валюта',
      'Взр.', 'Дет.', 'Мл.',
      'Оплачено', 'Наличные',
      'Sale', 'Нетто', 'Профит',
      'Агент (%)', 'Ком. агента', 'Профит−Аг.', 'Зарплата мен.', 'Чист. выручка',
      'Статус оплаты', 'Место оплаты', 'Примечание',
    ];
    vHeaders.forEach((h, i) => hdr(ws1, 4, i + 1, h));
    ws1.getRow(4).height = 40;

    const STATUS_LABELS: Record<string, string> = {
      paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен',
    };

    vouchers.forEach((v, i) => {
      const r = 5 + i;
      const cur = v.currency || 'THB';
      const bg = rowBgForCurrency(cur, i, v.is_important);
      const statusBg = v.payment_status === 'paid' ? LIGHT_GREEN : v.payment_status === 'unpaid' ? LIGHT_RED : YELLOW;

      const profit = Number(v.total_sale || 0) - Number(v.total_net || 0);
      const agentPct = v.agent_name ? Number(v.agent_commission_percentage || 0) / 100 : 0;
      const agentCommission = Math.round(profit * agentPct);
      const profitAfterAgent = Math.round(profit - agentCommission);
      const managerPct = Number(v.manager_commission_percentage || 0) / 100;
      const managerPay = Math.round(profitAfterAgent * managerPct);

      const statusLabel = STATUS_LABELS[v.payment_status] || v.payment_status;
      const statusWithDate = v.last_payment_date
        ? `${statusLabel} (${fmt(v.last_payment_date)})`
        : statusLabel;

      // Cols 1-4: dates, company, tour
      cell(ws1, r, 1, fmt(v.sale_date), bg);
      cell(ws1, r, 2, fmt(v.tour_date), bg);
      cell(ws1, r, 3, v.company_name || '—', bg);
      cell(ws1, r, 4, v.tour_name || '—', bg);

      // Col 5: Currency — bold, centered
      const curCell = ws1.getCell(r, 5);
      curCell.value = cur;
      curCell.font = { name: 'Arial', size: 10, bold: true,
        color: { argb: cur === 'VND' ? 'FFE65100' : cur === 'USD' ? 'FF00695C' : 'FF1E3A5F' } };
      curCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      curCell.alignment = { horizontal: 'center' };
      curCell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };

      // Cols 6-8: pax
      const mkCtr = (col: number, val: number) => {
        const c = ws1.getCell(r, col);
        c.value = val; c.font = { name: 'Arial', size: 10 };
        c.alignment = { horizontal: 'center' };
        if (bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      };
      mkCtr(6, Number(v.adults)); mkCtr(7, Number(v.children)); mkCtr(8, Number(v.infants));

      money(ws1, r,  9, v.paid_to_agency, bg);
      money(ws1, r, 10, v.cash_on_tour, bg);
      money(ws1, r, 11, v.total_sale, bg, true);
      money(ws1, r, 12, v.total_net, bg);
      money(ws1, r, 13, profit, profit < 0 ? LIGHT_RED : bg, true);
      cell(ws1,  r, 14, v.agent_name ? `${v.agent_name} (${v.agent_commission_percentage}%)` : '—', bg);
      money(ws1, r, 15, agentCommission, bg);
      money(ws1, r, 16, profitAfterAgent, bg);
      money(ws1, r, 17, managerPay, LIGHT_GREEN, true);

      // Col 18: Net revenue = profitAfterAgent - managerPay
      const netRevenue = profitAfterAgent - managerPay;
      money(ws1, r, 18, netRevenue, netRevenue < 0 ? LIGHT_RED : LIGHT_GREEN, true);

      // Col 19: Status with date
      const sc = ws1.getCell(r, 19);
      sc.value = statusWithDate;
      sc.font = { name: 'Arial', size: 10, bold: true };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
      sc.alignment = { horizontal: 'center', wrapText: true };
      sc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };

      cell(ws1, r, 20, v.payment_methods || '—', bg);
      cell(ws1, r, 21, [v.remarks, v.cancellation_notes].filter(Boolean).join(' | ') || '', bg);
    });

    // Totals row
    const tr1 = 5 + vouchers.length;
    ws1.mergeCells(tr1, 1, tr1, 5);
    const totalCell1 = ws1.getCell(tr1, 1);
    totalCell1.value = `ИТОГО: ${vouchers.length} ваучеров`;
    totalCell1.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    totalCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    totalCell1.alignment = { horizontal: 'right' };

    // Pax cols (6,7,8) = integer; money cols 9–18
    const moneyCols1 = [6,7,8,9,10,11,12,13,14,15,16,17,18];
    moneyCols1.forEach(col => {
      const c = ws1.getCell(tr1, col);
      c.value = { formula: `SUM(${ws1.getColumn(col).letter}5:${ws1.getColumn(col).letter}${tr1 - 1})` };
      c.numFmt = col <= 8 ? '0' : '#,##0';
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'right' };
    });
    [19, 20, 21].forEach(col => {
      const c = ws1.getCell(tr1, col);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    });
    ws1.getRow(tr1).height = 22;

    // 21 cols: date, date, company, tour, currency, adl, chd, inf, paid, cash, sale, net, profit, agent%, agcomm, paa, mgpay, netrev, status, method, notes
    [14, 12, 22, 28, 7, 5, 5, 5, 13, 13, 13, 13, 13, 22, 13, 13, 13, 13, 20, 18, 28].forEach((w, i) => {
      ws1.getColumn(i + 1).width = w;
    });

    // ═══════════════════════════════════════════════
    // SHEET 2: PAYMENTS
    // ═══════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Платежи');
    ws2.views = [{ state: 'frozen', ySplit: 4 }];

    ws2.mergeCells('A1:J1');
    const title2 = ws2.getCell('A1');
    title2.value = `ПЛАТЕЖИ ЗА ${dateFormatted}`;
    title2.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    title2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(1).height = 28;

    ws2.mergeCells('A2:J2');
    const sub2 = ws2.getCell('A2');
    const payTotalsStr = Object.entries(payByCur)
      .map(([c, s]) => `${c}: ${(s as number).toLocaleString('ru-RU')}`)
      .join(' | ');
    sub2.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Платежей: ${payments.length} | ${payTotalsStr}`;
    sub2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    sub2.alignment = { horizontal: 'center' };
    ws2.getRow(2).height = 16;
    ws2.getRow(3).height = 4;

    const pHeaders = ['Дата платежа', 'Ваучер №', 'Дата тура', 'Компания', 'Тур', 'Менеджер', 'Сумма', 'Метод / Примечание'];
    pHeaders.forEach((h, i) => hdr(ws2, 4, i + 1, h));
    ws2.getRow(4).height = 36;

    payments.forEach((p, i) => {
      const r = 5 + i;
      const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
      cell(ws2, r, 1, fmt(p.payment_date), bg);
      cell(ws2, r, 2, p.voucher_number, bg, true);
      cell(ws2, r, 3, fmt(p.tour_date), bg);
      cell(ws2, r, 4, p.company_name, bg);
      cell(ws2, r, 5, p.tour_name, bg);
      cell(ws2, r, 6, p.manager_name, bg);
      money(ws2, r, 7, p.amount, bg, true);
      cell(ws2, r, 8, [p.payment_method, p.currency !== 'THB' ? p.currency : '', p.notes].filter(Boolean).join(' · '), bg);
    });

    // Totals
    const pr = 5 + payments.length;
    ws2.mergeCells(pr, 1, pr, 6);
    const ptc = ws2.getCell(pr, 1);
    ptc.value = `ИТОГО: ${payments.length} платежей`;
    ptc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    ptc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    ptc.alignment = { horizontal: 'right' };

    if (payments.length > 0) {
      const pc = ws2.getCell(pr, 7);
      pc.value = { formula: `SUM(G5:G${4 + payments.length})` };
      pc.numFmt = '#,##0';
      pc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      pc.alignment = { horizontal: 'right' };
      ws2.getCell(pr, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    }
    ws2.getRow(pr).height = 22;

    [14, 12, 12, 20, 26, 18, 16, 30].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

    // ═══════════════════════════════════════════════
    // SHEET 3: ЗАРПЛАТА МЕНЕДЖЕРОВ
    // ═══════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Зарплата менеджеров');
    ws3.mergeCells('A1:H1');
    const t3 = ws3.getCell('A1');
    t3.value = `ЗАРПЛАТА МЕНЕДЖЕРОВ — ${dateFormatted}`;
    t3.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    t3.alignment = { horizontal: 'center', vertical: 'middle' };
    ws3.getRow(1).height = 28;
    ws3.getRow(2).height = 4;

    // 9 cols — added "Валюта" after "Менеджер"
    const salHeaders = ['Менеджер', 'Валюта', 'Ваучеров', 'Sale', 'Профит', 'Ком. агентов', 'Профит−Аг.', 'Ставка %', 'Зарплата'];
    salHeaders.forEach((h, i) => hdr(ws3, 3, i + 1, h));
    ws3.getRow(3).height = 32;

    // Group by (manager_id, currency) — never mix THB and VND in one row
    const mgMap: Record<string, any> = {};
    vouchers.forEach(v => {
      const cur = v.currency || 'THB';
      const key = `${v.manager_id}__${cur}`;
      if (!mgMap[key]) {
        mgMap[key] = {
          name: v.manager_name, currency: cur,
          count: 0, sale: 0, profit: 0, agentCommission: 0,
          profitAfterAgent: 0, managerPay: 0,
          pct: Number(v.manager_commission_percentage || 0),
        };
      }
      const m = mgMap[key];
      const profit = Number(v.total_sale || 0) - Number(v.total_net || 0);
      const agentPct = v.agent_name ? Number(v.agent_commission_percentage || 0) / 100 : 0;
      const agentComm = Math.round(profit * agentPct);
      const paa = Math.round(profit - agentComm);
      m.count++;
      m.sale += Number(v.total_sale || 0);
      m.profit += profit;
      m.agentCommission += agentComm;
      m.profitAfterAgent += paa;
      m.managerPay += Math.round(paa * m.pct / 100);
    });

    const mgList = Object.values(mgMap).sort((a: any, b: any) =>
      a.currency.localeCompare(b.currency) || b.managerPay - a.managerPay
    );
    mgList.forEach((m: any, i: number) => {
      const r = 4 + i;
      const bg = rowBgForCurrency(m.currency, i, false);
      cell(ws3, r, 1, m.name, bg, true);
      // Col 2: currency badge
      const cc = ws3.getCell(r, 2);
      cc.value = m.currency;
      cc.font = { name: 'Arial', size: 10, bold: true,
        color: { argb: m.currency === 'VND' ? 'FFE65100' : m.currency === 'USD' ? 'FF00695C' : 'FF1E3A5F' } };
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cc.alignment = { horizontal: 'center' };
      cc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      const cn = ws3.getCell(r, 3); cn.value = m.count; cn.font = { name: 'Arial', size: 10 }; cn.alignment = { horizontal: 'center' }; if (bg) cn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      money(ws3, r, 4, m.sale, bg);
      money(ws3, r, 5, m.profit, bg);
      money(ws3, r, 6, m.agentCommission, bg);
      money(ws3, r, 7, m.profitAfterAgent, bg);
      const cp = ws3.getCell(r, 8); cp.value = m.pct + '%'; cp.font = { name: 'Arial', size: 10 }; cp.alignment = { horizontal: 'center' }; if (bg) cp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      money(ws3, r, 9, m.managerPay, LIGHT_GREEN, true);
    });

    // Grand total row — note: sums mix currencies, just for reference
    const tr3 = 4 + mgList.length;
    ws3.mergeCells(tr3, 1, tr3, 3);
    const gt3 = ws3.getCell(tr3, 1);
    gt3.value = 'ИТОГО (⚠ валюты раздельно выше)';
    gt3.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    gt3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    gt3.alignment = { horizontal: 'right' };
    [4,5,6,7,8,9].forEach(col => {
      const c = ws3.getCell(tr3, col);
      c.value = { formula: `SUM(${ws3.getColumn(col).letter}4:${ws3.getColumn(col).letter}${tr3 - 1})` };
      c.numFmt = '#,##0';
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'right' };
    });
    ws3.getRow(tr3).height = 22;
    [24, 8, 10, 14, 14, 14, 14, 10, 16].forEach((w, i) => { ws3.getColumn(i + 1).width = w; });

    // ═══════════════════════════════════════════════
    // SHEET 4: SUMMARY
    // ═══════════════════════════════════════════════
    const ws4 = wb.addWorksheet('Итоги дня');

    ws4.mergeCells('A1:D1');
    const ts = ws4.getCell('A1');
    ts.value = `ИТОГИ ДНЯ — ${dateFormatted}`;
    ts.font = { name: 'Arial', bold: true, size: 16, color: { argb: BLUE_HEADER } };
    ts.alignment = { horizontal: 'center', vertical: 'middle' };
    ws4.getRow(1).height = 36;

    const totalPax = vouchers.reduce((s: number, v: any) => s + Number(v.adults || 0) + Number(v.children || 0), 0);

    // Group financial totals by currency
    const finByCur: Record<string, { sale: number; net: number; paid: number; cash: number; count: number }> = {};
    vouchers.forEach((v: any) => {
      const c = v.currency || 'THB';
      if (!finByCur[c]) finByCur[c] = { sale: 0, net: 0, paid: 0, cash: 0, count: 0 };
      finByCur[c].sale += Number(v.total_sale || 0);
      finByCur[c].net  += Number(v.total_net  || 0);
      finByCur[c].paid += Number(v.paid_to_agency || 0);
      finByCur[c].cash += Number(v.cash_on_tour   || 0);
      finByCur[c].count++;
    });
    const CUR_SYM: Record<string, string> = { THB: '฿', VND: '₫', USD: '$' };

    const summaryRows: [string, any, boolean?][] = [
      ['', '', true],
      ['ВАУЧЕРЫ', '', true],
      ['Всего ваучеров', vouchers.length],
      ['Пассажиров (взр+дет)', totalPax],
      ['Оплачено', vouchers.filter((v: any) => v.payment_status === 'paid').length],
      ['Частично оплачено', vouchers.filter((v: any) => v.payment_status === 'partial').length],
      ['Не оплачено', vouchers.filter((v: any) => v.payment_status === 'unpaid').length],
      ...Object.entries(finByCur).flatMap(([cur, f]) => {
        const sym = CUR_SYM[cur] || cur;
        return [
          ['', '', true] as [string, any, boolean?],
          [`ФИНАНСЫ — ${sym} ${cur}`, '', true] as [string, any, boolean?],
          [`Ваучеров (${cur})`, f.count] as [string, any],
          [`Продажи (${sym})`, f.sale] as [string, any],
          [`Нетто (${sym})`, f.net] as [string, any],
          [`Прибыль (${sym})`, f.sale - f.net] as [string, any],
          [`Оплачено агентству (${sym})`, f.paid] as [string, any],
          [`Наличные в туре (${sym})`, f.cash] as [string, any],
        ];
      }),
      ['', '', true],
      ['ПЛАТЕЖИ', '', true],
      ['Количество платежей', payments.length],
      ...Object.entries(payByCur).map(([c, s]) => [`Сумма платежей ${c}`, s] as [string, any]),
    ];

    let sRow = 2;
    summaryRows.forEach(([label, value, isSection]) => {
      if (!label && !value) { sRow++; return; }

      if (isSection) {
        ws4.mergeCells(sRow, 1, sRow, 4);
        const sc = ws4.getCell(sRow, 1);
        sc.value = label;
        sc.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
        sc.alignment = { horizontal: 'left', indent: 1 };
        ws4.getRow(sRow).height = 22;
      } else {
        const lc = ws4.getCell(sRow, 1);
        lc.value = label;
        lc.font = { name: 'Arial', size: 10 };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sRow % 2 === 0 ? LIGHT_BLUE : WHITE } };
        lc.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };

        const vc = ws4.getCell(sRow, 2);
        const isMoneyRow = typeof value === 'number' && ['Продажи', 'Нетто', 'Прибыль', 'Оплачено аг', 'Наличные', 'Сумма'].some(k => (label as string).startsWith(k));
        vc.value = value;
        vc.font = { name: 'Arial', size: 10, bold: true };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sRow % 2 === 0 ? LIGHT_BLUE : WHITE } };
        vc.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
        vc.alignment = { horizontal: 'right' };
        if (isMoneyRow) vc.numFmt = '#,##0';
        ws4.getRow(sRow).height = 20;
      }
      sRow++;
    });

    ws4.getColumn(1).width = 30;
    ws4.getColumn(2).width = 20;

    // ═══════════════════════════════════════════════
    // SHEET 5: ДВИЖЕНИЕ СРЕДСТВ (без списаний, по валютам)
    // ═══════════════════════════════════════════════
    const cfRes = await pool.query(
      `SELECT ae.entry_date, ae.entry_type, ae.payment_method,
              ae.counterparty_name, ae.category, ae.amount,
              COALESCE(ae.currency, 'THB') AS currency,
              ae.notes
       FROM accounting_entries ae
       WHERE ae.entry_date >= $1 AND ae.entry_date <= $2
         AND ae.category NOT IN ('Списание долга', 'Списание долга агенту')
       ORDER BY ae.currency, ae.entry_date ASC, ae.created_at ASC`,
      [dateFrom, dateTo || dateFrom]
    );
    const cfRows = cfRes.rows;

    const ws5 = wb.addWorksheet('Движение средств');
    const cfCols = ['Дата', 'Тип', 'Категория', 'Контрагент', 'Метод оплаты', 'Приход', 'Расход', 'Валюта', 'Примечание'];
    const cfWidths = [12, 10, 22, 30, 20, 14, 14, 8, 40];

    let cf5r = 1;
    const CF_CURRENCIES = ['THB', 'USD', 'VND'];
    const CF_SYM: Record<string, string> = { THB: '฿', USD: '$', VND: '₫' };
    const CF_BG: Record<string, string> = { THB: WHITE, USD: TEAL_USD, VND: ORANGE_VND };

    for (const cur of CF_CURRENCIES) {
      const rows = cfRows.filter((r: any) => r.currency === cur);
      if (rows.length === 0) continue;

      // Currency header
      ws5.mergeCells(cf5r, 1, cf5r, cfCols.length);
      const chCell = ws5.getCell(cf5r, 1);
      chCell.value = `${cur}  ${CF_SYM[cur]}`;
      chCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      chCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      chCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws5.getRow(cf5r).height = 24;
      cf5r++;

      // Column headers
      cfCols.forEach((h, i) => hdr(ws5, cf5r, i + 1, h));
      ws5.getRow(cf5r).height = 20;
      cf5r++;

      let totalIncome = 0, totalExpense = 0;
      rows.forEach((r: any, idx: number) => {
        const bg = CF_BG[cur];
        const rowBg = idx % 2 === 0 ? bg : LIGHT_BLUE;
        const isIncome = r.entry_type === 'income';
        const amt = Number(r.amount);
        if (isIncome) totalIncome += amt; else totalExpense += amt;

        cell(ws5, cf5r, 1, new Date(r.entry_date).toLocaleDateString('ru-RU'), rowBg);
        cell(ws5, cf5r, 2, isIncome ? 'Приход' : 'Расход', rowBg);
        cell(ws5, cf5r, 3, r.category || '—', rowBg);
        cell(ws5, cf5r, 4, r.counterparty_name || '—', rowBg);
        cell(ws5, cf5r, 5, r.payment_method || '—', rowBg);
        money(ws5, cf5r, 6, isIncome ? amt : '', rowBg);
        money(ws5, cf5r, 7, !isIncome ? amt : '', rowBg);
        cell(ws5, cf5r, 8, cur, rowBg);
        cell(ws5, cf5r, 9, r.notes || '', rowBg);
        cf5r++;
      });

      // Totals row
      const totBg = 'FFDCE6F1';
      cell(ws5, cf5r, 1, 'ИТОГО', totBg, true);
      cell(ws5, cf5r, 2, '', totBg);
      cell(ws5, cf5r, 3, '', totBg);
      cell(ws5, cf5r, 4, '', totBg);
      cell(ws5, cf5r, 5, `Баланс: ${(totalIncome - totalExpense).toLocaleString('ru-RU')} ${CF_SYM[cur]}`, totBg, true);
      money(ws5, cf5r, 6, totalIncome, totBg, true);
      money(ws5, cf5r, 7, totalExpense, totBg, true);
      cell(ws5, cf5r, 8, cur, totBg, true);
      cell(ws5, cf5r, 9, '', totBg);
      ws5.getRow(cf5r).height = 22;
      cf5r += 2; // blank row between currencies
    }

    cfWidths.forEach((w, i) => { ws5.getColumn(i + 1).width = w; });

    // ═══════════════════════════════════════════════
    // SHEET 6: ОПЕРАТОРЫ (баланс без списаний)
    // ═══════════════════════════════════════════════
    const opRes = await pool.query(
      `SELECT
         c.name AS company_name,
         COALESCE(SUM(CASE WHEN v.is_deleted = false THEN v.total_net ELSE 0 END), 0) AS total_owed,
         COALESCE(SUM(CASE WHEN v.is_deleted = false THEN COALESCE(v.cash_on_tour, 0) ELSE 0 END), 0) AS total_cash,
         COALESCE((
           SELECT SUM(ae2.amount) FROM accounting_entries ae2
           WHERE ae2.company_id = c.id AND ae2.entry_type = 'expense'
             AND ae2.category NOT IN ('Списание долга')
         ), 0) AS total_sent
       FROM companies c
       LEFT JOIN vouchers v ON v.company_id = c.id AND v.is_deleted = false
       WHERE c.is_active = true
       GROUP BY c.id, c.name
       HAVING COUNT(v.id) > 0
       ORDER BY c.name`
    );

    const ws6 = wb.addWorksheet('Операторы');
    ws6.mergeCells('A1:E1');
    const op6t = ws6.getCell('A1');
    op6t.value = `ОПЕРАТОРЫ — расчёты (${dateFrom} — ${dateTo || dateFrom})`;
    op6t.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
    op6t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws6.getRow(1).height = 30;

    const opHdrs = ['Компания', 'Нетто (к оплате)', 'Кэш на туре', 'Отправлено', 'Баланс'];
    opHdrs.forEach((h, i) => hdr(ws6, 2, i + 1, h));
    ws6.getRow(2).height = 20;

    let op6r = 3;
    opRes.rows.forEach((r: any, idx: number) => {
      const owed = Number(r.total_owed);
      const cash = Number(r.total_cash);
      const sent = Number(r.total_sent);
      const balance = sent + cash - owed;
      const bg = balance >= 0 ? LIGHT_GREEN : (idx % 2 === 0 ? WHITE : LIGHT_BLUE);
      cell(ws6, op6r, 1, r.company_name, bg, true);
      money(ws6, op6r, 2, owed, bg);
      money(ws6, op6r, 3, cash, bg);
      money(ws6, op6r, 4, sent, bg);
      money(ws6, op6r, 5, balance, bg, true);
      ws6.getCell(op6r, 5).font = { name: 'Arial', size: 10, bold: true, color: { argb: balance >= 0 ? 'FF1B6B3A' : 'FF9B0000' } };
      op6r++;
    });

    [30, 16, 16, 16, 16].forEach((w, i) => { ws6.getColumn(i + 1).width = w; });

    // ═══════════════════════════════════════════════
    // SHEET 7: АГЕНТЫ (комиссии без списаний)
    // ═══════════════════════════════════════════════
    const agRes = await pool.query(
      `SELECT
         a.name AS agent_name,
         COALESCE(SUM(
           CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0
             THEN ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0)
             ELSE 0 END
         ), 0) AS total_commission_owed,
         COALESCE((
           SELECT SUM(ae2.amount) FROM accounting_entries ae2
           WHERE ae2.agent_id = a.id AND ae2.entry_type = 'expense'
             AND ae2.category NOT IN ('Списание долга агенту')
         ), 0) AS total_paid
       FROM agents a
       LEFT JOIN vouchers v ON v.agent_id = a.id
       WHERE a.is_active = true
       GROUP BY a.id, a.name
       HAVING COUNT(v.id) > 0
       ORDER BY a.name`
    );

    const ws7 = wb.addWorksheet('Агенты');
    ws7.mergeCells('A1:D1');
    const ag7t = ws7.getCell('A1');
    ag7t.value = `АГЕНТЫ — комиссии (${dateFrom} — ${dateTo || dateFrom})`;
    ag7t.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
    ag7t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws7.getRow(1).height = 30;

    const agHdrs = ['Агент', 'Начислено', 'Выплачено', 'Баланс'];
    agHdrs.forEach((h, i) => hdr(ws7, 2, i + 1, h));
    ws7.getRow(2).height = 20;

    let ag7r = 3;
    agRes.rows.forEach((r: any, idx: number) => {
      const owed = Number(r.total_commission_owed);
      const paid = Number(r.total_paid);
      const balance = paid - owed;
      const bg = balance >= 0 ? LIGHT_GREEN : (idx % 2 === 0 ? WHITE : LIGHT_BLUE);
      cell(ws7, ag7r, 1, r.agent_name, bg, true);
      money(ws7, ag7r, 2, owed, bg);
      money(ws7, ag7r, 3, paid, bg);
      money(ws7, ag7r, 4, balance, bg, true);
      ws7.getCell(ag7r, 4).font = { name: 'Arial', size: 10, bold: true, color: { argb: balance >= 0 ? 'FF1B6B3A' : 'FF9B0000' } };
      ag7r++;
    });

    [30, 16, 16, 16].forEach((w, i) => { ws7.getColumn(i + 1).width = w; });

    // ── STREAM RESPONSE ──
    const filename = dateFrom === dateTo
      ? `accounting_${dateFrom}.xlsx`
      : `accounting_${dateFrom}_${dateTo}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

// Hotline daily report (Excel)
export const exportHotlineReport = async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const d = String(date);

    const { rows: vouchers } = await pool.query(
      `SELECT
        v.voucher_number, v.tour_date, v.tour_time, v.created_at,
        v.adults, v.children, v.infants,
        v.hotel_name, v.room_number,
        v.total_sale, v.paid_to_agency, v.cash_on_tour, v.payment_status,
        v.is_important, v.remarks,
        c.name as client_name, c.phone as client_phone,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        u.full_name as manager_name,
        a.name as agent_name
      FROM vouchers v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE v.tour_date::date = $1::date
        AND v.is_deleted = false
      ORDER BY v.tour_time NULLS LAST, co.name`,
      [d]
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tour Tour Phuket CRM';
    const ws = wb.addWorksheet('Хотлайн');
    ws.views = [{ state: 'frozen', ySplit: 3 }];

    const dateLabel = new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    ws.mergeCells('A1:R1');
    const title = ws.getCell('A1');
    title.value = `ХОТЛАЙН — ${dateLabel}`;
    title.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:R2');
    const sub = ws.getCell('A2');
    const totalPax = vouchers.reduce((s: number, v: any) => s + Number(v.adults||0) + Number(v.children||0) + Number(v.infants||0), 0);
    sub.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Ваучеров: ${vouchers.length} | Пассажиров: ${totalPax}`;
    sub.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    sub.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 16;

    const headers = [
      'Ваучер №', 'Создан', 'Время', 'Компания', 'Тур',
      'Отель', 'Комната', 'Клиент', 'Телефон',
      'Взр.', 'Дет.', 'Мл.',
      'Оплачено', 'Наличные', 'Sale',
      'Агент', 'Статус', 'Примечание',
    ];
    headers.forEach((h, i) => hdr(ws, 3, i + 1, h));
    ws.getRow(3).height = 36;

    const STATUS_LABELS: Record<string, string> = { paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен' };

    vouchers.forEach((v: any, i: number) => {
      const r = 4 + i;
      const bg = v.is_important ? YELLOW : (i % 2 === 0 ? WHITE : LIGHT_BLUE);
      const fmtT = (val: any) => {
        if (!val) return '—';
        const dd = new Date(val);
        return `${String(dd.getDate()).padStart(2,'0')}.${String(dd.getMonth()+1).padStart(2,'0')}`;
      };

      cell(ws, r, 1, v.voucher_number, bg, true);
      cell(ws, r, 2, fmtT(v.created_at), bg);
      cell(ws, r, 3, v.tour_time || '—', bg);
      cell(ws, r, 4, v.company_name || '—', bg);
      cell(ws, r, 5, v.tour_name || '—', bg);
      cell(ws, r, 6, v.hotel_name || '—', bg);
      cell(ws, r, 7, v.room_number || '—', bg);
      cell(ws, r, 8, v.client_name || '—', bg, true);
      cell(ws, r, 9, v.client_phone || '—', bg);

      const mkCtr = (col: number, val: number) => {
        const c = ws.getCell(r, col);
        c.value = val; c.font = { name: 'Arial', size: 10 };
        c.alignment = { horizontal: 'center' };
        if (bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      };
      mkCtr(10, Number(v.adults)); mkCtr(11, Number(v.children)); mkCtr(12, Number(v.infants));

      money(ws, r, 13, v.paid_to_agency, bg);
      money(ws, r, 14, v.cash_on_tour, bg);
      money(ws, r, 15, v.total_sale, bg, true);
      cell(ws, r, 16, v.agent_name || '—', bg);

      const statusBg = v.payment_status === 'paid' ? LIGHT_GREEN : v.payment_status === 'unpaid' ? LIGHT_RED : YELLOW;
      const sc = ws.getCell(r, 17);
      sc.value = STATUS_LABELS[v.payment_status] || v.payment_status;
      sc.font = { name: 'Arial', size: 10, bold: true };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
      sc.alignment = { horizontal: 'center' };
      sc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };

      cell(ws, r, 18, v.remarks || '', bg);
    });

    // Totals row
    const tr = 4 + vouchers.length;
    ws.mergeCells(tr, 1, tr, 9);
    const tc = ws.getCell(tr, 1);
    tc.value = `ИТОГО: ${vouchers.length} ваучеров, ${totalPax} пассажиров`;
    tc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    tc.alignment = { horizontal: 'right' };
    [10,11,12].forEach(col => {
      const c = ws.getCell(tr, col);
      c.value = { formula: `SUM(${ws.getColumn(col).letter}4:${ws.getColumn(col).letter}${tr - 1})` };
      c.numFmt = '0'; c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'center' };
    });
    [13,14,15].forEach(col => {
      const c = ws.getCell(tr, col);
      c.value = { formula: `SUM(${ws.getColumn(col).letter}4:${ws.getColumn(col).letter}${tr - 1})` };
      c.numFmt = '#,##0'; c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'right' };
    });
    [16,17,18].forEach(col => {
      ws.getCell(tr, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    });
    ws.getRow(tr).height = 22;

    [12, 8, 7, 20, 26, 16, 8, 18, 14, 4, 4, 4, 13, 13, 13, 14, 10, 24].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="hotline_${d}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Hotline export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

// Manager report — same format as main accounting report, filtered by manager, by sale date
export const exportManagerReport = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom: dfParam, dateTo: dtParam, managerId } = req.query;
    const user = req.user!;
    const dateFrom = dfParam ? String(dfParam) : null;
    const dateTo   = dtParam ? String(dtParam) : dateFrom;
    if (!dateFrom) return res.status(400).json({ error: 'dateFrom required' });

    const params: any[] = [dateFrom, dateTo || dateFrom];
    let managerFilter = '';
    const userRoles2 = user.roles || [user.role];
    if (userRoles2.includes('manager') && !userRoles2.includes('admin')) {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(user.id);
    } else if (managerId) {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(managerId);
    }

    const vRes = await pool.query(
      `SELECT
        v.id, v.voucher_number, v.tour_date, v.tour_time,
        v.adults, v.children, v.infants,
        v.total_sale, v.total_net, v.paid_to_agency, v.cash_on_tour,
        v.payment_status, v.hotel_name, v.room_number,
        v.remarks, v.is_important, v.cancellation_notes,
        v.agent_commission_percentage, v.created_at as sale_date,
        v.manager_id,
        c.name as client_name, c.phone as client_phone,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        u.full_name as manager_name,
        u.commission_percentage as manager_commission_percentage,
        a.name as agent_name,
        (SELECT MAX(p2.payment_date) FROM payments p2 WHERE p2.voucher_id = v.id) as last_payment_date,
        (SELECT string_agg(DISTINCT p2.payment_method, ', ' ORDER BY p2.payment_method)
          FROM payments p2 WHERE p2.voucher_id = v.id) as payment_methods
      FROM vouchers v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE v.created_at::date >= $1::date AND v.created_at::date <= $2::date
        AND v.is_deleted = false ${managerFilter}
      ORDER BY v.is_important DESC, co.name, v.created_at`,
      params
    );

    const pRes = await pool.query(
      `SELECT
        p.payment_date, p.amount, v.currency, p.payment_method, p.notes,
        v.voucher_number, v.tour_date,
        c.name as client_name, c.phone as client_phone,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        u.full_name as manager_name
      FROM payments p
      JOIN vouchers v ON p.voucher_id = v.id
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      WHERE p.payment_date::date >= $1::date AND p.payment_date::date <= $2::date
        AND v.is_deleted = false ${managerFilter}
      ORDER BY p.payment_date`,
      params
    );

    const vouchers = vRes.rows;
    const payments = pRes.rows;

    const STATUS_LABELS2: Record<string, string> = { paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен' };
    const dateFormatted = dateFrom === dateTo
      ? new Date(dateFrom).toLocaleDateString('ru-RU')
      : `${new Date(dateFrom).toLocaleDateString('ru-RU')} – ${new Date(dateTo!).toLocaleDateString('ru-RU')}`;

    // Detect manager name for report title
    const managerNameForTitle = vouchers.length > 0 ? vouchers[0].manager_name : 'Менеджер';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tour Tour Phuket CRM';
    wb.created = new Date();

    // ── SHEET 1: ВАУЧЕРЫ (same as main Бухгалтерия)
    const mws1 = wb.addWorksheet('Бухгалтерия');
    mws1.views = [{ state: 'frozen', ySplit: 4 }];
    mws1.mergeCells('A1:S1');
    const mt1 = mws1.getCell('A1');
    mt1.value = `ОТЧЁТ МЕНЕДЖЕРА: ${managerNameForTitle} — ${dateFormatted}`;
    mt1.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    mt1.alignment = { horizontal: 'center', vertical: 'middle' };
    mws1.getRow(1).height = 28;
    mws1.mergeCells('A2:S2');
    const ms1 = mws1.getCell('A2');
    ms1.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Ваучеров: ${vouchers.length} | Пассажиров: ${vouchers.reduce((s: number, v: any) => s + Number(v.adults||0) + Number(v.children||0), 0)}`;
    ms1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    ms1.alignment = { horizontal: 'center' };
    mws1.getRow(2).height = 16;
    mws1.getRow(3).height = 4;

    const mHeaders1 = [
      'Дата создания', 'Дата выезда', 'Компания', 'Тур',
      'Взр.', 'Дет.', 'Мл.',
      'Оплачено', 'Наличные',
      'Sale', 'Нетто', 'Профит',
      'Агент (%)', 'Ком. агента', 'Профит−Аг.', 'Зарплата мен.',
      'Статус оплаты', 'Место оплаты', 'Примечание',
    ];
    mHeaders1.forEach((h, i) => hdr(mws1, 4, i + 1, h));
    mws1.getRow(4).height = 40;

    vouchers.forEach((v: any, i: number) => {
      const r = 5 + i;
      const bg = v.is_important ? YELLOW : (i % 2 === 0 ? WHITE : LIGHT_BLUE);
      const statusBg = v.payment_status === 'paid' ? LIGHT_GREEN : v.payment_status === 'unpaid' ? LIGHT_RED : YELLOW;
      const profit = Number(v.total_sale || 0) - Number(v.total_net || 0);
      const agentPct = v.agent_name ? Number(v.agent_commission_percentage || 0) / 100 : 0;
      const agentCommission = Math.round(profit * agentPct);
      const profitAfterAgent = Math.round(profit - agentCommission);
      const managerPct = Number(v.manager_commission_percentage || 0) / 100;
      const managerPay = Math.round(profitAfterAgent * managerPct);
      const statusLabel = STATUS_LABELS2[v.payment_status] || v.payment_status;
      const statusWithDate = v.last_payment_date
        ? `${statusLabel} (${fmt(v.last_payment_date)})`
        : statusLabel;

      cell(mws1, r, 1, fmt(v.sale_date), bg);
      cell(mws1, r, 2, fmt(v.tour_date), bg);
      cell(mws1, r, 3, v.company_name || '—', bg);
      cell(mws1, r, 4, v.tour_name || '—', bg);

      const mkC = (col: number, val: number) => {
        const c = mws1.getCell(r, col);
        c.value = val; c.font = { name: 'Arial', size: 10 };
        c.alignment = { horizontal: 'center' };
        if (bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      };
      mkC(5, Number(v.adults)); mkC(6, Number(v.children)); mkC(7, Number(v.infants));
      money(mws1, r, 8, v.paid_to_agency, bg);
      money(mws1, r, 9, v.cash_on_tour, bg);
      money(mws1, r, 10, v.total_sale, bg, true);
      money(mws1, r, 11, v.total_net, bg);
      money(mws1, r, 12, profit, profit < 0 ? LIGHT_RED : bg, true);
      cell(mws1, r, 13, v.agent_name ? `${v.agent_name} (${v.agent_commission_percentage}%)` : '—', bg);
      money(mws1, r, 14, agentCommission, bg);
      money(mws1, r, 15, profitAfterAgent, bg);
      money(mws1, r, 16, managerPay, LIGHT_GREEN, true);

      const sc = mws1.getCell(r, 17);
      sc.value = statusWithDate;
      sc.font = { name: 'Arial', size: 10, bold: true };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
      sc.alignment = { horizontal: 'center', wrapText: true };
      sc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };

      cell(mws1, r, 18, v.payment_methods || '—', bg);
      cell(mws1, r, 19, [v.remarks, v.cancellation_notes].filter(Boolean).join(' | ') || '', bg);
    });

    const mtr1 = 5 + vouchers.length;
    mws1.mergeCells(mtr1, 1, mtr1, 4);
    const mtc1 = mws1.getCell(mtr1, 1);
    mtc1.value = `ИТОГО: ${vouchers.length} ваучеров`;
    mtc1.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    mtc1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    mtc1.alignment = { horizontal: 'right' };
    [5,6,7,8,9,10,11,12,13,14,15,16].forEach(col => {
      const c = mws1.getCell(mtr1, col);
      c.value = { formula: `SUM(${mws1.getColumn(col).letter}5:${mws1.getColumn(col).letter}${mtr1 - 1})` };
      c.numFmt = col > 7 ? '#,##0' : '0';
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'right' };
    });
    [17,18,19].forEach(col => {
      mws1.getCell(mtr1, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    });
    mws1.getRow(mtr1).height = 22;
    [14, 12, 22, 28, 5, 5, 5, 13, 13, 13, 13, 13, 22, 13, 13, 13, 20, 18, 28].forEach((w, i) => {
      mws1.getColumn(i + 1).width = w;
    });

    // ── SHEET 2: ПЛАТЕЖИ
    const mws2 = wb.addWorksheet('Платежи');
    mws2.views = [{ state: 'frozen', ySplit: 4 }];
    mws2.mergeCells('A1:J1');
    const mt2 = mws2.getCell('A1');
    mt2.value = `ПЛАТЕЖИ — ${managerNameForTitle} — ${dateFormatted}`;
    mt2.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    mt2.alignment = { horizontal: 'center', vertical: 'middle' };
    mws2.getRow(1).height = 28;
    mws2.mergeCells('A2:J2');
    const ms2 = mws2.getCell('A2');
    const totalPay = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    ms2.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Платежей: ${payments.length} | Сумма: ${totalPay.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    ms2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    ms2.alignment = { horizontal: 'center' };
    mws2.getRow(2).height = 16;
    mws2.getRow(3).height = 4;
    ['Дата платежа', 'Ваучер №', 'Дата тура', 'Компания', 'Тур', 'Менеджер', 'Сумма', 'Метод / Примечание'].forEach((h, i) => hdr(mws2, 4, i + 1, h));
    mws2.getRow(4).height = 36;
    payments.forEach((p: any, i: number) => {
      const r = 5 + i;
      const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
      cell(mws2, r, 1, fmt(p.payment_date), bg);
      cell(mws2, r, 2, p.voucher_number, bg, true);
      cell(mws2, r, 3, fmt(p.tour_date), bg);
      cell(mws2, r, 4, p.company_name, bg);
      cell(mws2, r, 5, p.tour_name, bg);
      cell(mws2, r, 6, p.manager_name, bg);
      money(mws2, r, 7, p.amount, bg, true);
      cell(mws2, r, 8, [p.payment_method, p.currency !== 'THB' ? p.currency : '', p.notes].filter(Boolean).join(' · '), bg);
    });
    const mpr = 5 + payments.length;
    mws2.mergeCells(mpr, 1, mpr, 6);
    const mptc = mws2.getCell(mpr, 1);
    mptc.value = `ИТОГО: ${payments.length} платежей`;
    mptc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    mptc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    mptc.alignment = { horizontal: 'right' };
    if (payments.length > 0) {
      const pc = mws2.getCell(mpr, 7);
      pc.value = { formula: `SUM(G5:G${4 + payments.length})` };
      pc.numFmt = '#,##0';
      pc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      pc.alignment = { horizontal: 'right' };
      mws2.getCell(mpr, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    }
    mws2.getRow(mpr).height = 22;
    [14, 12, 12, 20, 26, 18, 16, 30].forEach((w, i) => { mws2.getColumn(i + 1).width = w; });

    // ── SHEET 3: ИТОГИ
    const mws3 = wb.addWorksheet('Итоги');
    mws3.mergeCells('A1:D1');
    const mt3 = mws3.getCell('A1');
    mt3.value = `ИТОГИ — ${managerNameForTitle} — ${dateFormatted}`;
    mt3.font = { name: 'Arial', bold: true, size: 16, color: { argb: BLUE_HEADER } };
    mt3.alignment = { horizontal: 'center', vertical: 'middle' };
    mws3.getRow(1).height = 36;

    const mTotalSale = vouchers.reduce((s: number, v: any) => s + Number(v.total_sale || 0), 0);
    const mTotalNet  = vouchers.reduce((s: number, v: any) => s + Number(v.total_net || 0), 0);
    const mTotalPaid = vouchers.reduce((s: number, v: any) => s + Number(v.paid_to_agency || 0), 0);
    const mTotalCash = vouchers.reduce((s: number, v: any) => s + Number(v.cash_on_tour || 0), 0);
    let mTotalProfit = 0, mTotalAgentComm = 0, mTotalPAA = 0, mTotalMgrPay = 0;
    vouchers.forEach((v: any) => {
      const profit = Number(v.total_sale || 0) - Number(v.total_net || 0);
      const agentPct2 = v.agent_name ? Number(v.agent_commission_percentage || 0) / 100 : 0;
      const agentComm2 = Math.round(profit * agentPct2);
      const paa = Math.round(profit - agentComm2);
      mTotalProfit    += profit;
      mTotalAgentComm += agentComm2;
      mTotalPAA       += paa;
      mTotalMgrPay    += Math.round(paa * Number(v.manager_commission_percentage || 0) / 100);
    });

    const mSummaryRows: [string, any, boolean?][] = [
      ['', '', true],
      ['ВАУЧЕРЫ', '', true],
      ['Всего ваучеров', vouchers.length],
      ['Оплачено', vouchers.filter((v: any) => v.payment_status === 'paid').length],
      ['Частично оплачено', vouchers.filter((v: any) => v.payment_status === 'partial').length],
      ['Не оплачено', vouchers.filter((v: any) => v.payment_status === 'unpaid').length],
      ['', '', true],
      ['ФИНАНСЫ', '', true],
      ['Продажи (Sale)', mTotalSale],
      ['Нетто (Net)', mTotalNet],
      ['Прибыль (Sale − Net)', mTotalProfit],
      ['Комиссия агентов', mTotalAgentComm],
      ['Профит после агентов', mTotalPAA],
      ['Оплачено агентству', mTotalPaid],
      ['Наличные в туре', mTotalCash],
      ['', '', true],
      ['ЗАРПЛАТА', '', true],
      ['Зарплата менеджера', mTotalMgrPay],
      ['', '', true],
      ['ПЛАТЕЖИ ЗА ПЕРИОД', '', true],
      ['Количество платежей', payments.length],
      ['Сумма платежей', totalPay],
    ];

    let sRow3 = 2;
    mSummaryRows.forEach(([label, value, isSection]) => {
      if (!label && !value) { sRow3++; return; }
      if (isSection) {
        mws3.mergeCells(sRow3, 1, sRow3, 4);
        const sc3 = mws3.getCell(sRow3, 1);
        sc3.value = label;
        sc3.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        sc3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
        sc3.alignment = { horizontal: 'left', indent: 1 };
        mws3.getRow(sRow3).height = 22;
      } else {
        const lc3 = mws3.getCell(sRow3, 1);
        lc3.value = label;
        lc3.font = { name: 'Arial', size: 10 };
        lc3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sRow3 % 2 === 0 ? LIGHT_BLUE : WHITE } };
        lc3.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
        const vc3 = mws3.getCell(sRow3, 2);
        const isMoneyRow3 = typeof value === 'number' && ['Продажи','Нетто','Прибыль','Комиссия','Профит','Оплачено','Наличные','Сумма','Зарплата'].some(k => (label as string).startsWith(k));
        vc3.value = value;
        vc3.font = { name: 'Arial', size: 10, bold: true };
        vc3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sRow3 % 2 === 0 ? LIGHT_BLUE : WHITE } };
        vc3.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
        vc3.alignment = { horizontal: 'right' };
        if (isMoneyRow3) vc3.numFmt = '#,##0';
        mws3.getRow(sRow3).height = 20;
      }
      sRow3++;
    });
    mws3.getColumn(1).width = 30;
    mws3.getColumn(2).width = 20;

    const filename = dateFrom === dateTo ? `manager_${dateFrom}.xlsx` : `manager_${dateFrom}_${dateTo}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Manager export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

// HTML report by tour date
export const exportHtmlReport = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom: dfParam, dateTo: dtParam, managerId } = req.query;
    const user = req.user!;
    const dateFrom = dfParam ? String(dfParam) : null;
    const dateTo = dtParam ? String(dtParam) : dateFrom;

    const params: any[] = [dateFrom, dateTo || dateFrom];
    let managerFilter = '';
    const userRoles3 = user.roles || [user.role];
    if (userRoles3.includes('manager') && !userRoles3.includes('admin')) {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(user.id);
    } else if (managerId) {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(managerId);
    }

    const { rows: vouchers } = await pool.query(
      `SELECT
        v.voucher_number, v.tour_date, v.adults, v.children, v.infants,
        v.total_sale, v.total_net, v.paid_to_agency, v.payment_status,
        v.agent_commission_percentage,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        u.full_name as manager_name, u.commission_percentage as manager_commission_percentage,
        a.name as agent_name
      FROM vouchers v
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
        AND v.is_deleted = false ${managerFilter}
      ORDER BY v.tour_date, co.name`,
      params
    );

    const fmt = (d: any) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';
    const money2 = (n: any) => n != null ? Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0 }) + '' : '—';
    const STATUS: Record<string, string> = { paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен' };
    const STATUS_COLOR: Record<string, string> = { paid: '#4caf50', partial: '#ff9800', unpaid: '#f44336' };

    let totalSale = 0, totalProfit = 0, totalManagerPay = 0;
    const rows = vouchers.map((v, i) => {
      const profit = Number(v.total_sale || 0) - Number(v.total_net || 0);
      const agentPct = v.agent_name ? Number(v.agent_commission_percentage || 0) / 100 : 0;
      const profitAfterAgent = profit - profit * agentPct;
      const managerPay = profitAfterAgent * (Number(v.manager_commission_percentage || 0) / 100);
      totalSale += Number(v.total_sale || 0);
      totalProfit += profit;
      totalManagerPay += managerPay;
      const bg = i % 2 === 0 ? '#fff' : '#f0f4f8';
      const sc = STATUS_COLOR[v.payment_status] || '#999';
      return `<tr style="background:${bg}">
        <td>${v.voucher_number}</td>
        <td>${fmt(v.tour_date)}</td>
        <td>${v.company_name || '—'}</td>
        <td>${v.tour_name || '—'}</td>
        <td>${v.manager_name || '—'}</td>
        <td style="text-align:center">${Number(v.adults)+Number(v.children)}</td>
        <td style="text-align:right;font-weight:600">${money2(v.total_sale)}</td>
        <td style="text-align:right;color:#1b5e20;font-weight:600">${money2(profit)}</td>
        <td style="text-align:right;color:#0d47a1;font-weight:600">${money2(managerPay)}</td>
        <td><span style="background:${sc};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px">${STATUS[v.payment_status]||v.payment_status}</span></td>
      </tr>`;
    }).join('');

    const dateFormatted = dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`;
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Отчёт по выезду ${dateFormatted}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;margin:20px;color:#222}
  h2{color:#1e3a5f;margin-bottom:4px}
  .cards{display:flex;gap:16px;margin:16px 0;flex-wrap:wrap}
  .card{background:#f0f4f8;border-radius:8px;padding:12px 20px;min-width:140px}
  .card .label{font-size:11px;color:#666;margin-bottom:4px}
  .card .val{font-size:20px;font-weight:700;color:#1e3a5f}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#1e3a5f;color:#fff;padding:8px;text-align:left;font-size:12px}
  td{padding:7px 8px;border-bottom:1px solid #e0e0e0;font-size:12px}
  @media print{.noprint{display:none}}
</style>
</head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:16px;padding:8px 20px;background:#1e3a5f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">🖨 Печать / PDF</button>
<h2>Отчёт по дате выезда: ${dateFormatted}</h2>
<p style="color:#666;font-size:12px">Сформировано: ${new Date().toLocaleString('ru-RU')} | Ваучеров: ${vouchers.length}</p>
<div class="cards">
  <div class="card"><div class="label">Продажи</div><div class="val">${money2(totalSale)}</div></div>
  <div class="card"><div class="label">Профит</div><div class="val" style="color:#1b5e20">${money2(totalProfit)}</div></div>
  <div class="card"><div class="label">Зарплата</div><div class="val" style="color:#0d47a1">${money2(totalManagerPay)}</div></div>
</div>
<table>
<thead><tr>
  <th>Ваучер</th><th>Дата выезда</th><th>Компания</th><th>Тур</th><th>Менеджер</th>
  <th>Пакс</th><th>Sale</th><th>Профит</th><th>Зарплата</th><th>Статус</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('HTML report error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

// ═══════════════════════════════════════════════════════════
// FULL REPORT — all data from the reports page in one Excel
// ═══════════════════════════════════════════════════════════
export const exportFullReport = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom: dfParam, dateTo: dtParam, managerId, dateType = 'sale' } = req.query;
    const user = req.user!;
    const dateFrom = dfParam ? String(dfParam) : null;
    const dateTo   = dtParam ? String(dtParam) : dateFrom;
    if (!dateFrom) return res.status(400).json({ error: 'dateFrom required' });

    const dateField = dateType === 'tour' ? 'v.tour_date::date' : 'v.created_at::date';

    const params: any[] = [];
    let p = 1;
    let dateFilter  = '';
    let mgrFilter   = '';

    dateFilter += ` AND ${dateField} >= $${p++}`; params.push(dateFrom);
    dateFilter += ` AND ${dateField} <= $${p++}`; params.push(dateTo || dateFrom);

    const userRoles = (user as any).roles || [user.role];
    if (userRoles.includes('manager') && !userRoles.includes('admin')) {
      mgrFilter = ` AND v.manager_id = $${p++}`; params.push(user.id);
    } else if (managerId) {
      mgrFilter = ` AND v.manager_id = $${p++}`; params.push(managerId);
    }

    const base = `FROM vouchers v
      LEFT JOIN clients cl ON v.client_id = cl.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE v.is_deleted = false${dateFilter}${mgrFilter}`;

    // ── Run all queries in parallel ──
    const [detailRes, paymentsRes, byMgrRes, byCoRes, byTourRes, byDayRes] = await Promise.all([
      // Detail
      pool.query(`SELECT
        v.id, v.voucher_number, v.created_at, v.tour_date, v.tour_time,
        v.adults, v.children, v.infants,
        v.total_sale, v.total_net, v.paid_to_agency, v.cash_on_tour,
        v.payment_status, v.hotel_name, v.room_number, v.remarks,
        v.is_important, v.agent_commission_percentage,
        cl.name as client_name, cl.phone as client_phone,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        u.full_name as manager_name, u.commission_percentage as mgr_pct,
        a.name as agent_name,
        (SELECT MAX(p2.payment_date) FROM payments p2 WHERE p2.voucher_id = v.id) as last_pay_date,
        (SELECT string_agg(DISTINCT p2.payment_method, ', ' ORDER BY p2.payment_method)
          FROM payments p2 WHERE p2.voucher_id = v.id) as pay_methods
        ${base} ORDER BY v.created_at DESC`, params),

      // Payments
      pool.query(`SELECT p.payment_date, p.amount, v.currency, p.payment_method, p.notes,
        v.voucher_number, v.tour_date,
        cl.name as client_name, cl.phone as client_phone,
        co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name, u.full_name as manager_name
        FROM payments p JOIN vouchers v ON p.voucher_id = v.id
        LEFT JOIN clients cl ON v.client_id = cl.id
        LEFT JOIN companies co ON v.company_id = co.id
        LEFT JOIN tours t ON v.tour_id = t.id
        LEFT JOIN users u ON v.manager_id = u.id
        WHERE v.is_deleted = false${mgrFilter}
          AND p.payment_date::date >= $1 AND p.payment_date::date <= $2
        ORDER BY p.payment_date DESC`, params.slice(0, params.length)),

      // By manager
      pool.query(`SELECT u.full_name as manager_name, COALESCE(t.name, v.tour_details) as tour_name,
        COUNT(v.id) as voucher_count,
        string_agg(v.voucher_number, ', ' ORDER BY v.voucher_number) as voucher_numbers,
        SUM(v.total_sale) as total_sale, SUM(v.total_net) as total_net,
        SUM(v.total_sale - v.total_net) as profit,
        SUM((v.total_sale-v.total_net)*(1-CASE WHEN v.agent_id IS NOT NULL THEN COALESCE(v.agent_commission_percentage,0)/100.0 ELSE 0 END)) as profit_after_agent,
        SUM((v.total_sale-v.total_net)*(1-CASE WHEN v.agent_id IS NOT NULL THEN COALESCE(v.agent_commission_percentage,0)/100.0 ELSE 0 END)*COALESCE(u.commission_percentage,0)/100.0) as manager_pay,
        SUM(v.paid_to_agency) as total_paid,
        COUNT(CASE WHEN v.payment_status='paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN v.payment_status='partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN v.payment_status='unpaid' THEN 1 END) as unpaid_count
        ${base} GROUP BY u.id, u.full_name, t.id, t.name ORDER BY u.full_name, total_sale DESC NULLS LAST`, params),

      // By company
      pool.query(`SELECT co.name as company_name, COALESCE(t.name, v.tour_details) as tour_name,
        COUNT(v.id) as voucher_count,
        string_agg(v.voucher_number, ', ' ORDER BY v.voucher_number) as voucher_numbers,
        SUM(v.total_sale) as total_sale, SUM(v.total_net) as total_net,
        SUM(v.total_sale - v.total_net) as profit,
        SUM(v.adults + v.children) as total_pax
        ${base} GROUP BY co.id, co.name, t.id, t.name ORDER BY co.name, total_sale DESC NULLS LAST`, params),

      // By tour
      pool.query(`SELECT t.name as tour_name, t.tour_type,
        COUNT(v.id) as voucher_count,
        string_agg(v.voucher_number, ', ' ORDER BY v.voucher_number) as voucher_numbers,
        SUM(v.adults + v.children) as total_pax,
        SUM(v.total_sale) as total_sale, SUM(v.total_net) as total_net,
        SUM(v.total_sale - v.total_net) as profit
        ${base} GROUP BY t.id, t.name, t.tour_type ORDER BY total_sale DESC NULLS LAST`, params),

      // By day
      pool.query(`SELECT ${dateField} as date,
        COUNT(v.id) as voucher_count,
        string_agg(v.voucher_number, ', ' ORDER BY v.voucher_number) as voucher_numbers,
        SUM(v.adults + v.children) as total_pax,
        SUM(v.total_sale) as total_sale, SUM(v.total_net) as total_net,
        SUM(v.total_sale - v.total_net) as profit
        ${base} GROUP BY ${dateField} ORDER BY date DESC`, params),
    ]);

    const detail   = detailRes.rows;
    const payments = paymentsRes.rows;
    const byMgr    = byMgrRes.rows;
    const byCo     = byCoRes.rows;
    const byTour   = byTourRes.rows;
    const byDay    = byDayRes.rows;

    const dateFormatted = dateFrom === (dateTo || dateFrom)
      ? new Date(dateFrom).toLocaleDateString('ru-RU')
      : `${new Date(dateFrom).toLocaleDateString('ru-RU')} – ${new Date(dateTo!).toLocaleDateString('ru-RU')}`;

    const STATUS_RU: Record<string, string> = { paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен' };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tour Tour Phuket CRM';
    wb.created = new Date();

    const titleStyle = (ws: ExcelJS.Worksheet, cols: number, text: string) => {
      const letter = ws.getColumn(cols).letter;
      ws.mergeCells(`A1:${letter}1`);
      const c = ws.getCell('A1');
      c.value = text;
      c.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 26;
      ws.mergeCells(`A2:${letter}2`);
      const s = ws.getCell('A2');
      s.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} · Тип даты: ${dateType === 'tour' ? 'по выезду' : 'по продаже'}`;
      s.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
      s.alignment = { horizontal: 'center' };
      ws.getRow(2).height = 14;
      ws.getRow(3).height = 4;
    };

    // ── SHEET 1: ДЕТАЛЬНО ──────────────────────────────────
    const wsD = wb.addWorksheet('Детально');
    wsD.views = [{ state: 'frozen', ySplit: 4 }];
    titleStyle(wsD, 21, `ДЕТАЛЬНО — ${dateFormatted}`);

    const dHdrs = ['Ваучер', 'Дата продажи', 'Дата выезда', 'Время', 'Компания', 'Тур',
      'Клиент', 'Телефон', 'Отель', 'Комната',
      'Взр', 'Дет', 'Мл',
      'Оплачено', 'Наличные', 'Sale', 'Net', 'Профит',
      'Агент', 'Ком.агента', 'Зарплата', 'Статус', 'Менеджер'];
    dHdrs.forEach((h, i) => hdr(wsD, 4, i + 1, h));
    wsD.getRow(4).height = 36;

    detail.forEach((v, i) => {
      const r = 5 + i;
      const bg = v.is_important ? YELLOW : (i % 2 === 0 ? WHITE : LIGHT_BLUE);
      const stBg = v.payment_status === 'paid' ? LIGHT_GREEN : v.payment_status === 'unpaid' ? LIGHT_RED : YELLOW;
      const profit = Number(v.total_sale || 0) - Number(v.total_net || 0);
      const agPct  = v.agent_name ? Number(v.agent_commission_percentage || 0) / 100 : 0;
      const agComm = Math.round(profit * agPct);
      const paa    = Math.round(profit - agComm);
      const mgrPay = Math.round(paa * Number(v.mgr_pct || 0) / 100);

      cell(wsD, r, 1, v.voucher_number, bg, true);
      cell(wsD, r, 2, fmt(v.created_at), bg);
      cell(wsD, r, 3, fmt(v.tour_date), bg);
      cell(wsD, r, 4, v.tour_time || '—', bg);
      cell(wsD, r, 5, v.company_name || '—', bg);
      cell(wsD, r, 6, v.tour_name || '—', bg);
      cell(wsD, r, 7, v.client_name || '—', bg);
      cell(wsD, r, 8, v.client_phone || '—', bg);
      cell(wsD, r, 9, v.hotel_name || '—', bg);
      cell(wsD, r, 10, v.room_number || '—', bg);
      const mkC = (col: number, val: number) => {
        const c = wsD.getCell(r, col); c.value = val;
        c.font = { name: 'Arial', size: 10 }; c.alignment = { horizontal: 'center' };
        if (bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      };
      mkC(11, Number(v.adults)); mkC(12, Number(v.children)); mkC(13, Number(v.infants));
      money(wsD, r, 14, v.paid_to_agency, bg);
      money(wsD, r, 15, v.cash_on_tour, bg);
      money(wsD, r, 16, v.total_sale, bg, true);
      money(wsD, r, 17, v.total_net, bg);
      money(wsD, r, 18, profit, profit < 0 ? LIGHT_RED : bg, true);
      cell(wsD, r, 19, v.agent_name ? `${v.agent_name} (${v.agent_commission_percentage}%)` : '—', bg);
      money(wsD, r, 20, agComm, bg);
      money(wsD, r, 21, mgrPay, LIGHT_GREEN, true);
      const sc = wsD.getCell(r, 22);
      const stLabel = STATUS_RU[v.payment_status] || v.payment_status;
      sc.value = v.last_pay_date ? `${stLabel} (${fmt(v.last_pay_date)})` : stLabel;
      sc.font = { name: 'Arial', size: 10, bold: true };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stBg } };
      sc.alignment = { horizontal: 'center', wrapText: true };
      sc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      cell(wsD, r, 23, v.manager_name || '—', bg);
    });
    const dTR = 5 + detail.length;
    wsD.mergeCells(dTR, 1, dTR, 10);
    const dTc = wsD.getCell(dTR, 1);
    dTc.value = `ИТОГО: ${detail.length} ваучеров`;
    dTc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    dTc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    dTc.alignment = { horizontal: 'right' };
    [11,12,13,14,15,16,17,18,19,20,21].forEach(col => {
      const c = wsD.getCell(dTR, col);
      c.value = { formula: `SUM(${wsD.getColumn(col).letter}5:${wsD.getColumn(col).letter}${dTR-1})` };
      c.numFmt = col <= 13 ? '0' : '#,##0';
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: col <= 13 ? 'center' : 'right' };
    });
    [22, 23].forEach(col => wsD.getCell(dTR, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } });
    wsD.getRow(dTR).height = 22;
    [12, 12, 12, 7, 20, 22, 16, 14, 16, 8, 4, 4, 4, 12, 12, 12, 12, 12, 18, 12, 12, 18, 16].forEach((w, i) => { wsD.getColumn(i + 1).width = w; });

    // ── SHEET 2: ПЛАТЕЖИ ──────────────────────────────────
    const wsP = wb.addWorksheet('Платежи');
    wsP.views = [{ state: 'frozen', ySplit: 4 }];
    titleStyle(wsP, 8, `ПЛАТЕЖИ — ${dateFormatted}`);
    ['Дата платежа', 'Ваучер №', 'Дата тура', 'Компания', 'Тур', 'Менеджер', 'Сумма', 'Метод / Примечание']
      .forEach((h, i) => hdr(wsP, 4, i + 1, h));
    wsP.getRow(4).height = 32;
    payments.forEach((p, i) => {
      const r = 5 + i; const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
      cell(wsP, r, 1, fmt(p.payment_date), bg);
      cell(wsP, r, 2, p.voucher_number, bg, true);
      cell(wsP, r, 3, fmt(p.tour_date), bg);
      cell(wsP, r, 4, p.company_name, bg);
      cell(wsP, r, 5, p.tour_name, bg);
      cell(wsP, r, 6, p.manager_name, bg);
      money(wsP, r, 7, p.amount, bg, true);
      cell(wsP, r, 8, [p.payment_method, p.currency !== 'THB' ? p.currency : '', p.notes].filter(Boolean).join(' · '), bg);
    });
    const pTR = 5 + payments.length;
    wsP.mergeCells(pTR, 1, pTR, 6);
    const pTc = wsP.getCell(pTR, 1);
    pTc.value = `ИТОГО: ${payments.length} платежей`;
    pTc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    pTc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    pTc.alignment = { horizontal: 'right' };
    if (payments.length > 0) {
      const pc = wsP.getCell(pTR, 7);
      pc.value = { formula: `SUM(G5:G${pTR - 1})` };
      pc.numFmt = '#,##0';
      pc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      pc.alignment = { horizontal: 'right' };
      wsP.getCell(pTR, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    }
    wsP.getRow(pTR).height = 22;
    [14, 12, 12, 20, 26, 18, 14, 28].forEach((w, i) => { wsP.getColumn(i + 1).width = w; });

    // ── Helper: build a grouped summary sheet ──
    const buildGroupSheet = (
      name: string,
      groupRows: any[],
      headers: string[],
      rowFn: (ws: ExcelJS.Worksheet, r: number, row: any, bg: string) => void,
      colWidths: number[],
      moneyColsForTotal: number[],
    ) => {
      const ws = wb.addWorksheet(name);
      ws.views = [{ state: 'frozen', ySplit: 4 }];
      titleStyle(ws, headers.length, `${name.toUpperCase()} — ${dateFormatted}`);
      headers.forEach((h, i) => hdr(ws, 4, i + 1, h));
      ws.getRow(4).height = 32;
      groupRows.forEach((row, i) => {
        const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
        rowFn(ws, 5 + i, row, bg);
      });
      const gTR = 5 + groupRows.length;
      ws.mergeCells(gTR, 1, gTR, Math.min(3, headers.length));
      const gTc = ws.getCell(gTR, 1);
      gTc.value = `ИТОГО: ${groupRows.length} строк`;
      gTc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      gTc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      gTc.alignment = { horizontal: 'right' };
      moneyColsForTotal.forEach(col => {
        const c = ws.getCell(gTR, col);
        c.value = { formula: `SUM(${ws.getColumn(col).letter}5:${ws.getColumn(col).letter}${gTR - 1})` };
        c.numFmt = '#,##0';
        c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
        c.alignment = { horizontal: 'right' };
      });
      for (let col = Math.min(3, headers.length) + 1; col <= headers.length; col++) {
        if (!moneyColsForTotal.includes(col)) ws.getCell(gTR, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      }
      ws.getRow(gTR).height = 22;
      colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    };

    // ── SHEET 3: ПО МЕНЕДЖЕРАМ ──
    buildGroupSheet('По менеджерам',
      byMgr,
      ['Менеджер', 'Тур', 'Ваучеров', 'Ваучеры №', 'Sale', 'Net', 'Профит', 'Профит−Аг', 'Зарплата', 'Оплачено', '✓', '~', '✗'],
      (ws, r, row, bg) => {
        cell(ws, r, 1, row.manager_name || '—', bg, true);
        cell(ws, r, 2, row.tour_name || '—', bg);
        const cn = ws.getCell(r, 3); cn.value = Number(row.voucher_count); cn.font = { name: 'Arial', size: 10 }; cn.alignment = { horizontal: 'center' }; if (bg) cn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; cn.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        cell(ws, r, 4, row.voucher_numbers || '—', bg);
        money(ws, r, 5, row.total_sale, bg, true);
        money(ws, r, 6, row.total_net, bg);
        money(ws, r, 7, row.profit, Number(row.profit) < 0 ? LIGHT_RED : bg, true);
        money(ws, r, 8, row.profit_after_agent, bg);
        money(ws, r, 9, row.manager_pay, LIGHT_GREEN, true);
        money(ws, r, 10, row.total_paid, bg);
        [11,12,13].forEach((col, j) => { const c = ws.getCell(r, col); c.value = Number([row.paid_count, row.partial_count, row.unpaid_count][j]); c.font = { name: 'Arial', size: 10 }; c.alignment = { horizontal: 'center' }; if (bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }; });
      },
      [22, 26, 8, 40, 13, 13, 13, 13, 13, 13, 5, 5, 5],
      [5, 6, 7, 8, 9, 10],
    );

    // ── SHEET 4: ПО КОМПАНИЯМ И ТУРАМ (combined) ──
    {
      const wsC = wb.addWorksheet('По компаниям и турам');
      wsC.views = [{ state: 'frozen', ySplit: 4 }];
      titleStyle(wsC, 8, `ПО КОМПАНИЯМ И ТУРАМ — ${dateFormatted}`);
      ['Группа', 'Название', 'Тур / Тип', 'Ваучеров', 'Пакс', 'Sale', 'Net', 'Профит']
        .forEach((h, i) => hdr(wsC, 4, i + 1, h));
      wsC.getRow(4).height = 32;

      let rowIdx = 5;

      // Section header: По компаниям
      const coSecR = wsC.getRow(rowIdx);
      wsC.mergeCells(rowIdx, 1, rowIdx, 8);
      const coSecC = wsC.getCell(rowIdx, 1);
      coSecC.value = `ПО КОМПАНИЯМ (${byCo.length} строк)`;
      coSecC.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      coSecC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5B8A' } };
      coSecC.alignment = { horizontal: 'left', indent: 1 };
      coSecR.height = 20;
      rowIdx++;

      byCo.forEach((row, i) => {
        const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
        cell(wsC, rowIdx, 1, 'Компания', bg);
        cell(wsC, rowIdx, 2, row.company_name || '—', bg, true);
        cell(wsC, rowIdx, 3, row.tour_name || '—', bg);
        const cn = wsC.getCell(rowIdx, 4); cn.value = Number(row.voucher_count); cn.font = { name: 'Arial', size: 10 }; cn.alignment = { horizontal: 'center' }; if (bg) cn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; cn.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        const pc = wsC.getCell(rowIdx, 5); pc.value = Number(row.total_pax); pc.font = { name: 'Arial', size: 10 }; pc.alignment = { horizontal: 'center' }; if (bg) pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; pc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        money(wsC, rowIdx, 6, row.total_sale, bg, true);
        money(wsC, rowIdx, 7, row.total_net, bg);
        money(wsC, rowIdx, 8, row.profit, Number(row.profit) < 0 ? LIGHT_RED : bg, true);
        rowIdx++;
      });

      // Gap row
      rowIdx++;

      // Section header: По турам
      const tourSecR = wsC.getRow(rowIdx);
      wsC.mergeCells(rowIdx, 1, rowIdx, 8);
      const tourSecC = wsC.getCell(rowIdx, 1);
      tourSecC.value = `ПО ТУРАМ (${byTour.length} строк)`;
      tourSecC.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      tourSecC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5B8A' } };
      tourSecC.alignment = { horizontal: 'left', indent: 1 };
      tourSecR.height = 20;
      rowIdx++;

      byTour.forEach((row, i) => {
        const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
        cell(wsC, rowIdx, 1, 'Тур', bg);
        cell(wsC, rowIdx, 2, row.tour_name || '—', bg, true);
        cell(wsC, rowIdx, 3, row.tour_type || '—', bg);
        const cn = wsC.getCell(rowIdx, 4); cn.value = Number(row.voucher_count); cn.font = { name: 'Arial', size: 10 }; cn.alignment = { horizontal: 'center' }; if (bg) cn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; cn.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        const pc = wsC.getCell(rowIdx, 5); pc.value = Number(row.total_pax); pc.font = { name: 'Arial', size: 10 }; pc.alignment = { horizontal: 'center' }; if (bg) pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; pc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        money(wsC, rowIdx, 6, row.total_sale, bg, true);
        money(wsC, rowIdx, 7, row.total_net, bg);
        money(wsC, rowIdx, 8, row.profit, Number(row.profit) < 0 ? LIGHT_RED : bg, true);
        rowIdx++;
      });

      [12, 26, 18, 8, 7, 13, 13, 13].forEach((w, i) => { wsC.getColumn(i + 1).width = w; });
    }

    // ── SHEET 5: ПО ДНЯМ ──
    buildGroupSheet('По дням',
      byDay,
      ['Дата', 'Ваучеров', 'Ваучеры №', 'Пакс', 'Sale', 'Net', 'Профит'],
      (ws, r, row, bg) => {
        cell(ws, r, 1, fmt(row.date), bg, true);
        const cn = ws.getCell(r, 2); cn.value = Number(row.voucher_count); cn.font = { name: 'Arial', size: 10 }; cn.alignment = { horizontal: 'center' }; if (bg) cn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; cn.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        cell(ws, r, 3, row.voucher_numbers || '—', bg);
        const pc = ws.getCell(r, 4); pc.value = Number(row.total_pax); pc.font = { name: 'Arial', size: 10 }; pc.alignment = { horizontal: 'center' }; if (bg) pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; pc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        money(ws, r, 5, row.total_sale, bg, true);
        money(ws, r, 6, row.total_net, bg);
        money(ws, r, 7, row.profit, Number(row.profit) < 0 ? LIGHT_RED : bg, true);
      },
      [14, 8, 50, 7, 13, 13, 13],
      [5, 6, 7],
    );

    // ── STREAM ──
    const filename = `report_${dateFrom}_${dateTo || dateFrom}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Full report export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

// ── ACCOUNTING EXPORT ─────────────────────────────────────────────────────────
export const exportAccountingReport = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom: dfParam, dateTo: dtParam, managerId, dateType = 'sale', currency: curParam } = req.query;
    const user = req.user!;
    const dateFrom = dfParam ? String(dfParam) : null;
    const dateTo   = dtParam ? String(dtParam) : dateFrom;
    if (!dateFrom) return res.status(400).json({ error: 'dateFrom required' });
    // If currency is specified — export only that currency; otherwise export all three
    const filterCurrency = curParam ? String(curParam).toUpperCase() : null;

    const dateField = dateType === 'tour' ? 'v.tour_date::date' : 'v.created_at::date';

    const params: any[] = [];
    let p = 1;
    let dateFilter = '';
    let mgrFilter  = '';

    dateFilter += ` AND ${dateField} >= $${p++}`; params.push(dateFrom);
    dateFilter += ` AND ${dateField} <= $${p++}`; params.push(dateTo || dateFrom);

    const userRoles = (user as any).roles || [user.role];
    if (userRoles.includes('manager') && !userRoles.includes('admin')) {
      mgrFilter = ` AND v.manager_id = $${p++}`; params.push(user.id);
    } else if (managerId) {
      mgrFilter = ` AND v.manager_id = $${p++}`; params.push(managerId);
    }

    const [detailRes, cashflowRes, operatorsRes, employeesRes, agentsRes] = await Promise.all([
      // Бух. отчёт
      pool.query(`
        SELECT
          v.id, v.voucher_number, v.created_at, v.tour_date,
          v.adults, v.children, v.infants,
          v.total_sale, v.total_net, v.paid_to_agency, v.cash_on_tour,
          v.payment_status, v.agent_commission_percentage,
          v.agent_manager_confirmed, v.agent_accountant_confirmed,
          co.name AS company_name, COALESCE(t.name, v.tour_details) AS tour_name,
          u.full_name AS manager_name, u.commission_percentage AS mgr_pct,
          a.name AS agent_name,
          (v.total_sale - v.total_net) AS profit,
          ROUND((v.total_sale - v.total_net) * COALESCE(v.agent_commission_percentage, 0) / 100.0) AS agent_commission,
          ROUND((v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)) AS profit_after_agent,
          ROUND((v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0) * COALESCE(u.commission_percentage, 0) / 100.0) AS manager_pay,
          (SELECT MAX(p2.payment_date) FROM payments p2 WHERE p2.voucher_id = v.id) AS last_pay_date
        FROM vouchers v
        LEFT JOIN companies co ON v.company_id = co.id
        LEFT JOIN tours t ON v.tour_id = t.id
        LEFT JOIN users u ON v.manager_id = u.id
        LEFT JOIN agents a ON v.agent_id = a.id
        WHERE v.is_deleted = false${dateFilter}${mgrFilter}${filterCurrency ? ` AND COALESCE(v.currency, 'THB') = '${filterCurrency}'` : ''}
        ORDER BY v.created_at ASC
      `, params),

      // Движение средств (без списаний, с валютой)
      pool.query(`
        SELECT ae.id, ae.entry_date, ae.entry_type, ae.category, ae.amount,
          ae.payment_method, ae.counterparty_name, ae.notes, ae.invoice_number, ae.source,
          COALESCE(ae.currency, 'THB') AS currency,
          c.name AS company_name,
          v.voucher_number AS linked_voucher_number
        FROM accounting_entries ae
        LEFT JOIN companies c ON ae.company_id = c.id
        LEFT JOIN payments p ON ae.payment_id = p.id
        LEFT JOIN vouchers v ON p.voucher_id = v.id
        WHERE ae.entry_date >= $1 AND ae.entry_date <= $2
          AND ae.category NOT IN ('Списание долга', 'Списание долга агенту')
          ${filterCurrency ? `AND COALESCE(ae.currency, 'THB') = '${filterCurrency}'` : ''}
        ORDER BY ae.currency, ae.entry_date ASC, ae.created_at ASC
      `, [dateFrom, dateTo || dateFrom]),

      // Туроператоры — сгруппированы по валюте (total_sent без списаний)
      pool.query(`
        WITH sent_by_cur AS (
          SELECT company_id, COALESCE(currency, 'THB') AS currency, SUM(amount) AS total_sent
          FROM accounting_entries
          WHERE entry_type = 'expense'
            AND category NOT IN ('Списание долга')
          GROUP BY company_id, COALESCE(currency, 'THB')
        )
        SELECT c.id AS company_id, c.name AS company_name,
          COALESCE(v.currency, 'THB') AS currency,
          COALESCE(SUM(CASE
            WHEN v.is_deleted = false
              AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
            THEN v.total_net END), 0) AS total_owed_to_operator,
          COALESCE(s.total_sent, 0) AS total_sent_to_operator,
          COUNT(DISTINCT CASE
            WHEN v.is_deleted = false
              AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
            THEN v.id END) AS voucher_count,
          COALESCE(json_agg(DISTINCT jsonb_build_object(
            'voucher_number', v.voucher_number,
            'tour_date', v.tour_date,
            'total_net', v.total_net,
            'payment_status', v.payment_status
          )) FILTER (WHERE v.id IS NOT NULL AND v.is_deleted = false
            AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
          ), '[]') AS vouchers
        FROM companies c
        LEFT JOIN vouchers v ON v.company_id = c.id
        LEFT JOIN sent_by_cur s ON s.company_id = c.id
          AND s.currency = COALESCE(v.currency, 'THB')
        WHERE c.is_active = true
          ${filterCurrency ? `AND COALESCE(v.currency, 'THB') = '${filterCurrency}'` : ''}
        GROUP BY c.id, c.name, COALESCE(v.currency, 'THB'), s.total_sent
        HAVING COUNT(DISTINCT CASE WHEN v.is_deleted = false AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date THEN v.id END) > 0
        ORDER BY COALESCE(v.currency, 'THB'), c.name
      `, [dateFrom, dateTo || dateFrom]),

      // Сотрудники
      pool.query(`
        SELECT u.id, u.full_name, u.role, u.commission_percentage,
          COALESCE(SUM(ep.amount), 0) AS total_paid,
          COALESCE(json_agg(json_build_object(
            'payment_date', ep.payment_date,
            'amount', ep.amount,
            'payment_type', ep.payment_type,
            'payment_method', ep.payment_method,
            'notes', ep.notes
          ) ORDER BY ep.payment_date) FILTER (WHERE ep.id IS NOT NULL), '[]') AS payments,
          COALESCE((
            SELECT ROUND(SUM(
              CASE WHEN v.agent_id IS NOT NULL
                THEN (v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)
                ELSE (v.total_sale - v.total_net) END
            ) * COALESCE(u.commission_percentage, 0) / 100.0)
            FROM vouchers v
            WHERE v.manager_id = u.id AND v.is_deleted = false
              AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
          ), 0) AS calculated_salary
        FROM users u
        LEFT JOIN employee_payments ep ON ep.user_id = u.id
          AND ep.payment_date >= $1::date AND ep.payment_date <= $2::date
        WHERE u.is_active = true
        GROUP BY u.id, u.full_name, u.role, u.commission_percentage
        ORDER BY u.full_name
      `, [dateFrom, dateTo || dateFrom]),

      // Агенты — сгруппированы по валюте (без списаний)
      pool.query(`
        WITH agent_paid_by_cur AS (
          SELECT agent_id, COALESCE(currency, 'THB') AS currency, SUM(amount) AS total_paid
          FROM accounting_entries
          WHERE entry_type = 'expense'
            AND agent_id IS NOT NULL
            AND category NOT IN ('Списание долга агенту')
          GROUP BY agent_id, COALESCE(currency, 'THB')
        )
        SELECT a.name AS agent_name,
          COALESCE(v.currency, 'THB') AS currency,
          COALESCE(SUM(
            CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0
              AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
            THEN ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0)
            ELSE 0 END
          ), 0) AS commission_period,
          COALESCE(SUM(
            CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0
            THEN ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0)
            ELSE 0 END
          ), 0) AS commission_total,
          COALESCE(ap.total_paid, 0) AS total_paid
        FROM agents a
        LEFT JOIN vouchers v ON v.agent_id = a.id
        LEFT JOIN agent_paid_by_cur ap ON ap.agent_id = a.id
          AND ap.currency = COALESCE(v.currency, 'THB')
        WHERE a.is_active = true
          ${filterCurrency ? `AND COALESCE(v.currency, 'THB') = '${filterCurrency}'` : ''}
        GROUP BY a.id, a.name, COALESCE(v.currency, 'THB'), ap.total_paid
        HAVING SUM(CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0 THEN 1 ELSE 0 END) > 0
        ORDER BY COALESCE(v.currency, 'THB'), a.name
      `, [dateFrom, dateTo || dateFrom]),
    ]);

    const rows      = detailRes.rows;
    const cashflow  = cashflowRes.rows;
    const operators = operatorsRes.rows.map(r => ({
      ...r,
      balance: parseFloat(r.total_sent_to_operator) - parseFloat(r.total_owed_to_operator),
    }));
    const employees = employeesRes.rows;
    const agents    = agentsRes.rows;

    const dateFormatted = dateFrom === (dateTo || dateFrom)
      ? new Date(dateFrom).toLocaleDateString('ru-RU')
      : `${new Date(dateFrom).toLocaleDateString('ru-RU')} – ${new Date(dateTo!).toLocaleDateString('ru-RU')}`;

    const STATUS_RU: Record<string, string> = { paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен' };
    const ROW_BG: Record<string, string> = {
      paid:    'FFE8F5E9',
      partial: 'FFFFF9C4',
      unpaid:  'FFFFEBEE',
    };
    const PAID_CELL_BG = ['FFFFCDD2', 'FFFFF9C4', 'FFC8E6C9'];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tour Tour Phuket CRM';
    wb.created = new Date();

    const ws = wb.addWorksheet('Бух. отчёт');
    ws.views = [{ state: 'frozen', ySplit: 4 }];

    const colLetter = ws.getColumn(20).letter;
    ws.mergeCells(`A1:${colLetter}1`);
    const titleCell = ws.getCell('A1');
    titleCell.value = `БУХ. ОТЧЁТ — ${dateFormatted}`;
    titleCell.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;
    ws.mergeCells(`A2:${ws.getColumn(20).letter}2`);
    const subCell = ws.getCell('A2');
    subCell.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} · Тип даты: ${dateType === 'tour' ? 'по выезду' : 'по продаже'}`;
    subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    subCell.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 14;
    ws.getRow(3).height = 4;

    const headers = [
      'Дата создания', 'Дата выезда', 'Ваучер №', 'Компания', 'Тур',
      'Взр', 'Дет', 'Мл',
      'Оплачено', 'Cash on tour', 'Sale', 'Нетто', 'Профит',
      'Агент%', 'Ком.агента', 'Профит-Аг', 'Зарплата',
      'Мен.', 'Бух.', 'Статус оплаты',
    ];
    headers.forEach((h, i) => hdr(ws, 4, i + 1, h));
    ws.getRow(4).height = 36;

    rows.forEach((v, i) => {
      const r = 5 + i;
      const rowBg = ROW_BG[v.payment_status] || WHITE;
      const confirmedCount = (v.agent_manager_confirmed ? 1 : 0) + (v.agent_accountant_confirmed ? 1 : 0);
      const paidCellBg = PAID_CELL_BG[confirmedCount];

      const mkNum = (col: number, val: number, bg: string) => {
        const c = ws.getCell(r, col);
        c.value = Number(val) || 0;
        c.font = { name: 'Arial', size: 10 };
        c.alignment = { horizontal: 'center' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      };

      cell(ws, r, 1, fmt(v.created_at), rowBg);
      cell(ws, r, 2, fmt(v.tour_date), rowBg);
      cell(ws, r, 3, v.voucher_number || '—', rowBg, true);
      cell(ws, r, 4, v.company_name || '—', rowBg);
      cell(ws, r, 5, v.tour_name || '—', rowBg);
      mkNum(6, Number(v.adults), rowBg);
      mkNum(7, Number(v.children), rowBg);
      mkNum(8, Number(v.infants), rowBg);
      money(ws, r, 9, v.paid_to_agency, paidCellBg, true);
      money(ws, r, 10, v.cash_on_tour, rowBg);
      money(ws, r, 11, v.total_sale, rowBg, true);
      money(ws, r, 12, v.total_net, rowBg);
      money(ws, r, 13, v.profit, Number(v.profit) < 0 ? LIGHT_RED : rowBg, true);
      cell(ws, r, 14, v.agent_name ? `${v.agent_name} (${v.agent_commission_percentage}%)` : '—', rowBg);
      money(ws, r, 15, v.agent_commission, rowBg);
      money(ws, r, 16, v.profit_after_agent, rowBg);
      money(ws, r, 17, v.manager_pay, rowBg, true);

      // Мен. / Бух. — отдельные цветные ячейки
      const mkConfCell = (col: number, confirmed: boolean) => {
        const c = ws.getCell(r, col);
        c.value = confirmed ? '+' : '−';
        c.font = { name: 'Arial', size: 11, bold: true, color: { argb: confirmed ? 'FF1B5E20' : 'FFB71C1C' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confirmed ? 'FFC8E6C9' : 'FFFFCDD2' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      };
      mkConfCell(18, !!v.agent_manager_confirmed);
      mkConfCell(19, !!v.agent_accountant_confirmed);

      const stLabel = STATUS_RU[v.payment_status] || v.payment_status;
      const stText = v.last_pay_date ? `${stLabel}\n${fmt(v.last_pay_date)}` : stLabel;
      const stBgMap: Record<string, string> = { paid: 'FFE8F5E9', partial: 'FFFFF9C4', unpaid: 'FFFFCDD2' };
      const stc = ws.getCell(r, 20);
      stc.value = stText;
      stc.font = { name: 'Arial', size: 9, bold: true };
      stc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stBgMap[v.payment_status] || WHITE } };
      stc.alignment = { horizontal: 'center', wrapText: true };
      stc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
    });

    const tR = 5 + rows.length;
    ws.mergeCells(tR, 1, tR, 5);
    const tTc = ws.getCell(tR, 1);
    tTc.value = `ИТОГО: ${rows.length} ваучеров`;
    tTc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    tTc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    tTc.alignment = { horizontal: 'right' };
    // SUM: Взр(6), Дет(7), Мл(8), Оплачено(9), Cash(10), Sale(11), Net(12), Профит(13), Ком.аг(15), Проф-Аг(16), Зп(17)
    [6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17].forEach(col => {
      const c = ws.getCell(tR, col);
      c.value = { formula: `SUM(${ws.getColumn(col).letter}5:${ws.getColumn(col).letter}${tR - 1})` };
      c.numFmt = col <= 8 ? '0' : '#,##0';
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: col <= 8 ? 'center' : 'right' };
    });
    [14, 18, 19, 20].forEach(col => {
      ws.getCell(tR, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    });
    ws.getRow(tR).height = 22;

    // col widths A–T: Дата соз, Дата выезда, Ваучер №, Компания, Тур, Взр, Дет, Мл, Оплачено, Cash, Sale, Net, Профит, Агент%, Ком.аг, Проф-Аг, Зп, Мен., Бух., Статус
    [12, 12, 10, 20, 24, 4, 4, 4, 11, 11, 12, 12, 12, 18, 11, 11, 11, 6, 6, 14]
      .forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    for (let i = 5; i < tR; i++) ws.getRow(i).height = 20;

    // ── SHEET 2: ДВИЖЕНИЕ СРЕДСТВ (по валютам, без списаний) ─
    {
      const wsCF = wb.addWorksheet('Движение средств');
      wsCF.views = [{ state: 'frozen', ySplit: 2 }];
      wsCF.mergeCells('A1:H1');
      const cfTitle = wsCF.getCell('A1');
      cfTitle.value = `ДВИЖЕНИЕ СРЕДСТВ — ${dateFormatted} (без списаний долга)`;
      cfTitle.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
      cfTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      wsCF.getRow(1).height = 26;

      const CF_CURRENCIES = ['THB', 'USD', 'VND'];
      const CF_SYM: Record<string, string> = { THB: '฿', USD: '$', VND: '₫' };
      const CF_BG: Record<string, string> = { THB: WHITE, USD: TEAL_USD, VND: ORANGE_VND };
      const CF_HDR: Record<string, string> = { THB: '1E6E4B', USD: '1A5276', VND: '7D6608' };

      let cfRow = 2;

      for (const cur of CF_CURRENCIES) {
        const entries = cashflow.filter((e: any) => (e.currency || 'THB') === cur);

        // Currency section header — always shown
        wsCF.mergeCells(cfRow, 1, cfRow, 8);
        const secCell = wsCF.getCell(cfRow, 1);
        secCell.value = `${cur}  ${CF_SYM[cur]}`;
        secCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${CF_HDR[cur]}` } };
        secCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsCF.getRow(cfRow).height = 22;
        cfRow++;

        // Column headers
        ['Дата', 'Тип', 'Категория', 'Контрагент / Примечание', 'Метод', 'Приход', 'Расход', 'Остаток']
          .forEach((h, i) => hdr(wsCF, cfRow, i + 1, h));
        wsCF.getRow(cfRow).height = 28;
        cfRow++;

        let runBal = 0;
        let totalIncome = 0, totalExpense = 0;

        if (entries.length === 0) {
          // Empty section placeholder
          wsCF.mergeCells(cfRow, 1, cfRow, 8);
          const emptyCell = wsCF.getCell(cfRow, 1);
          emptyCell.value = 'Нет записей за выбранный период';
          emptyCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF888888' } };
          emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
          emptyCell.alignment = { horizontal: 'center' };
          wsCF.getRow(cfRow).height = 18;
          cfRow++;
        } else {
          entries.forEach((e: any) => {
            const isIncome = e.entry_type === 'income';
            const amt = parseFloat(e.amount);
            runBal += isIncome ? amt : -amt;
            if (isIncome) totalIncome += amt; else totalExpense += amt;
            const bg = isIncome ? LIGHT_GREEN : LIGHT_RED;
            const counterparty = [
              e.counterparty_name || e.company_name,
              e.linked_voucher_number ? `#${e.linked_voucher_number}` : '',
              e.notes,
            ].filter(Boolean).join(' · ');
            cell(wsCF, cfRow, 1, fmt(e.entry_date), bg);
            cell(wsCF, cfRow, 2, isIncome ? 'Приход' : 'Расход', bg, true);
            cell(wsCF, cfRow, 3, e.category || '—', bg);
            cell(wsCF, cfRow, 4, counterparty || '—', bg);
            cell(wsCF, cfRow, 5, e.payment_method || '—', bg);
            money(wsCF, cfRow, 6, isIncome ? amt : 0, bg, isIncome);
            money(wsCF, cfRow, 7, !isIncome ? amt : 0, bg, !isIncome);
            money(wsCF, cfRow, 8, runBal, runBal < 0 ? LIGHT_RED : LIGHT_GREEN, true);
            wsCF.getRow(cfRow).height = 18;
            cfRow++;
          });
        }

        // Totals row — always shown
        wsCF.mergeCells(cfRow, 1, cfRow, 4);
        const totCell = wsCF.getCell(cfRow, 1);
        totCell.value = `ИТОГО ${cur}: ${entries.length} записей · Баланс: ${Math.round(totalIncome - totalExpense).toLocaleString('ru-RU')} ${CF_SYM[cur]}`;
        totCell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        totCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${CF_HDR[cur]}` } };
        totCell.alignment = { horizontal: 'right', indent: 1 };
        [5, 6, 7, 8].forEach(col => {
          const c = wsCF.getCell(cfRow, col);
          if (col === 6) c.value = totalIncome;
          else if (col === 7) c.value = totalExpense;
          else c.value = '';
          c.numFmt = '#,##0';
          c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${CF_HDR[cur]}` } };
          c.alignment = { horizontal: 'right' };
        });
        wsCF.getRow(cfRow).height = 22;
        cfRow += 2; // blank separator
      }

      [11, 12, 20, 42, 18, 14, 14, 14].forEach((w, i) => { wsCF.getColumn(i + 1).width = w; });
    }

    // ── SHEET 3: ТУРОПЕРАТОРЫ (секции по валюте) ──────────────
    {
      const wsOP = wb.addWorksheet('Туроператоры');
      wsOP.mergeCells('A1:E1');
      const opTitle = wsOP.getCell('A1');
      opTitle.value = `ТУРОПЕРАТОРЫ — ${dateFormatted}`;
      opTitle.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
      opTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      wsOP.getRow(1).height = 26;

      const STATUS_OP: Record<string, string> = { paid: 'Оплачен', partial: 'Частично', unpaid: 'Не опл.' };
      const OP_SYM: Record<string, string> = { THB: '฿', USD: '$', VND: '₫' };
      const OP_HDR: Record<string, string> = { THB: '1E6E4B', USD: '1A5276', VND: '7D6608' };
      let opRow = 2;

      for (const cur of ['THB', 'USD', 'VND']) {
        const curOps = operators.filter((op: any) => (op.currency || 'THB') === cur);

        // Currency section header — always shown
        wsOP.mergeCells(opRow, 1, opRow, 5);
        const secCell = wsOP.getCell(opRow, 1);
        secCell.value = `${cur}  ${OP_SYM[cur]}`;
        secCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${OP_HDR[cur]}` } };
        secCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsOP.getRow(opRow).height = 22;
        opRow++;

        // Column headers
        ['Компания', 'Ваучеров', 'Нетто (к оплате)', 'Отправлено', 'Баланс']
          .forEach((h, i) => hdr(wsOP, opRow, i + 1, h));
        wsOP.getRow(opRow).height = 28;
        opRow++;

        if (curOps.length === 0) {
          wsOP.mergeCells(opRow, 1, opRow, 5);
          const emptyOp = wsOP.getCell(opRow, 1);
          emptyOp.value = 'Нет данных за выбранный период';
          emptyOp.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF888888' } };
          emptyOp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
          emptyOp.alignment = { horizontal: 'center' };
          wsOP.getRow(opRow).height = 18;
          opRow++;
        } else {
          curOps.forEach((op: any) => {
            const balance = parseFloat(op.total_sent_to_operator) - parseFloat(op.total_owed_to_operator);
            const opBg = balance > 0 ? LIGHT_GREEN : balance < 0 ? LIGHT_RED : WHITE;

            cell(wsOP, opRow, 1, op.company_name, opBg, true);
            const cnC = wsOP.getCell(opRow, 2);
            cnC.value = Number(op.voucher_count);
            cnC.font = { name: 'Arial', size: 10, bold: true };
            cnC.alignment = { horizontal: 'center' };
            cnC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opBg } };
            cnC.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            money(wsOP, opRow, 3, op.total_owed_to_operator, opBg);
            money(wsOP, opRow, 4, op.total_sent_to_operator, opBg);
            money(wsOP, opRow, 5, balance, opBg, true);
            wsOP.getCell(opRow, 5).font = {
              name: 'Arial', size: 10, bold: true,
              color: { argb: balance >= 0 ? 'FF1B6B3A' : 'FF9B0000' },
            };
            wsOP.getRow(opRow).height = 20;
            opRow++;

            const voucherList = Array.isArray(op.vouchers) ? op.vouchers : [];
            if (voucherList.length > 0) {
              ['', 'Ваучер №', 'Дата тура', 'Нетто', 'Статус'].forEach((h, i) => {
                const c = wsOP.getCell(opRow, i + 1);
                c.value = h;
                c.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF555555' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
                c.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
              });
              wsOP.getRow(opRow).height = 14;
              opRow++;

              voucherList.forEach((v: any) => {
                const stBg = v.payment_status === 'paid' ? 'FFF0FFF0' : v.payment_status === 'partial' ? 'FFFFFDE7' : 'FFFFF3E0';
                wsOP.getCell(opRow, 1).value = '';
                cell(wsOP, opRow, 2, v.voucher_number || '—', stBg);
                cell(wsOP, opRow, 3, fmt(v.tour_date), stBg);
                money(wsOP, opRow, 4, v.total_net, stBg);
                cell(wsOP, opRow, 5, STATUS_OP[v.payment_status] || v.payment_status, stBg);
                wsOP.getRow(opRow).height = 16;
                opRow++;
              });
            }
          });
        }
        opRow++; // blank row between currencies
      }

      [30, 10, 18, 16, 16].forEach((w, i) => { wsOP.getColumn(i + 1).width = w; });
    }

    // ── SHEET 4: СОТРУДНИКИ ─────────────────────────────────
    {
      const wsEmp = wb.addWorksheet('Сотрудники');
      wsEmp.views = [{ state: 'frozen', ySplit: 4 }];
      const empLetter = wsEmp.getColumn(6).letter;
      wsEmp.mergeCells(`A1:${empLetter}1`);
      const empTitle = wsEmp.getCell('A1');
      empTitle.value = `СОТРУДНИКИ — ${dateFormatted}`;
      empTitle.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
      empTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      wsEmp.getRow(1).height = 26;
      wsEmp.mergeCells(`A2:${empLetter}2`);
      wsEmp.getCell('A2').value = `Сформировано: ${new Date().toLocaleString('ru-RU')}`;
      wsEmp.getCell('A2').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
      wsEmp.getCell('A2').alignment = { horizontal: 'center' };
      wsEmp.getRow(2).height = 14;
      wsEmp.getRow(3).height = 4;

      ['Сотрудник', 'Роль', 'Ставка %', 'Начислено', 'Выплачено', 'Остаток']
        .forEach((h, i) => hdr(wsEmp, 4, i + 1, h));
      wsEmp.getRow(4).height = 32;

      const PAY_TYPE: Record<string, string> = { salary: 'Зарплата', advance: 'Аванс', bonus: 'Бонус', expense: 'Расход' };
      let empRow = 5;

      employees.forEach(emp => {
        const calcSal = parseFloat(emp.calculated_salary || 0);
        const totalPaid = parseFloat(emp.total_paid || 0);
        const remaining = calcSal - totalPaid;
        const empBg = remaining <= 0 ? LIGHT_GREEN : LIGHT_BLUE;

        cell(wsEmp, empRow, 1, emp.full_name, empBg, true);
        cell(wsEmp, empRow, 2, emp.role, empBg);
        const pctC = wsEmp.getCell(empRow, 3);
        pctC.value = Number(emp.commission_percentage || 0);
        pctC.numFmt = '0"%"'; pctC.font = { name: 'Arial', size: 10, bold: true };
        pctC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: empBg } };
        pctC.alignment = { horizontal: 'center' };
        pctC.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        money(wsEmp, empRow, 4, calcSal, 'FFEDE7F6', true);
        money(wsEmp, empRow, 5, totalPaid, LIGHT_BLUE, true);
        money(wsEmp, empRow, 6, remaining, remaining <= 0 ? LIGHT_GREEN : LIGHT_RED, true);
        wsEmp.getRow(empRow).height = 20;
        empRow++;

        // Payment history
        const payments = Array.isArray(emp.payments) ? emp.payments : [];
        if (payments.length > 0) {
          ['', 'Дата', 'Тип', 'Метод', 'Сумма', 'Примечание'].forEach((h, i) => {
            const c = wsEmp.getCell(empRow, i + 1);
            c.value = h;
            c.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF555555' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            c.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
          });
          wsEmp.getRow(empRow).height = 14;
          empRow++;

          payments.forEach((p: any) => {
            wsEmp.getCell(empRow, 1).value = '';
            cell(wsEmp, empRow, 2, fmt(p.payment_date), WHITE);
            cell(wsEmp, empRow, 3, PAY_TYPE[p.payment_type] || p.payment_type, WHITE);
            cell(wsEmp, empRow, 4, p.payment_method || '—', WHITE);
            money(wsEmp, empRow, 5, p.amount, WHITE, true);
            cell(wsEmp, empRow, 6, p.notes || '', WHITE);
            wsEmp.getRow(empRow).height = 16;
            empRow++;
          });
        }
      });

      [28, 14, 10, 14, 14, 20].forEach((w, i) => { wsEmp.getColumn(i + 1).width = w; });
    }

    // ── SHEET 5: АГЕНТЫ (секции по валюте) ────────────────
    {
      const wsAg = wb.addWorksheet('Агенты');
      wsAg.mergeCells('A1:E1');
      const agTitle = wsAg.getCell('A1');
      agTitle.value = `АГЕНТЫ — ${dateFormatted}`;
      agTitle.font = { name: 'Arial', bold: true, size: 13, color: { argb: BLUE_HEADER } };
      agTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      wsAg.getRow(1).height = 26;

      const AG_SYM: Record<string, string> = { THB: '฿', USD: '$', VND: '₫' };
      const AG_HDR: Record<string, string> = { THB: '1E6E4B', USD: '1A5276', VND: '7D6608' };
      let agRow = 2;

      for (const cur of ['THB', 'USD', 'VND']) {
        const curAgents = agents.filter((a: any) => (a.currency || 'THB') === cur);
        if (curAgents.length === 0) continue;

        // Currency section header
        wsAg.mergeCells(agRow, 1, agRow, 5);
        const secCell = wsAg.getCell(agRow, 1);
        secCell.value = `${cur}  ${AG_SYM[cur]}`;
        secCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${AG_HDR[cur]}` } };
        secCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsAg.getRow(agRow).height = 22;
        agRow++;

        // Column headers
        ['Агент', 'За период', 'Всего начислено', 'Всего выплачено', 'Баланс']
          .forEach((h, i) => hdr(wsAg, agRow, i + 1, h));
        wsAg.getRow(agRow).height = 28;
        agRow++;

        if (curAgents.length === 0) {
          wsAg.mergeCells(agRow, 1, agRow, 5);
          const emptyAg = wsAg.getCell(agRow, 1);
          emptyAg.value = 'Нет данных за выбранный период';
          emptyAg.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF888888' } };
          emptyAg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
          emptyAg.alignment = { horizontal: 'center' };
          wsAg.getRow(agRow).height = 18;
          agRow++;
        } else {
          curAgents.forEach((a: any) => {
            const commPeriod = Number(a.commission_period);
            const commTotal  = Number(a.commission_total);
            const paid       = Number(a.total_paid);
            const balance    = paid - commTotal;
            const bg = balance >= 0 ? LIGHT_GREEN : LIGHT_RED;

            cell(wsAg, agRow, 1, a.agent_name, bg, true);
            money(wsAg, agRow, 2, commPeriod, bg);
            money(wsAg, agRow, 3, commTotal, bg);
            money(wsAg, agRow, 4, paid, bg);
            money(wsAg, agRow, 5, balance, bg, true);
            wsAg.getCell(agRow, 5).font = {
              name: 'Arial', size: 10, bold: true,
              color: { argb: balance >= 0 ? 'FF1B6B3A' : 'FF9B0000' },
            };
            wsAg.getRow(agRow).height = 20;
            agRow++;
          });
        }
        agRow++; // blank row between currencies
      }

      [30, 16, 18, 18, 16].forEach((w, i) => { wsAg.getColumn(i + 1).width = w; });
    }

    const filename = filterCurrency
      ? `accounting_${filterCurrency}_${dateFrom}_${dateTo || dateFrom}.xlsx`
      : `accounting_${dateFrom}_${dateTo || dateFrom}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Accounting export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};
