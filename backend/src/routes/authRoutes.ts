import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// --- REGISTER ---
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = new User({ email, password });
    await user.save();

    res.status(201).json({ success: true, message: 'Account created' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// --- LOGIN ---
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        telegramConnected: user.telegramConnected 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- GENERATE TELEGRAM LINK ---
router.post('/link-telegram', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const token = crypto.randomUUID();
    // Use req.user!.id from your AuthRequest custom interface
    await User.findByIdAndUpdate(req.user!.id, { telegramLinkToken: token });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'YourBotName';
    const link = `https://t.me/${botUsername}?start=${token}`;

    res.json({ success: true, link });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// --- GET CURRENT PROFILE ---
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-password -telegramLinkToken');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;