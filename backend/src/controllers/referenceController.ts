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
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const result = await pool.query(
      'INSERT INTO companies (name) VALUES ($1) RETURNING *',
      [name]
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

    const result = await pool.query(
      `UPDATE companies 
       SET name = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, isActive, id]
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

// ===== TOURS =====
export const getTours = async (req: AuthRequest, res: Response) => {
  try {
    const { activeOnly, tourType } = req.query;
    
    let query = 'SELECT * FROM tours WHERE 1=1';
    const params: any[] = [];

    if (activeOnly === 'true') {
      query += ' AND is_active = true';
    }

    if (tourType) {
      query += ` AND tour_type = $${params.length + 1}`;
      params.push(tourType);
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTour = async (req: AuthRequest, res: Response) => {
  try {
    const { name, tourType } = req.body;

    if (!name || !tourType) {
      return res.status(400).json({ error: 'Name and tourType required' });
    }

    const result = await pool.query(
      'INSERT INTO tours (name, tour_type) VALUES ($1, $2) RETURNING *',
      [name, tourType]
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
    const { name, tourType, isActive } = req.body;

    const result = await pool.query(
      `UPDATE tours 
       SET name = $1, tour_type = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, tourType, isActive, id]
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
    } = req.body;

    if (!tourId || !companyId || !validFrom || !validTo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO tour_prices (
        tour_id, company_id, valid_from, valid_to,
        adult_net, child_net, infant_net, transfer_net, other_net,
        adult_sale, child_sale, infant_sale, transfer_sale, other_sale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        tourId, companyId, validFrom, validTo,
        adultNet || 0, childNet || 0, infantNet || 0, transferNet || 0, otherNet || 0,
        adultSale || 0, childSale || 0, infantSale || 0, transferSale || 0, otherSale || 0,
      ]
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
      isActive,
    } = req.body;

    const result = await pool.query(
      `UPDATE tour_prices SET
        valid_from = $1, valid_to = $2,
        adult_net = $3, child_net = $4, infant_net = $5, transfer_net = $6, other_net = $7,
        adult_sale = $8, child_sale = $9, infant_sale = $10, transfer_sale = $11, other_sale = $12,
        is_active = $13, updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *`,
      [
        validFrom, validTo,
        adultNet, childNet, infantNet, transferNet, otherNet,
        adultSale, childSale, infantSale, transferSale, otherSale,
        isActive, id,
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
