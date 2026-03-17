import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

export const getManagers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, username, manager_phone, commission_percentage
       FROM users WHERE is_active = true ORDER BY full_name`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateManagerPhone = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { managerPhone } = req.body;
    await pool.query(
      'UPDATE users SET manager_phone=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
      [managerPhone, user.id]
    );
    res.json({ message: 'Phone updated' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
