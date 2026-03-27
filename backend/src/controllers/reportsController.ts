import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

// Summary report: revenue by manager, company, tour
export const getSummaryReport = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, managerId, groupBy = 'manager', dateType = 'sale' } = req.query;
    const user = req.user!;
    const dateField = dateType === 'tour' ? 'v.tour_date::date' : 'v.created_at::date';

    const params: any[] = [];
    let p = 1;

    let dateFilter = '';
    if (dateFrom) { dateFilter += ` AND ${dateField} >= $${p++}`; params.push(dateFrom); }
    if (dateTo)   { dateFilter += ` AND ${dateField} <= $${p++}`; params.push(dateTo); }

    const userRoles: string[] = user.roles || [user.role];
    const isHotlineOnly = userRoles.includes('hotline') && !userRoles.some(r => ['manager', 'admin', 'accountant'].includes(r));

    let managerFilter = '';
    if (userRoles.includes('manager') && !userRoles.includes('admin')) {
      managerFilter = ` AND v.manager_id = $${p++}`;
      params.push(user.id);
    } else if (managerId) {
      managerFilter = ` AND v.manager_id = $${p++}`;
      params.push(managerId);
    }

    let rows;

    if (groupBy === 'manager') {
      const result = await pool.query(
        `SELECT
          u.id as manager_id,
          u.full_name as manager_name,
          t.name as tour_name,
          COUNT(v.id) as voucher_count,
          SUM(v.total_sale) as total_sale,
          SUM(v.total_net) as total_net,
          SUM(v.total_sale - v.total_net) as profit,
          SUM(
            (v.total_sale - v.total_net) * (1 - CASE WHEN v.agent_id IS NOT NULL THEN COALESCE(v.agent_commission_percentage, 0) / 100.0 ELSE 0 END)
          ) as profit_after_agent,
          SUM(
            (v.total_sale - v.total_net) * (1 - CASE WHEN v.agent_id IS NOT NULL THEN COALESCE(v.agent_commission_percentage, 0) / 100.0 ELSE 0 END)
            * COALESCE(u.commission_percentage, 0) / 100.0
          ) as manager_pay,
          SUM(v.paid_to_agency) as total_paid,
          SUM(v.cash_on_tour) as total_cash_on_tour,
          COUNT(CASE WHEN v.payment_status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN v.payment_status = 'partial' THEN 1 END) as partial_count,
          COUNT(CASE WHEN v.payment_status = 'unpaid' THEN 1 END) as unpaid_count
        FROM vouchers v
        JOIN users u ON v.manager_id = u.id
        LEFT JOIN tours t ON v.tour_id = t.id
        WHERE v.is_deleted = false ${dateFilter} ${managerFilter}
        GROUP BY u.id, u.full_name, t.id, t.name
        ORDER BY u.full_name, total_sale DESC NULLS LAST`,
        params
      );
      rows = result.rows;

    } else if (groupBy === 'company') {
      const result = await pool.query(
        `SELECT
          co.id as company_id,
          co.name as company_name,
          t.name as tour_name,
          COUNT(v.id) as voucher_count,
          SUM(v.total_sale) as total_sale,
          SUM(v.total_net) as total_net,
          SUM(v.total_sale - v.total_net) as profit,
          SUM(v.adults + v.children) as total_pax
        FROM vouchers v
        JOIN companies co ON v.company_id = co.id
        LEFT JOIN tours t ON v.tour_id = t.id
        WHERE v.is_deleted = false ${dateFilter} ${managerFilter}
        GROUP BY co.id, co.name, t.id, t.name
        ORDER BY co.name, total_sale DESC NULLS LAST`,
        params
      );
      rows = result.rows;

    } else if (groupBy === 'tour') {
      const result = await pool.query(
        `SELECT
          t.id as tour_id,
          t.name as tour_name,
          t.tour_type,
          COUNT(v.id) as voucher_count,
          SUM(v.adults + v.children) as total_pax,
          SUM(v.total_sale) as total_sale,
          SUM(v.total_net) as total_net,
          SUM(v.total_sale - v.total_net) as profit
        FROM vouchers v
        JOIN tours t ON v.tour_id = t.id
        WHERE v.is_deleted = false ${dateFilter} ${managerFilter}
        GROUP BY t.id, t.name, t.tour_type
        ORDER BY total_sale DESC NULLS LAST`,
        params
      );
      rows = result.rows;

    } else if (groupBy === 'day') {
      const result = await pool.query(
        `SELECT
          ${dateField} as date,
          COUNT(v.id) as voucher_count,
          SUM(v.adults + v.children) as total_pax,
          SUM(v.total_sale) as total_sale,
          SUM(v.total_net) as total_net,
          SUM(v.total_sale - v.total_net) as profit
        FROM vouchers v
        WHERE v.is_deleted = false ${dateFilter} ${managerFilter}
        GROUP BY ${dateField}
        ORDER BY date DESC`,
        params
      );
      rows = result.rows;
    } else {
      rows = [];
    }

    // Hotline-only users: strip financial data
    if (isHotlineOnly) {
      rows = rows.map((r: any) => {
        const { total_sale, total_net, profit, adult_net, child_net, ...safe } = r;
        return safe;
      });
    }

    res.json(rows);
  } catch (error) {
    console.error('Summary report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Totals for date range (header cards)
export const getReportTotals = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, managerId, dateType = 'sale' } = req.query;
    const user = req.user!;
    const dateField = dateType === 'tour' ? 'v.tour_date::date' : 'v.created_at::date';

    const params: any[] = [];
    let p = 1;
    let filters = '';

    if (dateFrom) { filters += ` AND ${dateField} >= $${p++}`; params.push(dateFrom); }
    if (dateTo)   { filters += ` AND ${dateField} <= $${p++}`; params.push(dateTo); }

    const userRoles2: string[] = (user as any).roles || [user.role];
    if (userRoles2.includes('manager') && !userRoles2.includes('admin')) {
      filters += ` AND v.manager_id = $${p++}`;
      params.push(user.id);
    } else if (managerId) {
      filters += ` AND v.manager_id = $${p++}`;
      params.push(managerId);
    }

    const result = await pool.query(
      `SELECT
        COUNT(v.id) as voucher_count,
        SUM(v.adults + v.children) as total_pax,
        SUM(v.infants) as total_infants,
        SUM(v.total_sale) as total_sale,
        SUM(v.total_net) as total_net,
        SUM(v.total_sale - v.total_net) as profit,
        SUM(v.paid_to_agency) as total_paid,
        SUM(v.cash_on_tour) as total_cash_on_tour,
        COUNT(CASE WHEN v.payment_status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN v.payment_status = 'partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN v.payment_status = 'unpaid' THEN 1 END) as unpaid_count
      FROM vouchers v
      WHERE v.is_deleted = false ${filters}`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Report totals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Payments report
export const getPaymentsReport = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, managerId } = req.query;
    const user = req.user!;

    const params: any[] = [];
    let p = 1;
    let filters = '';

    if (dateFrom) { filters += ` AND p.payment_date >= $${p++}`; params.push(dateFrom); }
    if (dateTo)   { filters += ` AND p.payment_date <= $${p++}`; params.push(dateTo + ' 23:59:59'); }

    const userRoles3: string[] = (user as any).roles || [user.role];
    if (userRoles3.includes('manager') && !userRoles3.includes('admin')) {
      filters += ` AND v.manager_id = $${p++}`;
      params.push(user.id);
    } else if (managerId) {
      filters += ` AND v.manager_id = $${p++}`;
      params.push(managerId);
    }

    const result = await pool.query(
      `SELECT
        p.id, p.payment_date, p.amount, p.currency, p.payment_method, p.notes,
        v.voucher_number, v.tour_date,
        c.name as client_name, c.phone as client_phone,
        u.full_name as manager_name,
        co.name as company_name
      FROM payments p
      JOIN vouchers v ON p.voucher_id = v.id
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN companies co ON v.company_id = co.id
      WHERE v.is_deleted = false ${filters}
      ORDER BY p.payment_date DESC
      LIMIT 1000`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Payments report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
