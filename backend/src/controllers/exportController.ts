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

    if (user.role === 'manager') {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(user.id);
    } else if (managerId) {
      managerFilter = ` AND v.manager_id = $3`;
      params.push(managerId);
    }

    // Vouchers sold in the period (by created_at = sale date)
    const vouchersRes = await pool.query(
      `SELECT
        v.voucher_number, v.tour_type, v.tour_date, v.tour_date_end, v.tour_time,
        v.adults, v.children, v.infants,
        v.adult_sale, v.child_sale, v.infant_sale, v.transfer_sale, v.other_sale,
        v.adult_net, v.child_net, v.infant_net, v.transfer_net, v.other_net,
        v.total_sale, v.total_net, v.paid_to_agency, v.cash_on_tour,
        v.payment_status, v.hotel_name, v.room_number,
        v.remarks, v.is_important, v.cancellation_notes,
        v.agent_commission_percentage, v.created_at as sale_date,
        c.name as client_name, c.phone as client_phone,
        co.name as company_name, t.name as tour_name,
        u.full_name as manager_name, u.manager_phone,
        a.name as agent_name
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
        p.payment_date, p.amount, p.currency, p.payment_method, p.notes,
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
    // SHEET 1: VOUCHERS
    // ═══════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Ваучеры');
    ws1.views = [{ state: 'frozen', ySplit: 4 }];

    // Title
    ws1.mergeCells('A1:S1');
    const title1 = ws1.getCell('A1');
    title1.value = `ВАУЧЕРЫ НА ${dateFormatted}`;
    title1.font = { name: 'Arial', bold: true, size: 14, color: { argb: BLUE_HEADER } };
    title1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 28;

    // Subtitle
    ws1.mergeCells('A2:S2');
    const sub1 = ws1.getCell('A2');
    sub1.value = `Сформировано: ${new Date().toLocaleString('ru-RU')} | Ваучеров: ${vouchers.length} | Пассажиров: ${vouchers.reduce((s, v) => s + Number(v.adults || 0) + Number(v.children || 0), 0)}`;
    sub1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    sub1.alignment = { horizontal: 'center' };
    ws1.getRow(2).height = 16;

    // Empty row
    ws1.getRow(3).height = 4;

    // Headers row 4
    const vHeaders = [
      'Ваучер №', 'Важный', 'Статус', 'Компания', 'Тур', 'Менеджер',
      'Клиент', 'Телефон', 'Отель / Комната',
      'Время', 'Взр.', 'Дет.', 'Мл.',
      'Sale (฿)', 'Net (฿)', 'Оплачено (฿)', 'Наличные (฿)',
      'Агент', 'Примечания',
    ];
    vHeaders.forEach((h, i) => hdr(ws1, 4, i + 1, h));
    ws1.getRow(4).height = 36;

    const STATUS_LABELS: Record<string, string> = {
      paid: 'Оплачен', partial: 'Частично', unpaid: 'Не оплачен',
    };
    const TYPE_LABELS: Record<string, string> = {
      group: 'Групп.', individual: 'Инд.', tourflot: 'ТурФлот',
    };

    vouchers.forEach((v, i) => {
      const r = 5 + i;
      const bg = v.is_important ? YELLOW : (i % 2 === 0 ? WHITE : LIGHT_BLUE);
      const statusBg = v.payment_status === 'paid' ? LIGHT_GREEN : v.payment_status === 'unpaid' ? LIGHT_RED : YELLOW;

      cell(ws1, r, 1, v.voucher_number, bg, true);
      cell(ws1, r, 2, v.is_important ? '★ ВАЖНО' : '', v.is_important ? YELLOW : bg);
      const sc = ws1.getCell(r, 3);
      sc.value = STATUS_LABELS[v.payment_status] || v.payment_status;
      sc.font = { name: 'Arial', size: 10, bold: true };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
      sc.alignment = { horizontal: 'center' };
      sc.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };

      cell(ws1, r, 4, v.company_name, bg);
      cell(ws1, r, 5, v.tour_name, bg);
      cell(ws1, r, 6, v.manager_name, bg);
      cell(ws1, r, 7, v.client_name, bg);
      cell(ws1, r, 8, v.client_phone, bg);
      cell(ws1, r, 9, [v.hotel_name, v.room_number].filter(Boolean).join(' / ') || '—', bg);

      cell(ws1, r, 10, v.tour_time || '—', bg);
      const c11 = ws1.getCell(r, 11); c11.value = Number(v.adults); c11.font = { name: 'Arial', size: 10 }; c11.alignment = { horizontal: 'center' }; if (bg) c11.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      const c12 = ws1.getCell(r, 12); c12.value = Number(v.children); c12.font = { name: 'Arial', size: 10 }; c12.alignment = { horizontal: 'center' }; if (bg) c12.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      const c13 = ws1.getCell(r, 13); c13.value = Number(v.infants); c13.font = { name: 'Arial', size: 10 }; c13.alignment = { horizontal: 'center' }; if (bg) c13.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      money(ws1, r, 14, v.total_sale, bg);
      money(ws1, r, 15, v.total_net, bg);
      money(ws1, r, 16, v.paid_to_agency, bg);
      money(ws1, r, 17, v.cash_on_tour, bg);

      cell(ws1, r, 18, v.agent_name ? `${v.agent_name} (${v.agent_commission_percentage}%)` : '—', bg);
      cell(ws1, r, 19, [v.remarks, v.cancellation_notes].filter(Boolean).join(' | ') || '', bg);
    });

    // Totals row
    const tr = 5 + vouchers.length;
    ws1.mergeCells(tr, 1, tr, 13);
    const totalCell = ws1.getCell(tr, 1);
    totalCell.value = `ИТОГО: ${vouchers.length} ваучеров`;
    totalCell.font = { name: 'Arial', bold: true, size: 10 };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    totalCell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    totalCell.alignment = { horizontal: 'right' };

    if (vouchers.length > 0) {
      const firstDataRow = 5;
      const lastDataRow = 4 + vouchers.length;
      [[14, 'total_sale'], [15, 'total_net'], [16, 'paid_to_agency'], [17, 'cash_on_tour']].forEach(([col, _]) => {
        const c = ws1.getCell(tr, col as number);
        c.value = { formula: `SUM(${ws1.getColumn(col as number).letter}${firstDataRow}:${ws1.getColumn(col as number).letter}${lastDataRow})` };
        c.numFmt = '#,##0.00 "฿"';
        c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
        c.alignment = { horizontal: 'right' };
      });
    }

    ws1.getRow(tr).height = 22;

    // Column widths
    [12, 10, 12, 20, 28, 18, 20, 16, 22, 8, 6, 6, 6, 14, 14, 14, 14, 22, 30].forEach((w, i) => {
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
    // SHEET 3: SUMMARY
    // ═══════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Итоги дня');

    ws3.mergeCells('A1:D1');
    const ts = ws3.getCell('A1');
    ts.value = `ИТОГИ ДНЯ — ${dateFormatted}`;
    ts.font = { name: 'Arial', bold: true, size: 16, color: { argb: BLUE_HEADER } };
    ts.alignment = { horizontal: 'center', vertical: 'middle' };
    ws3.getRow(1).height = 36;

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
        ws3.mergeCells(sRow, 1, sRow, 4);
        const sc = ws3.getCell(sRow, 1);
        sc.value = label;
        sc.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
        sc.alignment = { horizontal: 'left', indent: 1 };
        ws3.getRow(sRow).height = 22;
      } else {
        const lc = ws3.getCell(sRow, 1);
        lc.value = label;
        lc.font = { name: 'Arial', size: 10 };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sRow % 2 === 0 ? LIGHT_BLUE : WHITE } };
        lc.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };

        const vc = ws3.getCell(sRow, 2);
        const isMoneyRow = typeof value === 'number' && ['Продажи', 'Нетто', 'Прибыль', 'Оплачено аг', 'Наличные', 'Сумма'].some(k => (label as string).startsWith(k));
        vc.value = value;
        vc.font = { name: 'Arial', size: 10, bold: true };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sRow % 2 === 0 ? LIGHT_BLUE : WHITE } };
        vc.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
        vc.alignment = { horizontal: 'right' };
        if (isMoneyRow) vc.numFmt = '#,##0.00 "฿"';
        ws3.getRow(sRow).height = 20;
      }
      sRow++;
    });

    ws3.getColumn(1).width = 30;
    ws3.getColumn(2).width = 20;

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
