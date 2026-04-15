import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

// Monthly stats for a given year (by tour_date)
export const getMonthlyStats = async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const result = await pool.query(
      `SELECT
         EXTRACT(MONTH FROM tour_date)::int AS month,
         COUNT(id) AS voucher_count,
         SUM(adults + children) AS total_pax,
         COALESCE(SUM(total_sale), 0) AS total_sale,
         COALESCE(SUM(total_net), 0) AS total_net,
         COALESCE(SUM(total_sale - total_net), 0) AS profit
       FROM vouchers
       WHERE is_deleted = false
         AND EXTRACT(YEAR FROM tour_date) = $1
       GROUP BY EXTRACT(MONTH FROM tour_date)
       ORDER BY month`,
      [year]
    );

    // Fill all 12 months (including empty ones)
    const months: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const found = result.rows.find(r => r.month === m);
      months.push(found || {
        month: m,
        voucher_count: 0,
        total_pax: 0,
        total_sale: 0,
        total_net: 0,
        profit: 0,
      });
    }

    res.json({ year, months });
  } catch (error) {
    console.error('getMonthlyStats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Stats by season
export const getSeasonStats = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         s.id, s.label, s.valid_from, s.valid_to,
         COUNT(v.id) AS voucher_count,
         COALESCE(SUM(v.adults + v.children), 0) AS total_pax,
         COALESCE(SUM(v.total_sale), 0) AS total_sale,
         COALESCE(SUM(v.total_net), 0) AS total_net,
         COALESCE(SUM(v.total_sale - v.total_net), 0) AS profit
       FROM seasons s
       LEFT JOIN vouchers v ON v.tour_date >= s.valid_from
         AND v.tour_date <= s.valid_to
         AND v.is_deleted = false
       GROUP BY s.id, s.label, s.valid_from, s.valid_to
       ORDER BY s.sort_order, s.valid_from`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getSeasonStats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Stats by tour
export const getStatsByTour = async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : null;
    const yearFilter = year ? 'AND EXTRACT(YEAR FROM v.tour_date) = $1' : '';
    const params = year ? [year] : [];

    const result = await pool.query(
      `SELECT
         t.id, t.name AS tour_name,
         COUNT(v.id) AS voucher_count,
         COALESCE(SUM(v.adults + v.children + v.infants), 0) AS total_pax,
         COALESCE(SUM(v.total_sale), 0) AS total_sale,
         COALESCE(SUM(v.total_net), 0) AS total_net,
         COALESCE(SUM(v.total_sale - v.total_net), 0) AS profit
       FROM tours t
       JOIN vouchers v ON v.tour_id = t.id AND v.is_deleted = false ${yearFilter}
       GROUP BY t.id, t.name
       ORDER BY total_sale DESC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getStatsByTour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Stats by company
export const getStatsByCompany = async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : null;
    const yearFilter = year ? 'AND EXTRACT(YEAR FROM v.tour_date) = $1' : '';
    const params = year ? [year] : [];

    const result = await pool.query(
      `SELECT
         co.id, co.name AS company_name,
         COUNT(v.id) AS voucher_count,
         COALESCE(SUM(v.adults + v.children + v.infants), 0) AS total_pax,
         COALESCE(SUM(v.total_sale), 0) AS total_sale,
         COALESCE(SUM(v.total_net), 0) AS total_net,
         COALESCE(SUM(v.total_sale - v.total_net), 0) AS profit
       FROM companies co
       JOIN vouchers v ON v.company_id = co.id AND v.is_deleted = false ${yearFilter}
       GROUP BY co.id, co.name
       ORDER BY total_sale DESC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getStatsByCompany error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Stats by client (top clients)
export const getStatsByClient = async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : null;
    const yearFilter = year ? 'AND EXTRACT(YEAR FROM v.tour_date) = $1' : '';
    const params = year ? [year] : [];

    const result = await pool.query(
      `SELECT
         cl.id, cl.name AS client_name, cl.phone AS client_phone,
         COUNT(v.id) AS voucher_count,
         COALESCE(SUM(v.adults + v.children + v.infants), 0) AS total_pax,
         COALESCE(SUM(v.total_sale), 0) AS total_sale,
         COALESCE(SUM(v.paid_to_agency), 0) AS total_paid
       FROM clients cl
       JOIN vouchers v ON v.client_id = cl.id AND v.is_deleted = false ${yearFilter}
       GROUP BY cl.id, cl.name, cl.phone
       ORDER BY voucher_count DESC, total_sale DESC
       LIMIT 100`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getStatsByClient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// All-time stats by year
export const getAllTimeStats = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         EXTRACT(YEAR FROM tour_date)::int AS year,
         COUNT(id) AS voucher_count,
         COALESCE(SUM(adults + children), 0) AS total_pax,
         COALESCE(SUM(total_sale), 0) AS total_sale,
         COALESCE(SUM(total_net), 0) AS total_net,
         COALESCE(SUM(total_sale - total_net), 0) AS profit
       FROM vouchers
       WHERE is_deleted = false
         AND tour_date IS NOT NULL
       GROUP BY EXTRACT(YEAR FROM tour_date)
       ORDER BY year DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getAllTimeStats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
