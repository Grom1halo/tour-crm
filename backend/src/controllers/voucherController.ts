import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

// Generate unique voucher number
const generateVoucherNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  const result = await pool.query(
    `SELECT voucher_number FROM vouchers 
     WHERE voucher_number LIKE $1 
     ORDER BY voucher_number DESC LIMIT 1`,
    [`V${year}${month}%`]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].voucher_number;
    sequence = parseInt(lastNumber.slice(-4)) + 1;
  }

  return `V${year}${month}${sequence.toString().padStart(4, '0')}`;
};

export const getVouchers = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { 
      search, 
      dateFrom, 
      dateTo, 
      tourDateFrom, 
      tourDateTo,
      paymentStatus,
      companyId,
      showDeleted 
    } = req.query;

    let query = `
      SELECT 
        v.*,
        c.name as client_name,
        c.phone as client_phone,
        co.name as company_name,
        t.name as tour_name,
        u.full_name as manager_name,
        a.name as agent_name
      FROM vouchers v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Managers see only their vouchers (unless hotline/admin)
    if (user.role === 'manager') {
      query += ` AND v.manager_id = $${paramIndex}`;
      params.push(user.id);
      paramIndex++;
    }

    // Show deleted only if requested
    if (showDeleted !== 'true') {
      query += ' AND v.is_deleted = false';
    }

    // Search by voucher number, client phone, or company name
    if (search) {
      query += ` AND (
        v.voucher_number ILIKE $${paramIndex} OR 
        c.phone ILIKE $${paramIndex} OR 
        co.name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filter by creation date range
    if (dateFrom) {
      query += ` AND v.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      query += ` AND v.created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    // Filter by tour date range
    if (tourDateFrom) {
      query += ` AND v.tour_date >= $${paramIndex}`;
      params.push(tourDateFrom);
      paramIndex++;
    }
    if (tourDateTo) {
      query += ` AND v.tour_date <= $${paramIndex}`;
      params.push(tourDateTo);
      paramIndex++;
    }

    // Filter by payment status
    if (paymentStatus) {
      query += ` AND v.payment_status = $${paramIndex}`;
      params.push(paymentStatus);
      paramIndex++;
    }

    // Filter by company
    if (companyId) {
      query += ` AND v.company_id = $${paramIndex}`;
      params.push(companyId);
      paramIndex++;
    }

    query += ' ORDER BY v.created_at DESC LIMIT 200';

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

    let query = `
      SELECT 
        v.*,
        c.name as client_name,
        c.phone as client_phone,
        co.name as company_name,
        t.name as tour_name,
        t.tour_type as tour_type_name,
        u.full_name as manager_name,
        a.name as agent_name,
        a.commission_percentage as agent_commission
      FROM vouchers v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN companies co ON v.company_id = co.id
      LEFT JOIN tours t ON v.tour_id = t.id
      LEFT JOIN users u ON v.manager_id = u.id
      LEFT JOIN agents a ON v.agent_id = a.id
      WHERE v.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const voucher = result.rows[0];

    // Check access for managers
    if (user.role === 'manager' && voucher.manager_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get payments
    const paymentsResult = await pool.query(
      `SELECT p.*, co.name as company_name 
       FROM payments p
       LEFT JOIN companies co ON p.company_id = co.id
       WHERE p.voucher_id = $1
       ORDER BY p.payment_date DESC`,
      [id]
    );

    voucher.payments = paymentsResult.rows;

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
      tourType,
      clientId,
      companyId,
      tourId,
      tourDate,
      tourTime,
      hotelName,
      roomNumber,
      adults,
      children,
      infants,
      adultNet,
      childNet,
      infantNet,
      transferNet,
      otherNet,
      adultSale,
      childSale,
      infantSale,
      transferSale,
      otherSale,
      agentId,
      agentCommissionPercentage,
      remarks,
    } = req.body;

    // Validation
    if (!tourType || !clientId || !companyId || !tourId || !tourDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const voucherNumber = await generateVoucherNumber();
    const managerId = user.role === 'manager' ? user.id : req.body.managerId;

    const result = await client.query(
      `INSERT INTO vouchers (
        voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
        tour_date, tour_time, hotel_name, room_number,
        adults, children, infants,
        adult_net, child_net, infant_net, transfer_net, other_net,
        adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
        agent_id, agent_commission_percentage, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        voucherNumber, tourType, clientId, managerId, companyId, tourId,
        tourDate, tourTime, hotelName, roomNumber,
        adults || 0, children || 0, infants || 0,
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
        agentId, agentCommissionPercentage || 0, remarks,
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

    // Check access
    if (user.role === 'manager') {
      const check = await client.query('SELECT manager_id FROM vouchers WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const {
      tourDate,
      tourTime,
      hotelName,
      roomNumber,
      adults,
      children,
      infants,
      adultNet,
      childNet,
      infantNet,
      transferNet,
      otherNet,
      adultSale,
      childSale,
      infantSale,
      transferSale,
      otherSale,
      agentId,
      agentCommissionPercentage,
      remarks,
    } = req.body;

    const result = await client.query(
      `UPDATE vouchers SET
        tour_date = $1, tour_time = $2, hotel_name = $3, room_number = $4,
        adults = $5, children = $6, infants = $7,
        adult_net = $8, child_net = $9, infant_net = $10, transfer_net = $11, other_net = $12,
        adult_sale = $13, child_sale = $14, infant_sale = $15, transfer_sale = $16, other_sale = $17,
        agent_id = $18, agent_commission_percentage = $19, remarks = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *`,
      [
        tourDate, tourTime, hotelName, roomNumber,
        adults || 0, children || 0, infants || 0,
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
        agentId, agentCommissionPercentage || 0, remarks,
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

    // Check access
    if (user.role === 'manager') {
      const check = await pool.query('SELECT manager_id FROM vouchers WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await pool.query(
      `UPDATE vouchers 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
       WHERE id = $2`,
      [user.id, id]
    );

    res.json({ message: 'Voucher deleted' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const restoreVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    // Check access
    if (user.role === 'manager') {
      const check = await pool.query('SELECT manager_id FROM vouchers WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await pool.query(
      `UPDATE vouchers 
       SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Voucher restored' });
  } catch (error) {
    console.error('Restore voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const copyVoucher = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const user = req.user!;

    // Get original voucher
    const original = await client.query('SELECT * FROM vouchers WHERE id = $1', [id]);
    
    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const voucher = original.rows[0];

    // Check access
    if (user.role === 'manager' && voucher.manager_id !== user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    const voucherNumber = await generateVoucherNumber();

    const result = await client.query(
      `INSERT INTO vouchers (
        voucher_number, tour_type, client_id, manager_id, company_id, tour_id,
        tour_date, tour_time, hotel_name, room_number,
        adults, children, infants,
        adult_net, child_net, infant_net, transfer_net, other_net,
        adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
        agent_id, agent_commission_percentage, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        voucherNumber, voucher.tour_type, voucher.client_id, voucher.manager_id,
        voucher.company_id, voucher.tour_id, voucher.tour_date, voucher.tour_time,
        voucher.hotel_name, voucher.room_number, voucher.adults, voucher.children,
        voucher.infants, voucher.adult_net, voucher.child_net, voucher.infant_net,
        voucher.transfer_net, voucher.other_net, voucher.adult_sale, voucher.child_sale,
        voucher.infant_sale, voucher.transfer_sale, voucher.other_sale,
        voucher.agent_id, voucher.agent_commission_percentage, voucher.remarks,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Copy voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Get tour prices for specific date
export const getTourPrices = async (req: AuthRequest, res: Response) => {
  try {
    const { tourId, companyId, date } = req.query;

    if (!tourId || !companyId || !date) {
      return res.status(400).json({ error: 'tourId, companyId, and date required' });
    }

    const result = await pool.query(
      `SELECT * FROM tour_prices 
       WHERE tour_id = $1 AND company_id = $2 
       AND $3 BETWEEN valid_from AND valid_to
       AND is_active = true
       LIMIT 1`,
      [tourId, companyId, date]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get tour prices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
