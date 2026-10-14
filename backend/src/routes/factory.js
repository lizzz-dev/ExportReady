'use strict';

const express = require('express');
const { memoryStore } = require('../db/store');
const { requireAuth, requireFactoryTenant } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireFactoryTenant);

function getFactoryHandler(req, res) {
  const factory = memoryStore.getFactoryById(req.factoryId);
  if (!factory) {
    return res.status(404).json({
      error: {
        code: 'FACTORY_NOT_FOUND',
        message: 'Factory profile not found for authenticated tenant.',
      },
    });
  }
  return res.json(factory);
}

function updateFactoryHandler(req, res) {
  const updates = req.body || {};
  const allowed = ['legal_name', 'chamber_registration_number', 'fda_establishment_number', 'fda_green_list_status'];
  const cleanUpdates = {};

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      cleanUpdates[key] = key === 'fda_green_list_status' ? Boolean(updates[key]) : updates[key];
    }
  }

  const updated = memoryStore.updateFactory(req.factoryId, cleanUpdates);
  if (!updated) {
    return res.status(404).json({
      error: {
        code: 'FACTORY_NOT_FOUND',
        message: 'Factory profile not found.',
      },
    });
  }
  return res.json(updated);
}

// Canonical and alias routes
router.get('/profile', getFactoryHandler);
router.get('/', getFactoryHandler);

router.put('/profile', updateFactoryHandler);
router.patch('/profile', updateFactoryHandler);
router.patch('/', updateFactoryHandler);

module.exports = router;
