import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

// Returns true if the current manager can edit/delete the given voucher
// (either it's their own, or the voucher's manager shares the same manager_phone)
// Returns true if the current manager can edit/delete the given voucher
// (either it's their own, or the voucher's manager has the same 2-digit manager_number)
const canManagerEditVoucher = async (userId: number, voucherId: number | string): Promise<boolean> => {
  const result = await pool.query(
    `SELECT v.manager_id,
            u_voucher.manager_number AS voucher_manager_number,
            u_current.manager_number AS current_manager_number
     FROM vouchers v
     JOIN users u_voucher ON u_voucher.id = v.manager_id
     JOIN users u_current ON u_current.id = $1
     WHERE v.id = $2`,
    [userId, voucherId]
  );
  if (result.rows.length === 0) return false;
  const row = result.rows[0];
  if (row.manager_id === userId) return true;
  // Same manager_number (non-null) → allowed
  const num = row.current_manager_number;
  if (num !== null && num !== undefined && num === row.voucher_manager_number) return true;
  return false;
};

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
    const { search, dateFrom, dateTo, tourDateFrom, tourDateTo, paymentStatus, companyId, managerId, showDeleted, isImportant, allManagers } = req.query;

    let query = `
      SELECT v.*, c.name as c_client_name, c.phone as c_client_phone,
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

    if (managerId) {
      query += ` AND v.manager_id = $${p++}`; params.push(managerId);
    } else if (user.role === 'manager' && allManagers !== 'true') {
      query += ` AND v.manager_id = $${p++}`; params.push(user.id);
    }

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
    const rows = result.rows.map((r: any) => ({
      ...r,
      client_name: r.client_name || r.c_client_name || '',
      client_phone: r.client_phone || r.c_client_phone || '',
    }));
    res.json(rows);
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
      `SELECT v.*, c.name as c_client_name, c.phone as c_client_phone,
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
    voucher.client_name = voucher.client_name || voucher.c_client_name || '';
    voucher.client_phone = voucher.client_phone || voucher.c_client_phone || '';
    // All roles can view any voucher

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
      tourType, clientId, clientName, clientPhone, companyId, tourId,
      tourDate, tourDateEnd, tourTime, hotelName, roomNumber,
      adults, children, infants,
      adultNet, childNet, infantNet, transferNet, otherNet,
      adultSale, childSale, infantSale, transferSale, otherSale,
      agentId, agentCommissionPercentage,
      remarks, isImportant, cancellationNotes, hotlinePhone,
      paidToAgency, tourDetails, companyDetails, jetskiConfig,
    } = req.body;

    if (!tourType || !tourDate || (!companyId && !companyDetails) || (!tourId && !tourDetails)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const managerId = user.role === 'manager' ? user.id : (req.body.managerId || user.id);
    const voucherNumber = await generateVoucherNumber(managerId);

    // Resolve clientId: use provided or find/create by name+phone
    let resolvedClientId = clientId || null;
    if (!resolvedClientId && (clientName || clientPhone)) {
      const phone = (clientPhone || '').trim();
      const name  = (clientName  || 'Unknown').trim();
      if (phone) {
        const existing = await client.query(
          'SELECT id FROM clients WHERE phone=$1 AND manager_id=$2 LIMIT 1',
          [phone, managerId]
        );
        if (existing.rows.length > 0) {
          resolvedClientId = existing.rows[0].id;
        } else {
          const created = await client.query(
            'INSERT INTO clients (name, phone, manager_id) VALUES ($1,$2,$3) RETURNING id',
            [name, phone, managerId]
          );
          resolvedClientId = created.rows[0].id;
        }
      }
    }

    const result = await client.query(
      `INSERT INTO vouchers (
        voucher_number, tour_type, client_id, client_name, client_phone, manager_id, company_id, tour_id,
        tour_date, tour_date_end, tour_time, hotel_name, room_number,
        adults, children, infants,
        adult_net, child_net, infant_net, transfer_net, other_net,
        adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
        agent_id, agent_commission_percentage, remarks, is_important, cancellation_notes, hotline_phone,
        paid_to_agency, tour_details, company_details, jetski_config, currency
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
      RETURNING *`,
      [
        voucherNumber, tourType, resolvedClientId, clientName || null, clientPhone || null,
        managerId, companyId || null, tourId || null,
        tourDate, tourDateEnd || null, tourTime || null, hotelName || null, roomNumber || null,
        adults || 0, children || 0, infants || 0,
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
        agentId || null, agentCommissionPercentage || 0, remarks || null,
        isImportant || false, cancellationNotes || null,
        hotlinePhone || '+66 65 706 3341',
        paidToAgency || 0,
        (tourDetails && tourDetails.trim() && tourDetails.trim() !== '_') ? tourDetails.trim() : null,
        (companyDetails && companyDetails.trim() && companyDetails.trim() !== '_') ? companyDetails.trim() : null,
        jetskiConfig ? JSON.stringify(jetskiConfig) : null,
        req.body.currency || 'THB',
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
      if (!(await canManagerEditVoucher(user.id, id))) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    const {
      clientId, clientName, clientPhone, tourDate, tourDateEnd, tourTime, hotelName, roomNumber,
      adults, children, infants,
      adultNet, childNet, infantNet, transferNet, otherNet,
      adultSale, childSale, infantSale, transferSale, otherSale,
      agentId, agentCommissionPercentage,
      remarks, isImportant, cancellationNotes, hotlinePhone,
      paidToAgency, tourDetails, companyDetails, jetskiConfig, currency,
      companyId, tourId, tourType,
    } = req.body;

    const result = await client.query(
      `UPDATE vouchers SET
        client_id=$1, client_name=$2, client_phone=$3,
        company_id=$4, tour_id=$5, tour_type=$6,
        tour_date=$7, tour_date_end=$8, tour_time=$9, hotel_name=$10, room_number=$11,
        adults=$12, children=$13, infants=$14,
        adult_net=$15, child_net=$16, infant_net=$17, transfer_net=$18, other_net=$19,
        adult_sale=$20, child_sale=$21, infant_sale=$22, transfer_sale=$23, other_sale=$24,
        agent_id=$25, agent_commission_percentage=$26,
        remarks=$27, is_important=$28, cancellation_notes=$29, hotline_phone=$30,
        paid_to_agency=$31, tour_details=$32, company_details=$33, jetski_config=$34,
        currency=$35, updated_at=CURRENT_TIMESTAMP
      WHERE id=$36 RETURNING *`,
      [
        clientId || null, clientName || null, clientPhone || null,
        companyId || null, tourId || null, tourType || 'group',
        tourDate, tourDateEnd || null, tourTime || null, hotelName || null, roomNumber || null,
        adults || 0, children || 0, infants || 0,
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
        agentId || null, agentCommissionPercentage || 0,
        remarks || null, isImportant || false, cancellationNotes || null,
        hotlinePhone || '+66 65 706 3341',
        paidToAgency || 0,
        (tourDetails && tourDetails.trim() && tourDetails.trim() !== '_') ? tourDetails.trim() : null,
        (companyDetails && companyDetails.trim() && companyDetails.trim() !== '_') ? companyDetails.trim() : null,
        jetskiConfig ? JSON.stringify(jetskiConfig) : null,
        currency || 'THB',
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

export const toggleServed = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    if (user.role === 'manager') {
      if (!(await canManagerEditVoucher(user.id, id)))
        return res.status(403).json({ error: 'Access denied' });
    }
    const result = await pool.query(
      'UPDATE vouchers SET is_served = NOT COALESCE(is_served, false), updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING is_served',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ is_served: result.rows[0].is_served });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    if (user.role === 'manager') {
      if (!(await canManagerEditVoucher(user.id, id)))
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
      if (!(await canManagerEditVoucher(user.id, id)))
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

    // If the original voucher's agent was deleted, don't carry over the FK
    let safeAgentId = v.agent_id;
    if (safeAgentId) {
      const agentCheck = await client.query('SELECT id FROM agents WHERE id=$1', [safeAgentId]);
      if (agentCheck.rows.length === 0) safeAgentId = null;
    }

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
        safeAgentId, safeAgentId ? v.agent_commission_percentage : 0, v.remarks, v.is_important, v.cancellation_notes,
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

export const confirmVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { field } = req.body; // 'agent_manager_confirmed' or 'agent_accountant_confirmed'
    const user = req.user!;

    if (field !== 'agent_manager_confirmed' && field !== 'agent_accountant_confirmed') {
      return res.status(400).json({ error: 'Invalid field' });
    }

    // Get current value
    const current = await pool.query(`SELECT ${field} FROM vouchers WHERE id = $1`, [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Voucher not found' });

    const newValue = !current.rows[0][field];
    const result = await pool.query(
      `UPDATE vouchers SET ${field} = $1 WHERE id = $2 RETURNING id, agent_manager_confirmed, agent_accountant_confirmed`,
      [newValue, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('confirmVoucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getToursByCompany = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    // Return article per tour+company (take max so DISTINCT works; article should be same across periods)
    const result = await pool.query(
      `SELECT t.id, t.name, t.tour_type, t.is_active, t.article as tour_article, t.company_id, t.cancellation_terms,
              tp.id as price_id, tp.adult_sale, tp.adult_net, tp.child_net, tp.updated_at as price_updated_at
       FROM tours t
       LEFT JOIN LATERAL (
         SELECT id, adult_sale, adult_net, child_net, updated_at
         FROM tour_prices
         WHERE tour_id = t.id AND company_id = $1 AND is_active = true
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1
       ) tp ON true
       WHERE t.company_id=$1 AND t.is_active=true
       ORDER BY t.name`,
      [companyId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
