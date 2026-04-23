import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

export const addPayment = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { voucherId, paymentDate, amount, paymentMethod, companyId, notes, isRefund } = req.body;
    const user = req.user!;

    if (!voucherId || !paymentDate || !amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const effectiveMethod = paymentMethod || 'Не указан';
    const refund = !!isRefund;

    // Check voucher exists and user has access
    const voucherCheck = await client.query(
      'SELECT manager_id, company_id FROM vouchers WHERE id = $1',
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
      `INSERT INTO payments (voucher_id, payment_date, amount, payment_method, company_id, notes, is_refund, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [voucherId, paymentDate, amount, effectiveMethod, companyId, notes, refund, user.id]
    );

    const newPayment = result.rows[0];
    const voucherCompanyId = voucherCheck.rows[0].company_id;

    // Auto-sync: create accounting_entries record for this payment
    try {
      const voucherInfo = await client.query(
        `SELECT v.voucher_number, COALESCE(v.currency, 'THB') as currency, c.name as client_name
         FROM vouchers v
         LEFT JOIN clients c ON v.client_id = c.id
         WHERE v.id = $1`,
        [voucherId]
      );
      const vInfo = voucherInfo.rows[0];
      const counterparty = vInfo ? `Ваучер ${vInfo.voucher_number}${vInfo.client_name ? ' — ' + vInfo.client_name : ''}` : `Ваучер #${voucherId}`;
      const voucherCurrency = vInfo?.currency || 'THB';

      // For "Депозит в компанию": use explicitly passed companyId if provided, else fall back to voucher's company
      const depositTargetCompanyId = (effectiveMethod === 'Депозит в компанию' && companyId)
        ? companyId
        : voucherCompanyId;

      if (refund) {
        await client.query(
          `INSERT INTO accounting_entries
             (entry_date, entry_type, payment_method, counterparty_name, amount, notes, source, payment_id, currency, created_by)
           VALUES ($1, 'expense', $2, $3, $4, $5, 'auto', $6, $7, $8)`,
          [paymentDate, effectiveMethod, `Возврат: ${counterparty}`, amount, notes || null, newPayment.id, voucherCurrency, user.id]
        );
      } else if (effectiveMethod === 'Депозит в компанию') {
        await client.query(
          `INSERT INTO accounting_entries
             (entry_date, entry_type, payment_method, counterparty_name, company_id, amount, notes, category, source, payment_id, requires_confirmation, currency, created_by)
           VALUES ($1, 'expense', $2, $3, $4, $5, $6, 'Депозит в компанию', 'auto', $7, true, $8, $9)`,
          [paymentDate, effectiveMethod, counterparty, depositTargetCompanyId, amount, notes || null, newPayment.id, voucherCurrency, user.id]
        );
      } else {
        await client.query(
          `INSERT INTO accounting_entries
             (entry_date, entry_type, payment_method, counterparty_name, amount, notes, source, payment_id, currency, created_by)
           VALUES ($1, 'income', $2, $3, $4, $5, 'auto', $6, $7, $8)`,
          [paymentDate, effectiveMethod, counterparty, amount, notes || null, newPayment.id, voucherCurrency, user.id]
        );
      }
    } catch (syncErr) {
      console.error('Auto-sync accounting_entries warning:', syncErr);
      // Non-fatal: payment was saved, just sync failed
    }

    await client.query('COMMIT');
    res.status(201).json(newPayment);
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

    // Sync currency on the linked accounting entry
    await client.query(`
      UPDATE accounting_entries ae
      SET currency = COALESCE(v.currency, 'THB'),
          entry_date = $1,
          amount = $2,
          payment_method = $3
      FROM payments p
      JOIN vouchers v ON p.voucher_id = v.id
      WHERE ae.payment_id = p.id AND p.id = $4
    `, [paymentDate, amount, paymentMethod, id]);

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

    await client.query('DELETE FROM accounting_entries WHERE payment_id = $1', [id]);
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
