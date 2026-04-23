import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

// ===== TAB 1: CASH FLOW =====

export const getCashflow = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, currency } = req.query;
    const from = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = dateTo || new Date().toISOString().split('T')[0];
    const cur = currency ? String(currency) : null;

    const params: any[] = [from, to];
    const currencyFilter = cur ? `AND COALESCE(ae.currency, 'THB') = $${params.push(cur)}` : '';

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
       ${currencyFilter}
       ORDER BY ae.entry_date ASC, ae.created_at ASC`,
      params
    );

    // Calculate running balance
    let runningBalance = 0;
    const entries = result.rows.map(row => {
      const amount = parseFloat(row.amount);
      runningBalance += row.entry_type === 'income' ? amount : -amount;
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
        currency: cur || 'mixed',
      },
    });
  } catch (error) {
    console.error('getCashflow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPaymentMethodBalances = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(payment_method, 'Не указан') AS payment_method,
        COALESCE(currency, 'THB') AS currency,
        SUM(CASE WHEN entry_type = 'income' THEN amount ELSE -amount END) AS balance
      FROM accounting_entries
      GROUP BY payment_method, currency
      ORDER BY payment_method, currency
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('getPaymentMethodBalances error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addCashflowEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { entryDate, entryType, paymentMethod, counterpartyName, companyId, agentId, userId, amount, notes, category, invoiceNumber, currency } = req.body;
    const user = req.user!;

    if (!entryDate || !entryType || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO accounting_entries
         (entry_date, entry_type, payment_method, counterparty_name, company_id, agent_id, user_id, amount, notes, category, invoice_number, currency, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'manual', $13)
       RETURNING *`,
      [entryDate, entryType, paymentMethod || null, counterpartyName || null,
       companyId || null, agentId || null, userId || null, amount, notes || null, category || null, invoiceNumber || null,
       currency || 'THB', user.id]
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

    const { category, invoiceNumber, currency } = req.body;
    const result = await pool.query(
      `UPDATE accounting_entries
       SET entry_date = $1, entry_type = $2, payment_method = $3, counterparty_name = $4,
           company_id = $5, user_id = $6, amount = $7, notes = $8, category = $9, invoice_number = $10,
           currency = $11
       WHERE id = $12
       RETURNING *`,
      [entryDate, entryType, paymentMethod || null, counterpartyName || null,
       companyId || null, userId || null, amount, notes || null, category || null, invoiceNumber || null,
       currency || 'THB', id]
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
             THEN v.total_net END), 0) AS total_owed_to_operator,
           COALESCE((
             SELECT SUM(ae2.amount)
             FROM accounting_entries ae2
             LEFT JOIN payments p2 ON ae2.payment_id = p2.id
             LEFT JOIN vouchers pv ON p2.voucher_id = pv.id
             WHERE ae2.company_id = c.id AND ae2.entry_type = 'expense'
               AND (ae2.requires_confirmation IS NULL OR ae2.requires_confirmation = false)
             ${sentFilter}
           ), 0) AS total_sent_to_operator,
           COALESCE(SUM(CASE WHEN v.is_deleted = false ${vCond}
             THEN COALESCE(v.cash_on_tour, 0) END), 0) AS total_cash_on_tour,
           COUNT(DISTINCT CASE WHEN v.is_deleted = false ${vCond} THEN v.id END) AS voucher_count,
           COALESCE(json_agg(DISTINCT jsonb_build_object(
             'id', v.id,
             'voucher_number', v.voucher_number,
             'tour_date', v.tour_date,
             'total_net', v.total_net,
             'cash_on_tour', v.cash_on_tour,
             'deposit_in_company', COALESCE((SELECT SUM(p2.amount) FROM payments p2 WHERE p2.voucher_id = v.id AND p2.payment_method = 'Депозит в компанию' AND COALESCE(p2.company_id, v.company_id) = v.company_id), 0),
             'total_sale', v.total_sale,
             'payment_status', v.payment_status,
             'operator_paid', v.operator_paid,
             'operator_paid_date', v.operator_paid_date
           )) FILTER (WHERE v.id IS NOT NULL AND v.is_deleted = false ${vCond}), '[]') AS vouchers,
           (
             SELECT COALESCE(json_agg(jsonb_build_object(
               'payment_id', p_ext.id,
               'accounting_entry_id', ae_ext.id,
               'voucher_id', v_ext.id,
               'voucher_number', v_ext.voucher_number,
               'from_company_name', vc_ext.name,
               'amount', p_ext.amount,
               'payment_date', (p_ext.payment_date::date)::text,
               'requires_confirmation', COALESCE(ae_ext.requires_confirmation, false)
             ) ORDER BY p_ext.payment_date DESC), '[]')
             FROM payments p_ext
             JOIN vouchers v_ext ON p_ext.voucher_id = v_ext.id AND v_ext.is_deleted = false
             JOIN companies vc_ext ON v_ext.company_id = vc_ext.id
             LEFT JOIN accounting_entries ae_ext ON ae_ext.payment_id = p_ext.id
             WHERE p_ext.company_id = c.id
               AND p_ext.payment_method = 'Депозит в компанию'
               AND v_ext.company_id != c.id
           ) AS external_deposits,
           COALESCE((
             SELECT SUM(p_dep.amount)
             FROM payments p_dep
             JOIN vouchers v_dep ON p_dep.voucher_id = v_dep.id AND v_dep.is_deleted = false
             WHERE p_dep.company_id = c.id
               AND p_dep.payment_method = 'Депозит в компанию'
           ), 0) AS total_deposit_in_company,
           (
             SELECT COALESCE(json_agg(jsonb_build_object(
               'payment_id', p_dep.id,
               'accounting_entry_id', ae_dep.id,
               'voucher_id', v_dep.id,
               'voucher_number', v_dep.voucher_number,
               'from_company_name', vc_dep.name,
               'is_external', (v_dep.company_id != c.id),
               'amount', p_dep.amount,
               'payment_date', (p_dep.payment_date::date)::text,
               'requires_confirmation', COALESCE(ae_dep.requires_confirmation, false)
             ) ORDER BY p_dep.payment_date DESC), '[]')
             FROM payments p_dep
             JOIN vouchers v_dep ON p_dep.voucher_id = v_dep.id AND v_dep.is_deleted = false
             JOIN companies vc_dep ON v_dep.company_id = vc_dep.id
             LEFT JOIN accounting_entries ae_dep ON ae_dep.payment_id = p_dep.id
             WHERE p_dep.company_id = c.id
               AND p_dep.payment_method = 'Депозит в компанию'
           ) AS deposits_list
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
      // Balance (total_owed, total_sent) is ALWAYS ALL TIME — only voucher list is period-filtered
      const params: any[] = cur ? [from, to, cur] : [from, to];
      const pCur = 3; // currency is always $3 when present
      const dateCond = `v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date`;
      const vCond = cur ? `AND ${currencyMatch('v', pCur)}` : '';
      // HAVING: only show companies that have vouchers in the selected period
      const havingClause = cur
        ? `HAVING COUNT(DISTINCT CASE WHEN v.is_deleted = false AND ${dateCond} AND ${currencyMatch('v', pCur)} THEN v.id END) > 0`
        : `HAVING COUNT(DISTINCT CASE WHEN v.is_deleted = false AND ${dateCond} THEN v.id END) > 0`;
      // sentFilter: ALL TIME — no date restriction on payments sent to operator
      const sentFilter = cur
        ? `AND (pv.id IS NULL AND $${pCur} = 'THB' OR COALESCE(pv.currency, 'THB') = $${pCur})`
        : '';

      result = await pool.query(
        `SELECT
           c.id AS company_id,
           c.name AS company_name,
           -- Only unpaid vouchers count toward owed (operator_paid = false)
           COALESCE(SUM(CASE WHEN v.is_deleted = false ${vCond}
             THEN v.total_net END), 0) AS total_owed_to_operator,
           COALESCE((
             SELECT SUM(ae2.amount)
             FROM accounting_entries ae2
             LEFT JOIN payments p2 ON ae2.payment_id = p2.id
             LEFT JOIN vouchers pv ON p2.voucher_id = pv.id
             WHERE ae2.company_id = c.id AND ae2.entry_type = 'expense'
               AND (ae2.requires_confirmation IS NULL OR ae2.requires_confirmation = false)
             ${sentFilter}
           ), 0) AS total_sent_to_operator,
           COALESCE(SUM(CASE WHEN v.is_deleted = false ${vCond}
             THEN COALESCE(v.cash_on_tour, 0) END), 0) AS total_cash_on_tour,
           -- Voucher list is filtered by selected period
           COUNT(DISTINCT CASE WHEN v.is_deleted = false AND ${dateCond} ${vCond} THEN v.id END) AS voucher_count,
           COALESCE(json_agg(DISTINCT jsonb_build_object(
             'id', v.id,
             'voucher_number', v.voucher_number,
             'tour_date', v.tour_date,
             'total_net', v.total_net,
             'cash_on_tour', v.cash_on_tour,
             'deposit_in_company', COALESCE((SELECT SUM(p2.amount) FROM payments p2 WHERE p2.voucher_id = v.id AND p2.payment_method = 'Депозит в компанию' AND COALESCE(p2.company_id, v.company_id) = v.company_id), 0),
             'total_sale', v.total_sale,
             'payment_status', v.payment_status,
             'operator_paid', v.operator_paid,
             'operator_paid_date', v.operator_paid_date
           )) FILTER (WHERE v.id IS NOT NULL AND v.is_deleted = false AND ${dateCond} ${vCond}),
           '[]') AS vouchers,
           (
             SELECT COALESCE(json_agg(jsonb_build_object(
               'payment_id', p_ext.id,
               'accounting_entry_id', ae_ext.id,
               'voucher_id', v_ext.id,
               'voucher_number', v_ext.voucher_number,
               'from_company_name', vc_ext.name,
               'amount', p_ext.amount,
               'payment_date', (p_ext.payment_date::date)::text,
               'requires_confirmation', COALESCE(ae_ext.requires_confirmation, false)
             ) ORDER BY p_ext.payment_date DESC), '[]')
             FROM payments p_ext
             JOIN vouchers v_ext ON p_ext.voucher_id = v_ext.id AND v_ext.is_deleted = false
             JOIN companies vc_ext ON v_ext.company_id = vc_ext.id
             LEFT JOIN accounting_entries ae_ext ON ae_ext.payment_id = p_ext.id
             WHERE p_ext.company_id = c.id
               AND p_ext.payment_method = 'Депозит в компанию'
               AND v_ext.company_id != c.id
           ) AS external_deposits,
           COALESCE((
             SELECT SUM(p_dep.amount)
             FROM payments p_dep
             JOIN vouchers v_dep ON p_dep.voucher_id = v_dep.id AND v_dep.is_deleted = false
             WHERE p_dep.company_id = c.id
               AND p_dep.payment_method = 'Депозит в компанию'
           ), 0) AS total_deposit_in_company,
           (
             SELECT COALESCE(json_agg(jsonb_build_object(
               'payment_id', p_dep.id,
               'accounting_entry_id', ae_dep.id,
               'voucher_id', v_dep.id,
               'voucher_number', v_dep.voucher_number,
               'from_company_name', vc_dep.name,
               'is_external', (v_dep.company_id != c.id),
               'amount', p_dep.amount,
               'payment_date', (p_dep.payment_date::date)::text,
               'requires_confirmation', COALESCE(ae_dep.requires_confirmation, false)
             ) ORDER BY p_dep.payment_date DESC), '[]')
             FROM payments p_dep
             JOIN vouchers v_dep ON p_dep.voucher_id = v_dep.id AND v_dep.is_deleted = false
             JOIN companies vc_dep ON v_dep.company_id = vc_dep.id
             LEFT JOIN accounting_entries ae_dep ON ae_dep.payment_id = p_dep.id
             WHERE p_dep.company_id = c.id
               AND p_dep.payment_method = 'Депозит в компанию'
           ) AS deposits_list
         FROM companies c
         LEFT JOIN vouchers v ON v.company_id = c.id
         WHERE c.is_active = true
         GROUP BY c.id, c.name
         ${havingClause}
         ORDER BY c.name`,
        params
      );
    }

    // balance = (sent + cash_on_tour + deposits) - owed
    // cash_on_tour = operator collected from client directly on tour
    // deposits = client paid deposit directly to operator (Депозит в компанию)
    // both reduce what we still owe the operator
    const rows = result.rows.map(r => ({
      ...r,
      total_cash_on_tour: parseFloat(r.total_cash_on_tour || '0'),
      total_deposit_in_company: parseFloat(r.total_deposit_in_company || '0'),
      balance: parseFloat(r.total_sent_to_operator)
             + parseFloat(r.total_cash_on_tour || '0')
             + parseFloat(r.total_deposit_in_company || '0')
             - parseFloat(r.total_owed_to_operator),
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
      `UPDATE vouchers SET operator_paid = true, operator_paid_date = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::int[]) AND company_id = $2`,
      [voucherIds, companyId, paymentDate]
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
    const { companyId, paymentDate, paymentMethod, notes } = req.body;

    if (!companyId || !paymentDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields: companyId, paymentDate' });
    }

    const companyRes = await client.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const companyName = companyRes.rows[0]?.name || `Компания #${companyId}`;

    // Auto-calculate exact deficit: total owed (all vouchers) minus already sent
    const debtRes = await client.query(
      `SELECT
         COALESCE(SUM(GREATEST(v.total_net - COALESCE(v.cash_on_tour, 0), 0)), 0) AS total_owed,
         COALESCE((
           SELECT SUM(ae.amount) FROM accounting_entries ae
           WHERE ae.company_id = $1 AND ae.entry_type = 'expense'
         ), 0) AS total_sent
       FROM vouchers v
       WHERE v.company_id = $1 AND v.is_deleted = false`,
      [companyId]
    );
    const totalOwed = parseFloat(debtRes.rows[0].total_owed);
    const totalSent = parseFloat(debtRes.rows[0].total_sent);
    const deficit = totalOwed - totalSent;

    // Only create an accounting entry if there's an actual deficit
    if (deficit > 0.01) {
      await client.query(
        `INSERT INTO accounting_entries
           (entry_date, entry_type, payment_method, counterparty_name, company_id, amount, notes, category, source, created_by)
         VALUES ($1, 'expense', $2, $3, $4, $5, $6, 'Списание долга', 'manual', $7)`,
        [paymentDate, paymentMethod || null, companyName, companyId, deficit, notes || null, user.id]
      );
    }

    // Always mark ALL unpaid vouchers for this company as operator_paid
    const upd = await client.query(
      `UPDATE vouchers SET operator_paid = true, operator_paid_date = $2, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $1 AND operator_paid = false AND is_deleted = false`,
      [companyId, paymentDate]
    );
    const markedCount = upd.rowCount ?? 0;

    await client.query('COMMIT');
    res.json({ message: 'Write-off recorded', markedCount, deficitSettled: deficit > 0.01 ? deficit : 0 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('writeOffOperatorDebt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ===== COMPANY PAYMENT HISTORY =====

export const getCompanyPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ae.id, ae.entry_date, ae.entry_type, ae.payment_method, ae.amount, ae.notes, ae.category, ae.currency,
              ae.source, p.voucher_id,
              v.voucher_number AS linked_voucher_number,
              u.full_name AS created_by_name
       FROM accounting_entries ae
       LEFT JOIN payments p ON ae.payment_id = p.id
       LEFT JOIN vouchers v ON p.voucher_id = v.id
       LEFT JOIN users u ON ae.created_by = u.id
       WHERE ae.company_id = $1
       ORDER BY ae.entry_date DESC, ae.created_at DESC
       LIMIT 300`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('getCompanyPaymentHistory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== CLOSE HISTORICAL PERIOD (bulk mark operator_paid + write off deficit) =====

export const closeOperatorPeriod = async (req: AuthRequest, res: Response) => {
  const { beforeDate, currency, companyId } = req.body;
  const user = req.user!;
  if (!beforeDate) return res.status(400).json({ error: 'beforeDate required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find all companies that have unpaid vouchers before the cut-off date
    let companiesRes;
    if (companyId) {
      companiesRes = { rows: [{ company_id: Number(companyId) }] };
    } else {
      let findQ = `SELECT DISTINCT company_id FROM vouchers
                   WHERE operator_paid = false AND is_deleted = false AND tour_date < $1`;
      const findParams: any[] = [beforeDate];
      if (currency) { findQ += ` AND COALESCE(currency, 'THB') = $2`; findParams.push(currency); }
      companiesRes = await client.query(findQ, findParams);
    }

    let totalClosed = 0;
    let totalWrittenOff = 0;

    for (const row of companiesRes.rows) {
      const cId = row.company_id;

      // Calculate deficit for this company up to beforeDate.
      // Formula consistent with getOperatorReconciliation:
      //   balance = total_sent + cash_on_tour - total_net
      // So deficit (what we still owe) = total_net - cash_on_tour - total_sent_before_period
      // Only count expense entries dated before beforeDate to avoid counting
      // post-period payments against the pre-period deficit.
      const debtRes = await client.query(
        `SELECT
           COALESCE(SUM(v.total_net), 0) - COALESCE(SUM(v.cash_on_tour), 0) AS net_owed,
           COALESCE((
             SELECT SUM(ae.amount) FROM accounting_entries ae
             WHERE ae.company_id = $1 AND ae.entry_type = 'expense'
               AND ae.entry_date < $2
           ), 0) AS total_sent_before_period,
           COALESCE((
             SELECT SUM(p_dep.amount)
             FROM payments p_dep
             JOIN vouchers v_dep ON p_dep.voucher_id = v_dep.id AND v_dep.is_deleted = false
             WHERE p_dep.company_id = $1
               AND p_dep.payment_method = 'Депозит в компанию'
               AND p_dep.payment_date < $2
           ), 0) AS total_deposits_before_period
         FROM vouchers v
         WHERE v.company_id = $1 AND v.is_deleted = false AND v.tour_date < $2`,
        [cId, beforeDate]
      );
      const totalOwed = parseFloat(debtRes.rows[0].net_owed);
      const totalSent = parseFloat(debtRes.rows[0].total_sent_before_period);
      const totalDeposits = parseFloat(debtRes.rows[0].total_deposits_before_period);
      const deficit = totalOwed - totalSent - totalDeposits;

      // Only write off the debt portion — never create entries when balance is positive
      if (deficit > 0.01) {
        const companyRes = await client.query('SELECT name FROM companies WHERE id = $1', [cId]);
        const companyName = companyRes.rows[0]?.name || `Компания #${cId}`;

        await client.query(
          `INSERT INTO accounting_entries
             (entry_date, entry_type, payment_method, counterparty_name, company_id,
              amount, notes, category, source, created_by)
           VALUES ($1, 'expense', NULL, $2, $3, $4, $5, 'Списание долга', 'manual', $6)`,
          [beforeDate, companyName, cId, deficit,
           `Закрытие исторического долга (до ${beforeDate})`, user.id]
        );
        totalWrittenOff += deficit;
      }

      // Mark the affected vouchers as operator_paid
      let markQ = `UPDATE vouchers SET operator_paid = true, operator_paid_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
                   WHERE company_id = $1 AND is_deleted = false
                     AND tour_date < $2 AND operator_paid = false`;
      const markParams: any[] = [cId, beforeDate];
      if (currency) { markQ += ` AND COALESCE(currency, 'THB') = $3`; markParams.push(currency); }
      markQ += ' RETURNING id';

      const upd = await client.query(markQ, markParams);
      totalClosed += upd.rowCount ?? 0;
    }

    await client.query('COMMIT');
    res.json({
      closed: totalClosed,
      writtenOff: Math.round(totalWrittenOff),
      message: `Закрыто ваучеров: ${totalClosed}`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('closeOperatorPeriod error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ===== AGENT DEBT WRITE-OFF =====

export const writeOffAgentDebt = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = req.user!;
    const { agentId, paymentDate, paymentMethod, notes } = req.body;

    if (!agentId || !paymentDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields: agentId, paymentDate' });
    }

    const agentRes = await client.query('SELECT name FROM agents WHERE id = $1', [agentId]);
    const agentName = agentRes.rows[0]?.name || `Агент #${agentId}`;

    // Calculate deficit: total commission owed vs already paid
    const debtRes = await client.query(
      `SELECT
         COALESCE(SUM(ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0)), 0) AS total_owed,
         COALESCE((
           SELECT SUM(ae.amount) FROM accounting_entries ae
           WHERE ae.agent_id = $1 AND ae.entry_type = 'expense'
         ), 0) AS total_paid
       FROM vouchers v
       WHERE v.agent_id = $1 AND v.is_deleted = false AND v.agent_commission_percentage > 0`,
      [agentId]
    );
    const totalOwed = parseFloat(debtRes.rows[0].total_owed);
    const totalPaid = parseFloat(debtRes.rows[0].total_paid);
    const deficit = totalOwed - totalPaid;

    if (deficit > 0.01) {
      await client.query(
        `INSERT INTO accounting_entries
           (entry_date, entry_type, payment_method, counterparty_name, agent_id, amount, notes, category, source, created_by)
         VALUES ($1, 'expense', $2, $3, $4, $5, $6, 'Списание долга агенту', 'manual', $7)`,
        [paymentDate, paymentMethod || null, agentName, agentId, deficit, notes || null, user.id]
      );
    }

    // Mark ALL unpaid vouchers for this agent as agent_commission_paid
    const upd = await client.query(
      `UPDATE vouchers SET agent_commission_paid = true, agent_commission_paid_date = $1
       WHERE agent_id = $2 AND agent_commission_paid = false AND is_deleted = false`,
      [paymentDate, agentId]
    );

    await client.query('COMMIT');
    res.json({ markedCount: upd.rowCount ?? 0, deficitSettled: deficit > 0.01 ? deficit : 0 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('writeOffAgentDebt error:', error);
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
         -- calculated_salary per currency
         COALESCE((
           SELECT ROUND(SUM(
               CASE WHEN v.agent_id IS NOT NULL
                 THEN (v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)
                 ELSE (v.total_sale - v.total_net) END
             ) * COALESCE(u.commission_percentage, 0) / 100.0)
           FROM vouchers v WHERE v.manager_id = u.id AND v.is_deleted = false
             AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
             AND COALESCE(v.currency, 'THB') = 'THB'
         ), 0) AS calculated_salary_thb,
         COALESCE((
           SELECT ROUND(SUM(
               CASE WHEN v.agent_id IS NOT NULL
                 THEN (v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)
                 ELSE (v.total_sale - v.total_net) END
             ) * COALESCE(u.commission_percentage, 0) / 100.0)
           FROM vouchers v WHERE v.manager_id = u.id AND v.is_deleted = false
             AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
             AND v.currency = 'VND'
         ), 0) AS calculated_salary_vnd,
         COALESCE((
           SELECT ROUND(SUM(
               CASE WHEN v.agent_id IS NOT NULL
                 THEN (v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)
                 ELSE (v.total_sale - v.total_net) END
             ) * COALESCE(u.commission_percentage, 0) / 100.0)
           FROM vouchers v WHERE v.manager_id = u.id AND v.is_deleted = false
             AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date
             AND v.currency = 'USD'
         ), 0) AS calculated_salary_usd
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

// ===== TAB: AGENT RECONCILIATION =====

export const getAgentReconciliation = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, allTime } = req.query;
    const isAllTime = allTime === 'true';
    const from = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to   = dateTo   || new Date().toISOString().split('T')[0];

    let result;

    if (isAllTime) {
      result = await pool.query(
        `SELECT
           a.id AS agent_id,
           a.name AS agent_name,
           -- Balance is ALL TIME
           COALESCE(SUM(
             CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0
               THEN ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0)
               ELSE 0 END
           ), 0) AS total_commission_owed,
           COALESCE((
             SELECT SUM(ae2.amount) FROM accounting_entries ae2
             WHERE ae2.agent_id = a.id AND ae2.entry_type = 'expense'
           ), 0) AS total_paid_to_agent,
           -- Voucher list: ALL TIME too
           COUNT(DISTINCT CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0 THEN v.id END) AS voucher_count,
           COALESCE(json_agg(DISTINCT jsonb_build_object(
             'id', v.id,
             'voucher_number', v.voucher_number,
             'tour_date', v.tour_date,
             'total_sale', v.total_sale,
             'total_net', v.total_net,
             'currency', COALESCE(v.currency, 'THB'),
             'agent_commission_percentage', v.agent_commission_percentage,
             'commission_amount', ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0),
             'agent_commission_paid', COALESCE(v.agent_commission_paid, false),
             'agent_commission_paid_date', v.agent_commission_paid_date
           )) FILTER (WHERE v.id IS NOT NULL AND v.is_deleted = false AND v.agent_commission_percentage > 0),
           '[]') AS vouchers
         FROM agents a
         JOIN vouchers v ON v.agent_id = a.id
         WHERE a.is_active = true
         GROUP BY a.id, a.name
         HAVING COUNT(DISTINCT CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0 THEN v.id END) > 0
         ORDER BY a.name`,
        []
      );
    } else {
      result = await pool.query(
        `SELECT
           a.id AS agent_id,
           a.name AS agent_name,
           -- Balance is ALL TIME
           COALESCE(SUM(
             CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0
               THEN ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0)
               ELSE 0 END
           ), 0) AS total_commission_owed,
           COALESCE((
             SELECT SUM(ae2.amount) FROM accounting_entries ae2
             WHERE ae2.agent_id = a.id AND ae2.entry_type = 'expense'
           ), 0) AS total_paid_to_agent,
           -- Voucher list: filtered by period
           COUNT(DISTINCT CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0
             AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date THEN v.id END) AS voucher_count,
           COALESCE(json_agg(DISTINCT jsonb_build_object(
             'id', v.id,
             'voucher_number', v.voucher_number,
             'tour_date', v.tour_date,
             'total_sale', v.total_sale,
             'total_net', v.total_net,
             'currency', COALESCE(v.currency, 'THB'),
             'agent_commission_percentage', v.agent_commission_percentage,
             'commission_amount', ROUND((v.total_sale - v.total_net) * v.agent_commission_percentage / 100.0),
             'agent_commission_paid', COALESCE(v.agent_commission_paid, false),
             'agent_commission_paid_date', v.agent_commission_paid_date
           )) FILTER (WHERE v.id IS NOT NULL AND v.is_deleted = false AND v.agent_commission_percentage > 0
             AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date),
           '[]') AS vouchers
         FROM agents a
         JOIN vouchers v ON v.agent_id = a.id
         WHERE a.is_active = true
         GROUP BY a.id, a.name
         HAVING COUNT(DISTINCT CASE WHEN v.is_deleted = false AND v.agent_commission_percentage > 0
           AND v.tour_date::date >= $1::date AND v.tour_date::date <= $2::date THEN v.id END) > 0
         ORDER BY a.name`,
        [from, to]
      );
    }

    const rows = result.rows.map(r => ({
      ...r,
      balance: parseFloat(r.total_paid_to_agent) - parseFloat(r.total_commission_owed),
    }));

    res.json(rows);
  } catch (error) {
    console.error('getAgentReconciliation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const payAgentVouchers = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = req.user!;
    const { voucherIds, agentId, paymentDate, paymentMethod, amount, notes } = req.body;

    if (!voucherIds || !voucherIds.length || !agentId || !paymentDate || !amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mark vouchers as agent_commission_paid
    await client.query(
      `UPDATE vouchers SET agent_commission_paid = true, agent_commission_paid_date = $1
       WHERE id = ANY($2::int[]) AND agent_id = $3`,
      [paymentDate, voucherIds, agentId]
    );

    // Get agent name for accounting entry
    const agentRes = await client.query('SELECT name FROM agents WHERE id = $1', [agentId]);
    const agentName = agentRes.rows[0]?.name || `Агент #${agentId}`;

    // Create accounting entry (expense = выплатили агенту)
    await client.query(
      `INSERT INTO accounting_entries
         (entry_date, entry_type, payment_method, counterparty_name, agent_id, amount, notes, category, source, created_by)
       VALUES ($1, 'expense', $2, $3, $4, $5, $6, 'Комиссия агенту', 'manual', $7)`,
      [paymentDate, paymentMethod || null, agentName, agentId, amount, notes || null, user.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Agent payment recorded', voucherCount: voucherIds.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('payAgentVouchers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ===== REVENUE BREAKDOWN =====

export const getRevenueBreakdown = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, currency, dateType = 'sale' } = req.query;
    const from = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = dateTo || new Date().toISOString().split('T')[0];
    const dateField = dateType === 'tour' ? 'v.tour_date::date' : 'v.created_at::date';

    const params: any[] = [from, to];
    let currencyFilter = '';
    if (currency && currency !== 'all') {
      currencyFilter = currency === 'THB'
        ? ` AND COALESCE(v.currency, 'THB') = 'THB'`
        : ` AND v.currency = $3`;
      if (currency !== 'THB') params.push(currency);
    }

    // Main revenue query
    const revenueRes = await pool.query(
      `SELECT
        COUNT(v.id) AS voucher_count,
        SUM(v.adults + v.children) AS total_pax,
        COALESCE(SUM(v.total_sale), 0) AS total_sale,
        COALESCE(SUM(v.total_net), 0) AS total_net,
        COALESCE(SUM(v.total_sale - v.total_net), 0) AS gross_profit,
        COALESCE(SUM(
          CASE WHEN v.agent_id IS NOT NULL
            THEN ROUND((v.total_sale - v.total_net) * COALESCE(v.agent_commission_percentage, 0) / 100.0)
            ELSE 0 END
        ), 0) AS agent_commissions,
        COALESCE(SUM(
          CASE WHEN v.agent_id IS NOT NULL
            THEN ROUND((v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0))
            ELSE (v.total_sale - v.total_net) END
        ), 0) AS profit_after_agent,
        COALESCE(SUM(
          ROUND(
            CASE WHEN v.agent_id IS NOT NULL
              THEN (v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)
              ELSE (v.total_sale - v.total_net) END
            * COALESCE(u.commission_percentage, 0) / 100.0
          )
        ), 0) AS manager_commissions
      FROM vouchers v
      JOIN users u ON v.manager_id = u.id
      WHERE v.is_deleted = false
        AND ${dateField} >= $1::date
        AND ${dateField} <= $2::date
        ${currencyFilter}`,
      params
    );

    // Manager breakdown
    const byManagerRes = await pool.query(
      `SELECT
        u.id AS manager_id,
        u.full_name AS manager_name,
        COALESCE(u.commission_percentage, 0) AS commission_pct,
        COUNT(v.id) AS voucher_count,
        COALESCE(SUM(v.total_sale), 0) AS total_sale,
        COALESCE(SUM(v.total_net), 0) AS total_net,
        COALESCE(SUM(v.total_sale - v.total_net), 0) AS gross_profit,
        COALESCE(SUM(
          CASE WHEN v.agent_id IS NOT NULL
            THEN ROUND((v.total_sale - v.total_net) * COALESCE(v.agent_commission_percentage, 0) / 100.0)
            ELSE 0 END
        ), 0) AS agent_commissions,
        COALESCE(SUM(
          CASE WHEN v.agent_id IS NOT NULL
            THEN ROUND((v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0))
            ELSE (v.total_sale - v.total_net) END
        ), 0) AS profit_after_agent,
        COALESCE(SUM(
          ROUND(
            CASE WHEN v.agent_id IS NOT NULL
              THEN (v.total_sale - v.total_net) * (1 - COALESCE(v.agent_commission_percentage, 0) / 100.0)
              ELSE (v.total_sale - v.total_net) END
            * COALESCE(u.commission_percentage, 0) / 100.0
          )
        ), 0) AS manager_pay
      FROM vouchers v
      JOIN users u ON v.manager_id = u.id
      WHERE v.is_deleted = false
        AND ${dateField} >= $1::date
        AND ${dateField} <= $2::date
        ${currencyFilter}
      GROUP BY u.id, u.full_name, u.commission_percentage
      ORDER BY total_sale DESC`,
      params
    );

    // Paid employee salaries for the period
    const salariesRes = await pool.query(
      `SELECT
        u.full_name,
        COALESCE(SUM(ep.amount), 0) AS paid
      FROM employee_payments ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.payment_date >= $1::date AND ep.payment_date <= $2::date
      GROUP BY u.id, u.full_name
      ORDER BY u.full_name`,
      [from, to]
    );

    // Operating expenses from cashflow (non-operator entries) for the period
    const expensesRes = await pool.query(
      `SELECT
        COALESCE(ae.category, 'Прочее') AS category,
        COALESCE(SUM(ae.amount), 0) AS total
      FROM accounting_entries ae
      WHERE ae.entry_type = 'expense'
        AND ae.entry_date >= $1::date
        AND ae.entry_date <= $2::date
      GROUP BY ae.category
      ORDER BY total DESC`,
      [from, to]
    );

    const r = revenueRes.rows[0];
    const totalSale = parseFloat(r.total_sale);
    const totalNet = parseFloat(r.total_net);
    const grossProfit = parseFloat(r.gross_profit);
    const agentCommissions = parseFloat(r.agent_commissions);
    const profitAfterAgent = parseFloat(r.profit_after_agent);
    const managerCommissions = parseFloat(r.manager_commissions);

    const totalEmployeePaid = salariesRes.rows.reduce((s: number, row: any) => s + parseFloat(row.paid), 0);
    const totalCashflowExpenses = expensesRes.rows.reduce((s: number, row: any) => s + parseFloat(row.total), 0);

    res.json({
      period: { from, to },
      currency: currency || 'all',
      voucherCount: parseInt(r.voucher_count),
      totalPax: parseInt(r.total_pax || 0),
      totalSale,
      totalNet,
      grossProfit,
      agentCommissions,
      profitAfterAgent,
      managerCommissions,
      netRevenue: profitAfterAgent - managerCommissions,
      employeePaid: totalEmployeePaid,
      cashflowExpenses: totalCashflowExpenses,
      fullNetRevenue: profitAfterAgent - managerCommissions - totalEmployeePaid - totalCashflowExpenses,
      byManager: byManagerRes.rows,
      salaryBreakdown: salariesRes.rows,
      expenseBreakdown: expensesRes.rows,
    });
  } catch (error) {
    console.error('getRevenueBreakdown error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== DASHBOARD =====

export const getAccountingDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    // Support optional ?year=2026&month=4 for browsing past months
    const reqYear = req.query.year ? parseInt(String(req.query.year)) : now.getFullYear();
    const reqMonth = req.query.month ? parseInt(String(req.query.month)) - 1 : now.getMonth(); // 0-based
    const isCurrentMonth = reqYear === now.getFullYear() && reqMonth === now.getMonth();
    const monthStart = new Date(reqYear, reqMonth, 1).toISOString().split('T')[0];
    const monthEnd = new Date(reqYear, reqMonth + 1, 0).toISOString().split('T')[0]; // last day of month
    const today = now.toISOString().split('T')[0];

    const [cashByMethodRes, revenueRes, todayRes, operatorDebtRes, salaryRes] = await Promise.all([
      // Cash by payment method — grouped by currency to avoid mixing
      pool.query(`
        SELECT payment_method,
          COALESCE(currency, 'THB') as currency,
          SUM(CASE WHEN entry_type='income' THEN amount ELSE -amount END) as balance
        FROM accounting_entries
        WHERE payment_method IS NOT NULL AND payment_method != ''
        GROUP BY payment_method, COALESCE(currency, 'THB')
        ORDER BY COALESCE(currency, 'THB'), balance DESC
      `),

      // This month revenue from vouchers — split by currency
      // profit = profit_after_agent (matches Revenue constructor tab)
      pool.query(`
        SELECT
          COALESCE(currency, 'THB') as currency,
          COALESCE(SUM(total_sale), 0) as total_sale,
          COALESCE(SUM(total_net), 0) as total_net,
          COALESCE(SUM(
            CASE WHEN agent_id IS NOT NULL
              THEN ROUND((total_sale - total_net) * (1 - COALESCE(agent_commission_percentage, 0) / 100.0))
              ELSE (total_sale - total_net) END
          ), 0) as profit
        FROM vouchers
        WHERE is_deleted = false AND created_at::date >= $1 AND created_at::date <= $2
        GROUP BY COALESCE(currency, 'THB')
      `, [monthStart, monthEnd]),

      // Today's revenue — split by currency (only relevant for current month)
      pool.query(`
        SELECT
          COALESCE(currency, 'THB') as currency,
          COALESCE(SUM(total_sale), 0) as total_sale,
          COALESCE(SUM(
            CASE WHEN agent_id IS NOT NULL
              THEN ROUND((total_sale - total_net) * (1 - COALESCE(agent_commission_percentage, 0) / 100.0))
              ELSE (total_sale - total_net) END
          ), 0) as profit
        FROM vouchers
        WHERE is_deleted = false AND created_at::date = $1
        GROUP BY COALESCE(currency, 'THB')
      `, [today]),

      // Operator debt split by currency (THB, VND, USD separately)
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN thb_owed > thb_sent THEN thb_owed - thb_sent ELSE 0 END), 0) as total_debt_thb,
          COALESCE(SUM(CASE WHEN vnd_owed > 0 THEN vnd_owed ELSE 0 END), 0) as total_debt_vnd,
          COALESCE(SUM(CASE WHEN usd_owed > usd_sent THEN usd_owed - usd_sent ELSE 0 END), 0) as total_debt_usd
        FROM (
          SELECT c.id,
            COALESCE(SUM(GREATEST(v.total_net - COALESCE(v.cash_on_tour,0), 0))
              FILTER (WHERE v.is_deleted = false AND v.operator_paid = false AND COALESCE(v.currency,'THB') = 'THB'), 0) as thb_owed,
            COALESCE((
              SELECT SUM(ae.amount) FROM accounting_entries ae
              LEFT JOIN payments p ON ae.payment_id = p.id
              LEFT JOIN vouchers pv ON p.voucher_id = pv.id
              WHERE ae.company_id = c.id AND ae.entry_type = 'expense'
              AND (pv.id IS NULL OR COALESCE(pv.currency,'THB') = 'THB')
            ), 0) as thb_sent,
            COALESCE(SUM(GREATEST(v.total_net - COALESCE(v.cash_on_tour,0), 0))
              FILTER (WHERE v.is_deleted = false AND v.operator_paid = false AND v.currency = 'VND'), 0) as vnd_owed,
            COALESCE(SUM(GREATEST(v.total_net - COALESCE(v.cash_on_tour,0), 0))
              FILTER (WHERE v.is_deleted = false AND v.operator_paid = false AND v.currency = 'USD'), 0) as usd_owed,
            COALESCE((
              SELECT SUM(ae.amount) FROM accounting_entries ae
              LEFT JOIN payments p ON ae.payment_id = p.id
              LEFT JOIN vouchers pv ON p.voucher_id = pv.id
              WHERE ae.company_id = c.id AND ae.entry_type = 'expense'
              AND COALESCE(pv.currency,'THB') = 'USD'
            ), 0) as usd_sent
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
          WHERE payment_date::date >= $1 AND payment_date::date <= $2
          GROUP BY user_id
        ) ep ON ep.user_id = u.id
        WHERE u.is_active = true
      `, [monthStart, monthEnd]),
    ]);

    const calculated = parseFloat(salaryRes.rows[0]?.calculated || 0);
    const paid = parseFloat(salaryRes.rows[0]?.paid || 0);

    // Build per-currency thisMonth maps
    const revByCur: Record<string, any> = {};
    for (const row of revenueRes.rows) {
      revByCur[row.currency] = {
        totalSale: parseFloat(row.total_sale),
        totalNet: parseFloat(row.total_net),
        profit: parseFloat(row.profit),
      };
    }
    const todayByCur: Record<string, any> = {};
    for (const row of todayRes.rows) {
      todayByCur[row.currency] = {
        totalSale: parseFloat(row.total_sale),
        profit: parseFloat(row.profit),
      };
    }
    const currencies = [...new Set([...Object.keys(revByCur), ...Object.keys(todayByCur)])];

    res.json({
      cashByMethod: cashByMethodRes.rows,
      selectedMonth: { year: reqYear, month: reqMonth + 1, isCurrentMonth },
      thisMonth: {
        // Legacy combined (THB only for backwards compat with any existing usage)
        totalSale: parseFloat(revByCur['THB']?.totalSale || 0),
        totalNet: parseFloat(revByCur['THB']?.totalNet || 0),
        profit: parseFloat(revByCur['THB']?.profit || 0),
        today: {
          totalSale: parseFloat(todayByCur['THB']?.totalSale || 0),
          profit: parseFloat(todayByCur['THB']?.profit || 0),
        },
        // Per-currency breakdown
        byCurrency: currencies.map(cur => ({
          currency: cur,
          totalSale: revByCur[cur]?.totalSale || 0,
          totalNet: revByCur[cur]?.totalNet || 0,
          profit: revByCur[cur]?.profit || 0,
          // Only show today data for current month
          todaySale: isCurrentMonth ? (todayByCur[cur]?.totalSale || 0) : 0,
          todayProfit: isCurrentMonth ? (todayByCur[cur]?.profit || 0) : 0,
        })),
      },
      operatorDebt: parseFloat(operatorDebtRes.rows[0]?.total_debt_thb || 0),
      operatorDebtVND: parseFloat(operatorDebtRes.rows[0]?.total_debt_vnd || 0),
      operatorDebtUSD: parseFloat(operatorDebtRes.rows[0]?.total_debt_usd || 0),
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

// ===== CONFIRM DEPOSIT ENTRY =====

export const confirmCashflowEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE accounting_entries SET requires_confirmation = false WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('confirmCashflowEntry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
