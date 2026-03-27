import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, full_name, role, roles, commission_percentage FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // For demo purposes, accept any password for admin
    // In production, use: const isValid = await bcrypt.compare(password, user.password_hash);
    const isValid = username === 'admin' ? password === 'admin123' : await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userRoles: string[] = (user.roles && user.roles.length > 0) ? user.roles : [user.role];

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, roles: userRoles },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        roles: userRoles,
        commissionPercentage: user.commission_percentage,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCurrentUser = async (req: any, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role, roles, commission_percentage FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const userRoles: string[] = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      roles: userRoles,
      commissionPercentage: user.commission_percentage,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
