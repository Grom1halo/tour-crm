import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

const generateVoucherNumber = async (managerId: number): Promise<string> => {
  // Atomically increment voucher_counter (starts at 499 so first use → 500)
  // Uses manager_number as the 2-digit prefix, same as old system's str_pad($user_id, 2, 0)
  const result = await pool.query(
    `UPDATE users
     SET voucher_counter = COALESCE(voucher_counter, 499) + 1
     WHERE id = $1
     RETURNING manager_number, voucher_counter`,
    [managerId]
  );
  const row = result.rows[0];
  const managerNum = (row?.manager_number || '00').toString().padStart(2, '0');
  const counter = row?.voucher_counter ?? 500;
  return `${managerNum}${counter}`;
};

export const getVouchers = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { search, dateFrom, dateTo, tourDateFrom, tourDateTo, paymentStatus, companyId, managerId, showDeleted, isImportant } = req.query;

    let query = `
      SELECT v.*, c.name as client_name, c.phone as client_phone,
        co.name as company_name, t.name as tour_name,
        u.full_name as manager_name, a.name as agent_name
      FROM vouchers v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let p = 1;

    if (user.role === 'manager') { query += ` AND v.manager_id = $${p++}`; params.push(user.id); }
    else if (managerId)          { query += ` AND v.manager_id = $${p++}`; params.push(managerId); }

    if (showDeleted !== 'true') query += ' AND v.is_deleted = false';
    if (isImportant === 'true') query += ' AND v.is_important = true';

    if (search) {
      query += ` AND (v.voucher_number ILIKE $${p} OR c.phone ILIKE $${p} OR c.name ILIKE $${p} OR co.name ILIKE $${p})`;
      params.push(`%${search}%`); p++;
    }
    if (dateFrom)     { query += ` AND v.created_at >= $${p++}`;          params.push(dateFrom); }
    if (dateTo)       { query += ` AND v.created_at <= $${p++}`;          params.push(dateTo + ' 23:59:59'); }
    if (tourDateFrom) { query += ` AND v.tour_date >= $${p++}`;            params.push(tourDateFrom); }
    if (tourDateTo)   { query += ` AND v.tour_date <= $${p++}`;            params.push(tourDateTo); }
    if (paymentStatus){ query += ` AND v.payment_status = $${p++}`;        params.push(paymentStatus); }
    if (companyId)    { query += ` AND v.company_id = $${p++}`;            params.push(companyId); }

    query += ' ORDER BY v.is_important DESC, v.created_at DESC LIMIT 500';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getVoucherById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const result = await pool.query(
      `SELECT v.*, c.name as client_name, c.phone as client_phone,
        co.name as company_name, t.name as tour_name, t.tour_type as tour_type_name,
        u.full_name as manager_name, u.manager_phone as manager_phone,
        a.name as agent_name, a.commission_percentage as agent_commission
      FROM vouchers v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE v.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Voucher not found' });
    const voucher = result.rows[0];
    if (user.role === 'manager' && voucher.manager_id !== user.id)
      return res.status(403).json({ error: 'Access denied' });

    const payments = await pool.query(
      `SELECT p.*, co.name as company_name FROM payments p
       LEFT JOIN companies co ON p.company_id = co.id
       WHERE p.voucher_id = $1 ORDER BY p.payment_date DESC`,
      [id]
    );
    voucher.payments = payments.rows;
    res.json(voucher);
  } catch (error) {
    console.error('Get voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createVoucher = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = req.user!;
    const {
      tourType, clientId, companyId, tourId,
      tourDate, tourDateEnd, tourTime, hotelName, roomNumber,
      adults, children, infants,
      adultNet, childNet, infantNet, transferNet, otherNet,
      adultSale, childSale, infantSale, transferSale, otherSale,
      agentId, agentCommissionPercentage,
      remarks, isImportant, cancellationNotes,
    } = req.body;

    if (!tourType || !clientId || !companyId || !tourId || !tourDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const managerId = user.role === 'manager' ? user.id : (req.body.managerId || user.id);
    const voucherNumber = await generateVoucherNumber(managerId);

    const result = await client.query(
      `INSERT INTO vouchers (
        voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
        tour_date, tour_date_end, tour_time, hotel_name, room_number,
        adults, children, infants,
        adult_net, child_net, infant_net, transfer_net, other_net,
        adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
        agent_id, agent_commission_percentage, remarks, is_important, cancellation_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
      RETURNING *`,
      [
        voucherNumber, tourType, clientId, managerId, companyId, tourId,
        tourDate, tourDateEnd || null, tourTime || null, hotelName || null, roomNumber || null,
        adults || 0, children || 0, infants || 0,
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
        agentId || null, agentCommissionPercentage || 0, remarks || null,
        isImportant || false, cancellationNotes || null,
      ]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const updateVoucher = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const user = req.user!;
    if (user.role === 'manager') {
      const check = await client.query('SELECT manager_id FROM vouchers WHERE id=$1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    const {
      tourDate, tourDateEnd, tourTime, hotelName, roomNumber,
      adults, children, infants,
      adultNet, childNet, infantNet, transferNet, otherNet,
      adultSale, childSale, infantSale, transferSale, otherSale,
      agentId, agentCommissionPercentage,
      remarks, isImportant, cancellationNotes,
    } = req.body;

    const result = await client.query(
      `UPDATE vouchers SET
        tour_date=$1, tour_date_end=$2, tour_time=$3, hotel_name=$4, room_number=$5,
        adults=$6, children=$7, infants=$8,
        adult_net=$9, child_net=$10, infant_net=$11, transfer_net=$12, other_net=$13,
        adult_sale=$14, child_sale=$15, infant_sale=$16, transfer_sale=$17, other_sale=$18,
        agent_id=$19, agent_commission_percentage=$20,
        remarks=$21, is_important=$22, cancellation_notes=$23,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$24 RETURNING *`,
      [
        tourDate, tourDateEnd || null, tourTime || null, hotelName || null, roomNumber || null,
        adults || 0, children || 0, infants || 0,
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
        agentId || null, agentCommissionPercentage || 0,
        remarks || null, isImportant || false, cancellationNotes || null,
        id,
      ]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const deleteVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    if (user.role === 'manager') {
      const check = await pool.query('SELECT manager_id FROM vouchers WHERE id=$1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id)
        return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query('UPDATE vouchers SET is_deleted=true, deleted_at=CURRENT_TIMESTAMP, deleted_by=$1 WHERE id=$2', [user.id, id]);
    res.json({ message: 'Voucher deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const restoreVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    if (user.role === 'manager') {
      const check = await pool.query('SELECT manager_id FROM vouchers WHERE id=$1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id)
        return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query('UPDATE vouchers SET is_deleted=false, deleted_at=NULL, deleted_by=NULL WHERE id=$1', [id]);
    res.json({ message: 'Voucher restored' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const copyVoucher = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const user = req.user!;
    const original = await client.query('SELECT * FROM vouchers WHERE id=$1', [id]);
    if (original.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Voucher not found' }); }
    const v = original.rows[0];
    if (user.role === 'manager' && v.manager_id !== user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Access denied' }); }
    const voucherNumber = await generateVoucherNumber(v.manager_id || user.id);
    const result = await client.query(
      `INSERT INTO vouchers (
        voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
        tour_date, tour_date_end, tour_time, hotel_name, room_number,
        adults, children, infants,
        adult_net, child_net, infant_net, transfer_net, other_net,
        adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
        agent_id, agent_commission_percentage, remarks, is_important, cancellation_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
      RETURNING *`,
      [
        voucherNumber, v.tour_type, v.client_id, v.manager_id, v.company_id, v.tour_id,
        v.tour_date, v.tour_date_end, v.tour_time, v.hotel_name, v.room_number,
        v.adults, v.children, v.infants,
        v.adult_net, v.child_net, v.infant_net, v.transfer_net, v.other_net,
        v.adult_sale, v.child_sale, v.infant_sale, v.transfer_sale, v.other_sale,
        v.agent_id, v.agent_commission_percentage, v.remarks, v.is_important, v.cancellation_notes,
      ]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const getTourPrices = async (req: AuthRequest, res: Response) => {
  try {
    const { tourId, companyId, date } = req.query;
    if (!tourId || !companyId || !date)
      return res.status(400).json({ error: 'tourId, companyId, and date required' });
    const result = await pool.query(
      `SELECT * FROM tour_prices WHERE tour_id=$1 AND company_id=$2 AND $3 BETWEEN valid_from AND valid_to AND is_active=true LIMIT 1`,
      [tourId, companyId, date]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCompaniesByTour = async (req: AuthRequest, res: Response) => {
  try {
    const { tourId } = req.params;
    const result = await pool.query(
      `SELECT c.id, c.name, c.article, tp.article as price_article
       FROM companies c
       JOIN tour_prices tp ON tp.company_id = c.id
       WHERE tp.tour_id = $1 AND c.is_active = true AND tp.is_active = true
       ORDER BY c.name`,
      [tourId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getToursByCompany = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    // Return article per tour+company (take max so DISTINCT works; article should be same across periods)
    const result = await pool.query(
      `SELECT t.id, t.name, t.tour_type, t.article as tour_article, MAX(tp.article) as price_article
       FROM tours t JOIN tour_prices tp ON tp.tour_id = t.id
       WHERE tp.company_id=$1 AND t.is_active=true AND tp.is_active=true
       GROUP BY t.id, t.name, t.tour_type, t.article
       ORDER BY t.name`,
      [companyId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
