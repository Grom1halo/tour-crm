import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

export const getClients = async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    const user = req.user!;

    let query = `
      SELECT c.*, u.full_name as manager_name
      FROM clients c
      LEFT JOIN users u ON c.manager_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Managers see only their clients
    if (user.role === 'manager') {
      query += ' AND c.manager_id = $1';
      params.push(user.id);
    }

    // Search by name or phone
    if (search) {
      const searchParam = params.length + 1;
      query += ` AND (c.name ILIKE $${searchParam} OR c.phone ILIKE $${searchParam})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY c.created_at DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createClient = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone } = req.body;
    const user = req.user!;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone required' });
    }

    const managerId = user.role === 'manager' ? user.id : req.body.managerId;

    const result = await pool.query(
      `INSERT INTO clients (name, phone, manager_id) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, phone, managerId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Client with this phone already exists' });
    }
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateClient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;
    const user = req.user!;

    // Check ownership for managers
    if (user.role === 'manager') {
      const check = await pool.query('SELECT manager_id FROM clients WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(
      `UPDATE clients 
       SET name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, phone, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    // Check ownership for managers
    if (user.role === 'manager') {
      const check = await pool.query('SELECT manager_id FROM clients WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].manager_id !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await pool.query('DELETE FROM clients WHERE id = $1', [id]);
    res.json({ message: 'Client deleted' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
