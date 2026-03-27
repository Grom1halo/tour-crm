import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import bcrypt from 'bcrypt';

export const getManagers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, username, manager_phone, commission_percentage, manager_number, role, roles, is_active
       FROM users ORDER BY manager_number, full_name`
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

// ===== ADMIN USER MANAGEMENT =====

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { username, fullName, password, role, roles, managerNumber, managerPhone, commissionPercentage } = req.body;

    if (!username || !fullName || !password || (!role && (!roles || roles.length === 0))) {
      return res.status(400).json({ error: 'username, fullName, password, role(s) are required' });
    }

    const primaryRole = role || (roles && roles[0]) || 'manager';
    const rolesArray: string[] = roles && roles.length > 0 ? roles : [primaryRole];

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, full_name, password_hash, role, roles, manager_number, manager_phone, commission_percentage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, full_name, role, roles, manager_number, manager_phone, commission_percentage, is_active`,
      [username, fullName, passwordHash, primaryRole, rolesArray, managerNumber || '00', managerPhone || null, commissionPercentage || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const current = req.user!;
    if (String(current.id) === String(id)) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    await pool.query(
      'UPDATE users SET is_active=false, updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      [id]
    );
    res.json({ message: 'User deactivated' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, role, roles, managerNumber, managerPhone, commissionPercentage, isActive, password } = req.body;

    const primaryRole = role || (roles && roles[0]) || 'manager';
    const rolesArray: string[] = roles && roles.length > 0 ? roles : [primaryRole];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [passwordHash, id]
      );
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name=$1, role=$2, roles=$3, manager_number=$4, manager_phone=$5,
           commission_percentage=$6, is_active=$7, updated_at=CURRENT_TIMESTAMP
       WHERE id=$8
       RETURNING id, username, full_name, role, roles, manager_number, manager_phone, commission_percentage, is_active`,
      [fullName, primaryRole, rolesArray, managerNumber || '00', managerPhone || null, commissionPercentage || 0, isActive ?? true, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
