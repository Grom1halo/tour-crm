import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

// ===== TAB 1: CASH FLOW =====

export const getCashflow = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const from = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = dateTo || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT ae.*, c.name AS company_name, u.full_name AS employee_name,
              v.voucher_number AS linked_voucher_number,
              p.voucher_id AS linked_voucher_id
       FROM accounting_entries ae
       LEFT JOIN companies c ON ae.company_id = c.id
       LEFT JOIN users u ON ae.user_id = u.id
       LEFT JOIN payments p ON ae.payment_id = p.id
       LEFT JOIN vouchers v ON p.voucher_id = v.id
       WHERE ae.entry_date >= $1 AND ae.entry_date <= $2
       ORDER BY ae.entry_date ASC, ae.created_at ASC`,
      [from, to]
    );

    // Calculate running balance
    let runningBalance = 0;
    const entries = result.rows.map(row => {
      const amount = parseFloat(row.amount);
      if (row.entry_type === 'income') {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      return { ...row, running_balance: runningBalance };
    });

    const totalIncome = result.rows
      .filter(r => r.entry_type === 'income')
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const totalExpense = result.rows
      .filter(r => r.entry_type === 'expense')
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    res.json({
      entries,
      summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        balance: totalIncome - totalExpense,
      },
    });
  } catch (error) {
    console.error('getCashflow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addCashflowEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { entryDate, entryType, paymentMethod, counterpartyName, companyId, userId, amount, notes, category, invoiceNumber } = req.body;
    const user = req.user!;

    if (!entryDate || !entryType || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO accounting_entries
         (entry_date, entry_type, payment_method, counterparty_name, company_id, user_id, amount, notes, category, invoice_number, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual', $11)
       RETURNING *`,
      [entryDate, entryType, paymentMethod || null, counterpartyName || null,
       companyId || null, userId || null, amount, notes || null, category || null, invoiceNumber || null, user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('addCashflowEntry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCashflowEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { entryDate, entryType, paymentMethod, counterpartyName, companyId, userId, amount, notes } = req.body;

    // Only allow editing manual entries
    const check = await pool.query('SELECT source FROM accounting_entries WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    if (check.rows[0].source !== 'manual') return res.status(400).json({ error: 'Cannot edit auto-generated entries' });

    const { category, invoiceNumber } = req.body;
    const result = await pool.query(
      `UPDATE accounting_entries
       SET entry_date = $1, entry_type = $2, payment_method = $3, counterparty_name = $4,
           company_id = $5, user_id = $6, amount = $7, notes = $8, category = $9, invoice_number = $10
       WHERE id = $11
       RETURNING *`,
      [entryDate, entryType, paymentMethod || null, counterpartyName || null,
       companyId || null, userId || null, amount, notes || null, category || null, invoiceNumber || null, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateCashflowEntry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCashflowEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const check = await pool.query('SELECT source FROM accounting_entries WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    if (check.rows[0].source !== 'manual') return res.status(400).json({ error: 'Cannot delete auto-generated entries' });

    await pool.query('DELETE FROM accounting_entries WHERE id = $1', [id]);
    res.json({ message: 'Entry deleted' });
  } catch (error) {
    console.error('deleteCashflowEntry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== TAB 2: OPERATOR RECONCILIATION =====

export const getOperatorReconciliation = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, allTime, currency } = req.query;
    const isAllTime = allTime === 'true';
    const from = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = dateTo || new Date().toISOString().split('T')[0];
    const cur = currency ? String(currency) : null;

    // Helper: currency match expression using COALESCE for old data without currency set
    // Old THB vouchers may have currency=NULL — treat them as THB
    // $C is the placeholder position for the currency param
    const currencyMatch = (vAlias: string, pIdx: number) =>
      `COALESCE(${vAlias}.currency, 'THB') = $${pIdx}`;

    let result;

    if (isAllTime) {
      // params: [$1=cur] if filtering, else []
      const params: any[] = cur ? [cur] : [];
      const vCond = cur ? `AND ${currencyMatch('v', 1)}` : '';
      const havingClause = cur
        ? `HAVING COUNT(DISTINCT CASE WHEN v.is_deleted = false AND ${currencyMatch('v', 1)} THEN v.id END) > 0`
        : '';
      // For sent: join through payments→vouchers to filter by currency; manual entries assumed THB
      const sentFilter = cur
        ? `AND (pv.id IS NULL AND $1 = 'THB' OR COALESCE(pv.currency, 'THB') = $1)`
        : '';

      result = await pool.query(
        `SELECT
           c.id AS company_id,
           c.name AS company_name,
           COALESCE(SUM(CASE WHEN v.is_deleted = false ${vCond}
             THEN GREATEST(v.total_net - COALESCE(v.cash_on_tour, 0), 0) END), 0) AS total_owed_to_operator,
           COALESCE((
             SELECT SUM(ae2.amount)
             FROM accounting_entries ae2
             LEFT JOIN payments p2 ON ae2.payment_id = p2.id
             LEFT JOIN vouchers pv ON p2.voucher_id = pv.id
             WHERE ae2.company_id = c.id AND ae2.entry_type = 'expense'
             ${sentFilter}
           ), 0) AS total_sent_to_operator,
           COUNT(DISTINCT CASE WHEN v.is_deleted = false ${vCond} THEN v.id END) AS voucher_count,
           COALESCE(json_agg(DISTINCT jsonb_build_object(
             'id', v.id,
             'voucher_number', v.voucher_number,
             'tour_date', v.tour_date,
             'total_net', v.total_net,
             'cash_on_tour', v.cash_on_tour,
             'total_sale', v.total_sale,
             'payment_status', v.payment_status,
             'operator_paid', v.operator_paid
           )) FILTER (WHERE v.id IS NOT NULL AND v.is_deleted = false ${vCond}), '[]') AS vouchers
         FROM companies c
         LEFT JOIN vouchers v ON v.company_id = c.id
         WHERE c.is_active = true
         GROUP BY c.id, c.name
         ${havingClause}
         ORDER BY c.name`,
        params
      );
    } else {
      // params: [$1=from, $2=to, $3=cur] or [$1=from, $2=to]
      const params: any[] = cur ? [from, to, cur] : [from, to];
      const pCur = 3; // currency is always $3 when present
      const dateCond = `v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date`;
      const vCond = cur ? `AND ${currencyMatch('v', pCur)}` : '';
      const havingClause = cur
        ? `HAVING COUNT(DISTINCT CASE WHEN v.is_deleted = false AND ${dateCond} AND ${currencyMatch('v', pCur)} THEN v.id END) > 0`
        : '';
      const sentFilter = cur
        ? `AND ae2.entry_date >= $1::date AND ae2.entry_date <= $2::date
           AND (pv.id IS NULL AND $3 = 'THB' OR COALESCE(pv.currency, 'THB') = $3)`
        : `AND ae2.entry_date >= $1::date AND ae2.entry_date <= $2::date`;

      result = await pool.query(
        `SELECT
           c.id AS company_id,
           c.name AS company_name,
           COALESCE(SUM(CASE
             WHEN v.is_deleted = false AND ${dateCond} ${vCond}
             THEN GREATEST(v.total_net - COALESCE(v.cash_on_tour, 0), 0) END), 0) AS total_owed_to_operator,
           COALESCE((
             SELECT SUM(ae2.amount)
             FROM accounting_entries ae2
             LEFT JOIN payments p2 ON ae2.payment_id = p2.id
             LEFT JOIN vouchers pv ON p2.voucher_id = pv.id
             WHERE ae2.company_id = c.id AND ae2.entry_type = 'expense'
             ${sentFilter}
           ), 0) AS total_sent_to_operator,
           COUNT(DISTINCT CASE WHEN v.is_deleted = false AND ${dateCond} ${vCond} THEN v.id END) AS voucher_count,
           COALESCE(json_agg(DISTINCT jsonb_build_object(
             'id', v.id,
             'voucher_number', v.voucher_number,
             'tour_date', v.tour_date,
             'total_net', v.total_net,
             'cash_on_tour', v.cash_on_tour,
             'total_sale', v.total_sale,
             'payment_status', v.payment_status,
             'operator_paid', v.operator_paid
           )) FILTER (WHERE v.id IS NOT NULL AND v.is_deleted = false AND ${dateCond} ${vCond}),
           '[]') AS vouchers
         FROM companies c
         LEFT JOIN vouchers v ON v.company_id = c.id
         WHERE c.is_active = true
         GROUP BY c.id, c.name
         ${havingClause}
         ORDER BY c.name`,
        params
      );
    }

    // Add balance = sent - owed (positive = overpaid, negative = still owe)
    const rows = result.rows.map(r => ({
      ...r,
      balance: parseFloat(r.total_sent_to_operator) - parseFloat(r.total_owed_to_operator),
    }));

    res.json(rows);
  } catch (error) {
    console.error('getOperatorReconciliation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== OPERATOR PAYMENT (batch mark vouchers as paid) =====

export const payOperatorVouchers = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = req.user!;
    const { voucherIds, companyId, paymentDate, paymentMethod, amount, notes } = req.body;

    if (!voucherIds || !voucherIds.length || !companyId || !paymentDate || !amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mark vouchers as operator_paid
    await client.query(
      `UPDATE vouchers SET operator_paid = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::int[]) AND company_id = $2`,
      [voucherIds, companyId]
    );

    // Get company name for accounting entry
    const companyRes = await client.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const companyName = companyRes.rows[0]?.name || `Компания #${companyId}`;

    // Create accounting entry (expense = отправили деньги оператору)
    await client.query(
      `INSERT INTO accounting_entries
         (entry_date, entry_type, payment_method, counterparty_name, company_id, amount, notes, category, source, created_by)
       VALUES ($1, 'expense', $2, $3, $4, $5, $6, 'Оплата оператору', 'manual', $7)`,
      [paymentDate, paymentMethod || null, companyName, companyId, amount, notes || null, user.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Operator payment recorded', voucherCount: voucherIds.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('payOperatorVouchers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ===== OPERATOR DEBT WRITE-OFF (direct accounting entry, no voucher binding) =====

export const writeOffOperatorDebt = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = req.user!;
    const { companyId, amount, paymentDate, paymentMethod, notes, category, markAllPaid } = req.body;

    if (!companyId || !amount || !paymentDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields: companyId, amount, paymentDate' });
    }

    const companyRes = await client.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const companyName = companyRes.rows[0]?.name || `Компания #${companyId}`;

    // Create accounting entry
    await client.query(
      `INSERT INTO accounting_entries
         (entry_date, entry_type, payment_method, counterparty_name, company_id, amount, notes, category, source, created_by)
       VALUES ($1, 'expense', $2, $3, $4, $5, $6, $7, 'manual', $8)`,
      [
        paymentDate,
        paymentMethod || null,
        companyName,
        companyId,
        amount,
        notes || null,
        category || 'Оплата оператору',
        user.id,
      ]
    );

    // Optionally mark all unpaid vouchers for this company as operator_paid
    let markedCount = 0;
    if (markAllPaid) {
      const upd = await client.query(
        `UPDATE vouchers SET operator_paid = true, updated_at = CURRENT_TIMESTAMP
         WHERE company_id = $1 AND operator_paid = false AND is_deleted = false`,
        [companyId]
      );
      markedCount = upd.rowCount ?? 0;
    }

    await client.query('COMMIT');
    res.json({ message: 'Write-off recorded', markedCount });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('writeOffOperatorDebt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ===== TAB 3: EMPLOYEES =====

export const getEmployeeData = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const from = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = dateTo || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT
         u.id, u.full_name, u.role, u.commission_percentage,
         COALESCE(u.base_salary, 0) AS base_salary,
         COALESCE(SUM(ep.amount), 0) AS total_paid,
         COALESCE(json_agg(json_build_object(
           'id', ep.id,
           'payment_date', ep.payment_date,
           'amount', ep.amount,
           'payment_type', ep.payment_type,
           'payment_method', ep.payment_method,
           'notes', ep.notes
         ) ORDER BY ep.payment_date) FILTER (WHERE ep.id IS NOT NULL), '[]') AS payments,
         COALESCE((
           SELECT ROUND(
             SUM(
               CASE WHEN v.agent_id IS NOT NULL
                 THEN (v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)
                 ELSE (v.total_sale - v.total_net) END
             ) * COALESCE(u.commission_percentage, 0) / 100.0
           )
           FROM vouchers v
           WHERE v.manager_id = u.id
             AND v.is_deleted = false
             AND v.tour_date::date >= $1::date
             AND v.tour_date::date <= $2::date
         ), 0) AS calculated_salary
       FROM users u
       LEFT JOIN employee_payments ep ON ep.user_id = u.id
         AND ep.payment_date >= $1::date
         AND ep.payment_date <= $2::date
       WHERE u.is_active = true
       GROUP BY u.id, u.full_name, u.role, u.commission_percentage, u.base_salary
       ORDER BY u.full_name`,
      [from, to]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('getEmployeeData error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addEmployeePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, paymentDate, amount, paymentType, paymentMethod, notes } = req.body;
    const user = req.user!;

    if (!userId || !paymentDate || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO employee_payments
         (user_id, payment_date, amount, payment_type, payment_method, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, paymentDate, amount, paymentType || 'salary', paymentMethod || null, notes || null, user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('addEmployeePayment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEmployeePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentDate, amount, paymentType, paymentMethod, notes } = req.body;

    const result = await pool.query(
      `UPDATE employee_payments
       SET payment_date = $1, amount = $2, payment_type = $3, payment_method = $4, notes = $5
       WHERE id = $6
       RETURNING *`,
      [paymentDate, amount, paymentType || 'salary', paymentMethod || null, notes || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateEmployeePayment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEmployeePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT id FROM employee_payments WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    await pool.query('DELETE FROM employee_payments WHERE id = $1', [id]);
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    console.error('deleteEmployeePayment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEmployeeSalary = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { baseSalary, commissionPercentage } = req.body;

    // Support both: commissionPercentage (new) and baseSalary (legacy)
    if (commissionPercentage !== undefined) {
      const result = await pool.query(
        'UPDATE users SET commission_percentage = $1 WHERE id = $2 RETURNING id, full_name, commission_percentage',
        [commissionPercentage, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.json(result.rows[0]);
    }

    // Legacy: update base_salary
    const result = await pool.query(
      'UPDATE users SET base_salary = $1 WHERE id = $2 RETURNING id, full_name, base_salary',
      [baseSalary, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateEmployeeSalary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== DASHBOARD =====

export const getAccountingDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const [cashByMethodRes, revenueRes, todayRes, operatorDebtRes, salaryRes] = await Promise.all([
      // Cash by payment method (all-time balance)
      pool.query(`
        SELECT payment_method,
          SUM(CASE WHEN entry_type='income' THEN amount ELSE -amount END) as balance
        FROM accounting_entries
        WHERE payment_method IS NOT NULL AND payment_method != ''
        GROUP BY payment_method
        ORDER BY balance DESC
      `),

      // This month revenue from vouchers
      pool.query(`
        SELECT
          COALESCE(SUM(total_sale), 0) as total_sale,
          COALESCE(SUM(total_net), 0) as total_net,
          COALESCE(SUM(total_sale - total_net), 0) as profit
        FROM vouchers
        WHERE is_deleted = false AND created_at::date >= $1
      `, [monthStart]),

      // Today's revenue
      pool.query(`
        SELECT
          COALESCE(SUM(total_sale), 0) as total_sale,
          COALESCE(SUM(total_sale - total_net), 0) as profit
        FROM vouchers
        WHERE is_deleted = false AND created_at::date = $1
      `, [today]),

      // Operator debt split by currency (THB and VND separately to avoid mixing)
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN thb_owed > thb_sent THEN thb_owed - thb_sent ELSE 0 END), 0) as total_debt_thb,
          COALESCE(SUM(CASE WHEN vnd_owed > 0 THEN vnd_owed ELSE 0 END), 0) as total_debt_vnd
        FROM (
          SELECT c.id,
            -- THB debt
            COALESCE(SUM(GREATEST(v.total_net - COALESCE(v.cash_on_tour,0), 0))
              FILTER (WHERE v.is_deleted = false AND COALESCE(v.currency,'THB') = 'THB'), 0) as thb_owed,
            COALESCE((
              SELECT SUM(ae.amount) FROM accounting_entries ae
              LEFT JOIN payments p ON ae.payment_id = p.id
              LEFT JOIN vouchers pv ON p.voucher_id = pv.id
              WHERE ae.company_id = c.id AND ae.entry_type = 'expense'
              AND (pv.id IS NULL OR COALESCE(pv.currency,'THB') = 'THB')
            ), 0) as thb_sent,
            -- VND debt (no sent tracking yet)
            COALESCE(SUM(GREATEST(v.total_net - COALESCE(v.cash_on_tour,0), 0))
              FILTER (WHERE v.is_deleted = false AND v.currency = 'VND'), 0) as vnd_owed
          FROM companies c
          LEFT JOIN vouchers v ON v.company_id = c.id
          WHERE c.is_active = true
          GROUP BY c.id
        ) sub
      `),

      // Salaries this month: calculated (base_salary sum) vs paid
      pool.query(`
        SELECT
          COALESCE(SUM(u.base_salary), 0) as calculated,
          COALESCE(SUM(ep.paid), 0) as paid
        FROM users u
        LEFT JOIN (
          SELECT user_id, SUM(amount) as paid
          FROM employee_payments
          WHERE payment_date::date >= $1
          GROUP BY user_id
        ) ep ON ep.user_id = u.id
        WHERE u.is_active = true
      `, [monthStart]),
    ]);

    const calculated = parseFloat(salaryRes.rows[0]?.calculated || 0);
    const paid = parseFloat(salaryRes.rows[0]?.paid || 0);

    res.json({
      cashByMethod: cashByMethodRes.rows,
      thisMonth: {
        totalSale: parseFloat(revenueRes.rows[0]?.total_sale || 0),
        totalNet: parseFloat(revenueRes.rows[0]?.total_net || 0),
        profit: parseFloat(revenueRes.rows[0]?.profit || 0),
        today: {
          totalSale: parseFloat(todayRes.rows[0]?.total_sale || 0),
          profit: parseFloat(todayRes.rows[0]?.profit || 0),
        },
      },
      operatorDebt: parseFloat(operatorDebtRes.rows[0]?.total_debt_thb || 0),
      operatorDebtVND: parseFloat(operatorDebtRes.rows[0]?.total_debt_vnd || 0),
      salaries: {
        calculated,
        paid,
        remaining: calculated - paid,
      },
    });
  } catch (error) {
    console.error('getAccountingDashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
