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
  c.numFmt = '#,##0.00 "฿"';
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
        v.agent_commission_percentage, v.created_at as sale_date,
        c.name as client_name, c.phone as client_phone,
        co.name as company_name, t.name as tour_name,
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
        co.name as company_name, t.name as tour_name,
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

    const COL_COUNT = 19;
    ws1.mergeCells(`A1:S1`);
    const title1 = ws1.getCell('A1');
    title1.value = `БУХГАЛТЕРСКИЙ ОТЧЁТ — ${dateFormatted}`;
    title1.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    title1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 28;

    ws1.mergeCells('A2:S2');
    const sub1 = ws1.getCell('A2');
    sub1.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Ваучеров: ${vouchers.length} | Пассажиров: ${vouchers.reduce((s, v) => s + Number(v.adults || 0) + Number(v.children || 0), 0)}`;
    sub1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    sub1.alignment = { horizontal: 'center' };
    ws1.getRow(2).height = 16;
    ws1.getRow(3).height = 4;

    const vHeaders = [
      'Дата создания', 'Дата выезда', 'Компания', 'Тур',
      'Взр.', 'Дет.', 'Мл.',
      'Оплачено (฿)', 'Наличные (฿)',
      'Sale (฿)', 'Нетто (฿)', 'Профит (฿)',
      'Агент (%)', 'Ком. агента (฿)', 'Профит−Аг. (฿)', 'Зарплата мен. (฿)',
      'Статус оплаты', 'Место оплаты', 'Примечание',
    ];
    vHeaders.forEach((h, i) => hdr(ws1, 4, i + 1, h));
    ws1.getRow(4).height = 40;

    const STATUS_LABELS: Record<string, string> = {
      paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен',
    };

    vouchers.forEach((v, i) => {
      const r = 5 + i;
      const bg = v.is_important ? YELLOW : (i % 2 === 0 ? WHITE : LIGHT_BLUE);
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

      cell(ws1, r, 1, fmt(v.sale_date), bg);
      cell(ws1, r, 2, fmt(v.tour_date), bg);
      cell(ws1, r, 3, v.company_name || '—', bg);
      cell(ws1, r, 4, v.tour_name || '—', bg);

      const mkCtr = (col: number, val: number) => {
        const c = ws1.getCell(r, col);
        c.value = val; c.font = { name: 'Arial', size: 10 };
        c.alignment = { horizontal: 'center' };
        if (bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      };
      mkCtr(5, Number(v.adults)); mkCtr(6, Number(v.children)); mkCtr(7, Number(v.infants));

      money(ws1, r, 8, v.paid_to_agency, bg);
      money(ws1, r, 9, v.cash_on_tour, bg);
      money(ws1, r, 10, v.total_sale, bg, true);
      money(ws1, r, 11, v.total_net, bg);
      money(ws1, r, 12, profit, profit < 0 ? LIGHT_RED : bg, true);
      cell(ws1, r, 13, v.agent_name ? `${v.agent_name} (${v.agent_commission_percentage}%)` : '—', bg);
      money(ws1, r, 14, agentCommission, bg);
      money(ws1, r, 15, profitAfterAgent, bg);
      money(ws1, r, 16, managerPay, LIGHT_GREEN, true);

      // Status with date
      const sc = ws1.getCell(r, 17);
      sc.value = statusWithDate;
      sc.font = { name: 'Arial', size: 10, bold: true };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
      sc.alignment = { horizontal: 'center', wrapText: true };
      sc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };

      cell(ws1, r, 18, v.payment_methods || '—', bg);
      cell(ws1, r, 19, [v.remarks, v.cancellation_notes].filter(Boolean).join(' | ') || '', bg);
    });

    // Totals row
    const tr1 = 5 + vouchers.length;
    ws1.mergeCells(tr1, 1, tr1, 4);
    const totalCell1 = ws1.getCell(tr1, 1);
    totalCell1.value = `ИТОГО: ${vouchers.length} ваучеров`;
    totalCell1.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    totalCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    totalCell1.alignment = { horizontal: 'right' };

    const moneyCols1 = [5,6,7,8,9,10,11,12,13,14,15,16];
    moneyCols1.forEach(col => {
      const c = ws1.getCell(tr1, col);
      c.value = { formula: `SUM(${ws1.getColumn(col).letter}5:${ws1.getColumn(col).letter}${tr1 - 1})` };
      c.numFmt = col > 7 ? '#,##0 "฿"' : '0';
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'right' };
    });
    [17, 18, 19].forEach(col => {
      const c = ws1.getCell(tr1, col);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    });
    ws1.getRow(tr1).height = 22;

    [14, 12, 22, 28, 5, 5, 5, 13, 13, 13, 13, 13, 22, 13, 13, 13, 20, 18, 28].forEach((w, i) => {
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
    const totalPayments = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    sub2.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Платежей: ${payments.length} | Сумма: ${totalPayments.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ฿`;
    sub2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    sub2.alignment = { horizontal: 'center' };
    ws2.getRow(2).height = 16;
    ws2.getRow(3).height = 4;

    const pHeaders = ['Дата платежа', 'Ваучер №', 'Дата тура', 'Клиент', 'Телефон', 'Компания', 'Тур', 'Менеджер', 'Сумма', 'Метод / Примечание'];
    pHeaders.forEach((h, i) => hdr(ws2, 4, i + 1, h));
    ws2.getRow(4).height = 36;

    payments.forEach((p, i) => {
      const r = 5 + i;
      const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
      cell(ws2, r, 1, fmt(p.payment_date), bg);
      cell(ws2, r, 2, p.voucher_number, bg, true);
      cell(ws2, r, 3, fmt(p.tour_date), bg);
      cell(ws2, r, 4, p.client_name, bg);
      cell(ws2, r, 5, p.client_phone, bg);
      cell(ws2, r, 6, p.company_name, bg);
      cell(ws2, r, 7, p.tour_name, bg);
      cell(ws2, r, 8, p.manager_name, bg);
      money(ws2, r, 9, p.amount, bg, true);
      cell(ws2, r, 10, [p.payment_method, p.currency !== 'THB' ? p.currency : '', p.notes].filter(Boolean).join(' · '), bg);
    });

    // Totals
    const pr = 5 + payments.length;
    ws2.mergeCells(pr, 1, pr, 8);
    const ptc = ws2.getCell(pr, 1);
    ptc.value = `ИТОГО: ${payments.length} платежей`;
    ptc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    ptc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    ptc.alignment = { horizontal: 'right' };

    if (payments.length > 0) {
      const pc = ws2.getCell(pr, 9);
      pc.value = { formula: `SUM(I5:I${4 + payments.length})` };
      pc.numFmt = '#,##0.00 "฿"';
      pc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      pc.alignment = { horizontal: 'right' };
    }
    ws2.getRow(pr).height = 22;

    [14, 12, 12, 22, 16, 20, 26, 18, 16, 30].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

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

    const salHeaders = ['Менеджер', 'Ваучеров', 'Sale (฿)', 'Профит (฿)', 'Ком. агентов (฿)', 'Профит−Аг. (฿)', 'Ставка %', 'Зарплата (฿)'];
    salHeaders.forEach((h, i) => hdr(ws3, 3, i + 1, h));
    ws3.getRow(3).height = 32;

    // Group by manager
    const mgMap: Record<number, any> = {};
    vouchers.forEach(v => {
      const mid = v.manager_id;
      if (!mgMap[mid]) {
        mgMap[mid] = {
          name: v.manager_name,
          count: 0,
          sale: 0, profit: 0, agentCommission: 0,
          profitAfterAgent: 0, managerPay: 0,
          pct: Number(v.manager_commission_percentage || 0),
        };
      }
      const m = mgMap[mid];
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

    const mgList = Object.values(mgMap).sort((a: any, b: any) => b.managerPay - a.managerPay);
    mgList.forEach((m: any, i: number) => {
      const r = 4 + i;
      const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
      cell(ws3, r, 1, m.name, bg, true);
      const cn = ws3.getCell(r, 2); cn.value = m.count; cn.font = { name: 'Arial', size: 10 }; cn.alignment = { horizontal: 'center' }; if (bg) cn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      money(ws3, r, 3, m.sale, bg);
      money(ws3, r, 4, m.profit, bg);
      money(ws3, r, 5, m.agentCommission, bg);
      money(ws3, r, 6, m.profitAfterAgent, bg);
      const cp = ws3.getCell(r, 7); cp.value = m.pct + '%'; cp.font = { name: 'Arial', size: 10 }; cp.alignment = { horizontal: 'center' }; if (bg) cp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      money(ws3, r, 8, m.managerPay, LIGHT_GREEN, true);
    });

    // Grand total row
    const tr3 = 4 + mgList.length;
    ws3.mergeCells(tr3, 1, tr3, 2);
    const gt3 = ws3.getCell(tr3, 1);
    gt3.value = 'ИТОГО';
    gt3.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    gt3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    gt3.alignment = { horizontal: 'right' };
    [3,4,5,6,7,8].forEach(col => {
      const c = ws3.getCell(tr3, col);
      c.value = { formula: `SUM(${ws3.getColumn(col).letter}4:${ws3.getColumn(col).letter}${tr3 - 1})` };
      c.numFmt = '#,##0 "฿"';
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      c.alignment = { horizontal: 'right' };
    });
    ws3.getRow(tr3).height = 22;
    [24, 10, 14, 14, 14, 14, 10, 16].forEach((w, i) => { ws3.getColumn(i + 1).width = w; });

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

    const totalSale = vouchers.reduce((s, v) => s + Number(v.total_sale || 0), 0);
    const totalNet = vouchers.reduce((s, v) => s + Number(v.total_net || 0), 0);
    const totalPaid = vouchers.reduce((s, v) => s + Number(v.paid_to_agency || 0), 0);
    const totalCash = vouchers.reduce((s, v) => s + Number(v.cash_on_tour || 0), 0);
    const totalPax = vouchers.reduce((s, v) => s + Number(v.adults || 0) + Number(v.children || 0), 0);

    const summaryRows: [string, any, boolean?][] = [
      ['', '', true],
      ['ВАУЧЕРЫ', '', true],
      ['Всего ваучеров', vouchers.length],
      ['Пассажиров (взр+дет)', totalPax],
      ['Оплачено', vouchers.filter(v => v.payment_status === 'paid').length],
      ['Частично оплачено', vouchers.filter(v => v.payment_status === 'partial').length],
      ['Не оплачено', vouchers.filter(v => v.payment_status === 'unpaid').length],
      ['', '', true],
      ['ФИНАНСЫ', '', true],
      ['Продажи (Sale)', totalSale],
      ['Нетто (Net)', totalNet],
      ['Прибыль (Sale − Net)', totalSale - totalNet],
      ['Оплачено агентству', totalPaid],
      ['Наличные в туре', totalCash],
      ['', '', true],
      ['ПЛАТЕЖИ ЗА ДЕНЬ', '', true],
      ['Количество платежей', payments.length],
      ['Сумма платежей', totalPayments],
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
        if (isMoneyRow) vc.numFmt = '#,##0.00 "฿"';
        ws4.getRow(sRow).height = 20;
      }
      sRow++;
    });

    ws4.getColumn(1).width = 30;
    ws4.getColumn(2).width = 20;

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
        co.name as company_name, t.name as tour_name,
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
      'Оплачено (฿)', 'Наличные (฿)', 'Sale (฿)',
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
      c.numFmt = '#,##0 "฿"'; c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
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
        co.name as company_name, t.name as tour_name,
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
        co.name as company_name, t.name as tour_name,
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
      'Оплачено (฿)', 'Наличные (฿)',
      'Sale (฿)', 'Нетто (฿)', 'Профит (฿)',
      'Агент (%)', 'Ком. агента (฿)', 'Профит−Аг. (฿)', 'Зарплата мен. (฿)',
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
      c.numFmt = col > 7 ? '#,##0 "฿"' : '0';
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
    ms2.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Платежей: ${payments.length} | Сумма: ${totalPay.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ฿`;
    ms2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    ms2.alignment = { horizontal: 'center' };
    mws2.getRow(2).height = 16;
    mws2.getRow(3).height = 4;
    ['Дата платежа', 'Ваучер №', 'Дата тура', 'Клиент', 'Телефон', 'Компания', 'Тур', 'Менеджер', 'Сумма', 'Метод / Примечание'].forEach((h, i) => hdr(mws2, 4, i + 1, h));
    mws2.getRow(4).height = 36;
    payments.forEach((p: any, i: number) => {
      const r = 5 + i;
      const bg = i % 2 === 0 ? WHITE : LIGHT_BLUE;
      cell(mws2, r, 1, fmt(p.payment_date), bg);
      cell(mws2, r, 2, p.voucher_number, bg, true);
      cell(mws2, r, 3, fmt(p.tour_date), bg);
      cell(mws2, r, 4, p.client_name, bg);
      cell(mws2, r, 5, p.client_phone, bg);
      cell(mws2, r, 6, p.company_name, bg);
      cell(mws2, r, 7, p.tour_name, bg);
      cell(mws2, r, 8, p.manager_name, bg);
      money(mws2, r, 9, p.amount, bg, true);
      cell(mws2, r, 10, [p.payment_method, p.currency !== 'THB' ? p.currency : '', p.notes].filter(Boolean).join(' · '), bg);
    });
    const mpr = 5 + payments.length;
    mws2.mergeCells(mpr, 1, mpr, 8);
    const mptc = mws2.getCell(mpr, 1);
    mptc.value = `ИТОГО: ${payments.length} платежей`;
    mptc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    mptc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    mptc.alignment = { horizontal: 'right' };
    if (payments.length > 0) {
      const pc = mws2.getCell(mpr, 9);
      pc.value = { formula: `SUM(I5:I${4 + payments.length})` };
      pc.numFmt = '#,##0.00 "฿"';
      pc.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
      pc.alignment = { horizontal: 'right' };
    }
    mws2.getRow(mpr).height = 22;
    [14, 12, 12, 22, 16, 20, 26, 18, 16, 30].forEach((w, i) => { mws2.getColumn(i + 1).width = w; });

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
        if (isMoneyRow3) vc3.numFmt = '#,##0.00 "฿"';
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
        co.name as company_name, t.name as tour_name,
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
    const money2 = (n: any) => n != null ? Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0 }) + ' ฿' : '—';
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
