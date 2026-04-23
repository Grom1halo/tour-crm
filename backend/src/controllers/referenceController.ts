import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

// ===== COMPANIES =====
export const getCompanies = async (req: AuthRequest, res: Response) => {
  try {
    const { activeOnly } = req.query;
    
    let query = 'SELECT * FROM companies';
    if (activeOnly === 'true') {
      query += ' WHERE is_active = true';
    }
    query += ' ORDER BY name';

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCompany = async (req: AuthRequest, res: Response) => {
  try {
    const { name, article } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const result = await pool.query(
      'INSERT INTO companies (name, article) VALUES ($1, $2) RETURNING *',
      [name, article || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Company already exists' });
    }
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCompany = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const { article } = req.body;
    const result = await pool.query(
      `UPDATE companies
       SET name = $1, is_active = $2, article = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, isActive, article || '', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCompany = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE companies SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ message: 'Company deactivated' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== TOURS =====
export const getTours = async (req: AuthRequest, res: Response) => {
  try {
    const { activeOnly, tourType } = req.query;

    let query = `
      SELECT t.*, c.name AS company_name
      FROM tours t
      LEFT JOIN companies c ON t.company_id = c.id
      WHERE 1=1`;
    const params: any[] = [];

    if (activeOnly === 'true') {
      query += ' AND t.is_active = true';
    }

    if (tourType) {
      query += ` AND t.tour_type = $${params.length + 1}`;
      params.push(tourType);
    }

    query += ' ORDER BY t.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTour = async (req: AuthRequest, res: Response) => {
  try {
    const { name, tourType, cancellationTerms, article, companyId } = req.body;

    if (!name || !tourType) {
      return res.status(400).json({ error: 'Name and tourType required' });
    }

    const result = await pool.query(
      'INSERT INTO tours (name, tour_type, cancellation_terms, article, company_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, tourType, cancellationTerms || [], article || '', companyId || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTour = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, tourType, isActive, cancellationTerms, article } = req.body;

    const terms = cancellationTerms || [];
    // Auto-clear needs_attention if cancellation terms are set
    const hasTerms = terms.length > 0;

    const { companyId } = req.body;
    const result = await pool.query(
      `UPDATE tours
       SET name = $1, tour_type = $2, is_active = $3, cancellation_terms = $4, article = $5, company_id = $6,
           updated_at = CURRENT_TIMESTAMP,
           needs_attention = CASE WHEN $7 THEN false ELSE needs_attention END
       WHERE id = $8
       RETURNING *`,
      [name, tourType, isActive, terms, article || '', companyId || null, hasTerms, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tour not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTour = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE tours SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ message: 'Tour deactivated' });
  } catch (error) {
    console.error('Delete tour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== TOUR PRICES =====
export const getTourPricesList = async (req: AuthRequest, res: Response) => {
  try {
    const { tourId, companyId, activeOnly } = req.query;
    
    let query = `
      SELECT 
        tp.*,
        t.name as tour_name,
        c.name as company_name
      FROM tour_prices tp
      JOIN tours t ON tp.tour_id = t.id
      JOIN companies c ON tp.company_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (tourId) {
      query += ` AND tp.tour_id = $${paramIndex}`;
      params.push(tourId);
      paramIndex++;
    }

    if (companyId) {
      query += ` AND tp.company_id = $${paramIndex}`;
      params.push(companyId);
      paramIndex++;
    }

    if (activeOnly === 'true') {
      query += ' AND tp.is_active = true';
    }

    query += ' ORDER BY tp.valid_from DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tour prices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTourPrice = async (req: AuthRequest, res: Response) => {
  try {
    const {
      tourId, companyId, validFrom, validTo,
      adultNet, childNet, infantNet, transferNet, otherNet,
      adultSale, childSale, infantSale, transferSale, otherSale,
      article,
    } = req.body;

    if (!tourId || !companyId || !validFrom || !validTo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (new Date(validFrom) > new Date(validTo)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    // Check for overlapping periods
    const overlap = await pool.query(
      `SELECT id, valid_from, valid_to FROM tour_prices
       WHERE tour_id=$1 AND company_id=$2 AND is_active=true
         AND valid_from <= $3 AND valid_to >= $4`,
      [tourId, companyId, validTo, validFrom]
    );
    if (overlap.rows.length > 0) {
      const ex = overlap.rows[0];
      return res.status(400).json({
        error: `Period overlaps with existing: ${ex.valid_from?.split('T')[0]} — ${ex.valid_to?.split('T')[0]}`,
      });
    }

    const result = await pool.query(
      `INSERT INTO tour_prices (
        tour_id, company_id, valid_from, valid_to, article,
        adult_net, child_net, infant_net, transfer_net, other_net,
        adult_sale, child_sale, infant_sale, transfer_sale, other_sale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        tourId, companyId, validFrom, validTo, article || '',
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
      ]
    );

    // Auto-clear needs_attention when a price is added
    await pool.query(
      'UPDATE tours SET needs_attention = false WHERE id = $1',
      [tourId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Price period already exists' });
    }
    console.error('Create tour price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTourPrice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      validFrom, validTo,
      adultNet, childNet, infantNet, transferNet, otherNet,
      adultSale, childSale, infantSale, transferSale, otherSale,
      isActive, article,
    } = req.body;

    if (new Date(validFrom) > new Date(validTo)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    // Look up tour_id and company_id of the record being edited
    const current = await pool.query('SELECT tour_id, company_id FROM tour_prices WHERE id=$1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Tour price not found' });
    const { tour_id: tourId, company_id: companyId } = current.rows[0];

    // Check for overlapping periods (excluding self)
    const overlap = await pool.query(
      `SELECT id, valid_from, valid_to FROM tour_prices
       WHERE tour_id=$1 AND company_id=$2 AND is_active=true
         AND valid_from <= $3 AND valid_to >= $4
         AND id != $5`,
      [tourId, companyId, validTo, validFrom, id]
    );
    if (overlap.rows.length > 0) {
      const ex = overlap.rows[0];
      return res.status(400).json({
        error: `Period overlaps with existing: ${ex.valid_from?.split('T')[0]} — ${ex.valid_to?.split('T')[0]}`,
      });
    }

    const result = await pool.query(
      `UPDATE tour_prices SET
        valid_from = $1, valid_to = $2, article = $3,
        adult_net = $4, child_net = $5, infant_net = $6, transfer_net = $7, other_net = $8,
        adult_sale = $9, child_sale = $10, infant_sale = $11, transfer_sale = $12, other_sale = $13,
        is_active = $14, updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *`,
      [
        validFrom, validTo, article || '',
        adultNet, childNet, infantNet, transferNet, otherNet,
        adultSale, childSale, infantSale, transferSale, otherSale,
        isActive ?? true, id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tour price not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tour price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTourPrice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tour_prices WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tour price not found' });
    res.json({ message: 'Tour price deleted' });
  } catch (error) {
    console.error('Delete tour price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== AGENTS =====
export const getAgents = async (req: AuthRequest, res: Response) => {
  try {
    const { activeOnly } = req.query;
    
    let query = 'SELECT * FROM agents';
    if (activeOnly === 'true') {
      query += ' WHERE is_active = true';
    }
    query += ' ORDER BY name';

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAgent = async (req: AuthRequest, res: Response) => {
  try {
    const { name, commissionPercentage } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const result = await pool.query(
      'INSERT INTO agents (name, commission_percentage) VALUES ($1, $2) RETURNING *',
      [name, commissionPercentage || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAgent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // Check if agent is used in any vouchers
    const check = await pool.query('SELECT COUNT(*) FROM vouchers WHERE agent_id=$1', [id]);
    if (parseInt(check.rows[0].count) > 0) {
      // Has linked vouchers (even deleted ones) — soft delete only
      await pool.query('UPDATE agents SET is_active=false, updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id]);
      return res.json({ message: 'Agent deactivated (has linked vouchers)' });
    }
    await pool.query('DELETE FROM agents WHERE id=$1', [id]);
    res.json({ message: 'Agent deleted' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAgent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, commissionPercentage, isActive } = req.body;

    const result = await pool.query(
      `UPDATE agents
       SET name = $1, commission_percentage = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, commissionPercentage, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== PAYMENT METHODS =====
export const getPaymentMethods = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_methods WHERE is_active = true ORDER BY sort_order, name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const result = await pool.query(
      'INSERT INTO payment_methods (name, sort_order) VALUES ($1, (SELECT COALESCE(MAX(sort_order),0)+1 FROM payment_methods)) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'Method already exists' });
    console.error('Create payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    // Check system
    const check = await pool.query('SELECT is_system FROM payment_methods WHERE id=$1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (check.rows[0].is_system) return res.status(400).json({ error: 'Cannot rename system method' });
    const result = await pool.query(
      'UPDATE payment_methods SET name=$1 WHERE id=$2 RETURNING *',
      [name.trim(), id]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'Method already exists' });
    console.error('Update payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT is_system FROM payment_methods WHERE id=$1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (check.rows[0].is_system) return res.status(400).json({ error: 'Cannot delete system method' });
    await pool.query('UPDATE payment_methods SET is_active=false WHERE id=$1', [id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== SEASONS =====
export const getSeasons = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM seasons ORDER BY sort_order, valid_from');
    res.json(result.rows);
  } catch (error) {
    console.error('Get seasons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSeason = async (req: AuthRequest, res: Response) => {
  try {
    const { label, validFrom, validTo, sortOrder } = req.body;
    if (!label || !validFrom || !validTo) {
      return res.status(400).json({ error: 'label, validFrom, validTo required' });
    }
    const result = await pool.query(
      'INSERT INTO seasons (label, valid_from, valid_to, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [label, validFrom, validTo, sortOrder ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSeason = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { label, validFrom, validTo, sortOrder } = req.body;
    const result = await pool.query(
      `UPDATE seasons SET label=$1, valid_from=$2, valid_to=$3, sort_order=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5 RETURNING *`,
      [label, validFrom, validTo, sortOrder ?? 0, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Season not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update season error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSeason = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM seasons WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Season not found' });
    res.json({ message: 'Season deleted' });
  } catch (error) {
    console.error('Delete season error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
