'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'exportready-dev-secret-key-change-in-prod-2026';

function signToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header. Expected Bearer <JWT>.',
      },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'JWT token verification failed or token has expired.',
      },
    });
  }
}

/**
 * Strict Multi-Tenant Enforcement:
 * Binds all tenant queries strictly to req.user.factory_id.
 * Any client-supplied factory_id in query, params, or body is completely overridden.
 */
function requireFactoryTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required before tenant scoping.',
      },
    });
  }

  if (req.user.role === 'factory_user') {
    if (!req.user.factory_id) {
      return res.status(403).json({
        error: {
          code: 'TENANT_NOT_ASSIGNED',
          message: 'User does not belong to a valid factory tenant.',
        },
      });
    }
    req.factoryId = req.user.factory_id;
    return next();
  }

  if (req.user.role === 'admin') {
    // Admins may optionally act on behalf of a tenant if specified in query or header,
    // otherwise forbidden from arbitrary tenant operations without context.
    const explicitFactoryId = req.headers['x-factory-id'] || req.query.factory_id;
    if (explicitFactoryId) {
      req.factoryId = explicitFactoryId;
      return next();
    }
    return res.status(403).json({
      error: {
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Admin must specify target factory context via X-Factory-ID header or query.',
      },
    });
  }

  return res.status(403).json({
    error: {
      code: 'FORBIDDEN_ROLE',
      message: 'Unauthorized tenant access role.',
    },
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Administrative privileges required for this resource.',
      },
    });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  signToken,
  verifyToken,
  requireAuth,
  requireFactoryTenant,
  requireAdmin,
};
