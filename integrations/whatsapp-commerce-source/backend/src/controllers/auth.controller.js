import { asyncHandler } from '../middleware/asyncHandler.js';
import { findUserByEmail, findUserById, createUser, verifyPassword } from '../services/user.service.js';
import { generateToken } from '../middleware/auth.js';

export const register = asyncHandler(async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Email, password, and full name are required.' });
  }
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'User with this email already exists.' });
  }
  const user = await createUser({ email, password, fullName });
  const token = generateToken(user);
  res.status(201).json({ success: true, message: 'User registered successfully.', data: { user, token } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }
  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'Account is deactivated.' });
  }
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  const token = generateToken(user);
  res.status(200).json({
    success: true, message: 'Login successful.',
    data: { user: { id: user.id, email: user.email, fullName: user.full_name }, token }
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.status(200).json({ success: true, data: { user: { ...user, businesses: req.user.businesses } } });
});
