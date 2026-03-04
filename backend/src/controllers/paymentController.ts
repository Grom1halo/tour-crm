import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

export const addPayment = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { voucherId, paymentDate, amount, paymentMethod, companyId, notes } = req.body;
    const user = req.user!;

    if (!voucherId || !paymentDate || !amount || !paymentMethod) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check voucher exists and user has access
    const voucherCheck = await client.query(
      'SELECT manager_id FROM vouchers WHERE id = $1',
      [voucherId]
    );

    if (voucherCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Voucher not found' });
    }

    if (user.role === 'manager' && voucherCheck.rows[0].manager_id !== user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(
      `INSERT INTO payments (voucher_id, payment_date, amount, payment_method, company_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [voucherId, paymentDate, amount, paymentMethod, companyId, notes, user.id]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const updatePayment = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { paymentDate, amount, paymentMethod, companyId, notes } = req.body;
    const user = req.user!;

    // Check payment exists and user has access
    const paymentCheck = await client.query(
      `SELECT p.*, v.manager_id 
       FROM payments p
       JOIN vouchers v ON p.voucher_id = v.id
       WHERE p.id = $1`,
      [id]
    );

    if (paymentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (user.role === 'manager' && paymentCheck.rows[0].manager_id !== user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(
      `UPDATE payments 
       SET payment_date = $1, amount = $2, payment_method = $3, 
           company_id = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [paymentDate, amount, paymentMethod, companyId, notes, id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const deletePayment = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const user = req.user!;

    // Check payment exists and user has access
    const paymentCheck = await client.query(
      `SELECT p.*, v.manager_id 
       FROM payments p
       JOIN vouchers v ON p.voucher_id = v.id
       WHERE p.id = $1`,
      [id]
    );

    if (paymentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (user.role === 'manager' && paymentCheck.rows[0].manager_id !== user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    await client.query('DELETE FROM payments WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
