'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { memoryStore } = require('../db/store');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Registers a new factory tenant and initial factory user.
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, factory } = req.body || {};
    if (!email || !password || !factory || !factory.legal_name) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, password, and factory.legal_name are required.',
        },
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long.',
        },
      });
    }

    const existingUser = memoryStore.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_TAKEN',
          message: 'An account with this email address already exists.',
        },
      });
    }

    const newFactory = memoryStore.createFactory({
      legal_name: factory.legal_name,
      chamber_registration_number: factory.chamber_registration_number || null,
      fda_establishment_number: factory.fda_establishment_number || null,
      fda_green_list_status: Boolean(factory.fda_green_list_status),
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = memoryStore.createUser({
      email,
      factory_id: newFactory.id,
      role: 'factory_user',
      password_hash: passwordHash,
    });

    const token = signToken({
      user_id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      factory_id: newUser.factory_id,
    });

    return res.status(201).json({
      access_token: token,
      token_type: 'Bearer',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        factory_id: newUser.factory_id,
      },
      factory: newFactory,
    });
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues JWT.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required.',
        },
      });
    }

    const user = memoryStore.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const factory = user.factory_id ? memoryStore.getFactoryById(user.factory_id) : null;
    const token = signToken({
      user_id: user.id,
      email: user.email,
      role: user.role,
      factory_id: user.factory_id,
    });

    return res.json({
      access_token: token,
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        factory_id: user.factory_id,
      },
      factory,
    });
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieves authenticated user and factory context.
 */
router.get('/me', requireAuth, (req, res) => {
  const user = memoryStore.getUserById(req.user.user_id) || memoryStore.getUserByEmail(req.user.email);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Authenticated user profile not found.',
      },
    });
  }

  const factory = user.factory_id ? memoryStore.getFactoryById(user.factory_id) : null;
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      factory_id: user.factory_id,
      created_at: user.created_at,
    },
    factory,
  });
});

module.exports = router;
