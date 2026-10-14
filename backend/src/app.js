'use strict';

const express = require('express');
const cors = require('cors');
const { memoryStore } = require('./db/store');

const authRoutes = require('./routes/auth');
const factoryRoutes = require('./routes/factory');
const evidenceRoutes = require('./routes/evidence');
const ordersRoutes = require('./routes/orders');
const plannerRoutes = require('./routes/planner');
const analyticsRoutes = require('./routes/analytics');
const copilotRoutes = require('./routes/copilot');
const roadmapRoutes = require('./routes/roadmap');
const adminRoutes = require('./routes/admin');
const legalRoutes = require('./routes/legal');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Liveness check
app.get('/health', (req, res) => {
  return res.json({
    status: 'healthy',
    service: 'exportready-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});
app.get('/api/health', (req, res) => {
  return res.json({
    status: 'healthy',
    service: 'exportready-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Global Rules Read Route (available to all authenticated users)
app.get('/api/rules', (req, res) => {
  const { category, active } = req.query;
  const rules = memoryStore.getRules({ category, active });
  return res.json(rules);
});
app.get('/api/rules/:ruleCode', (req, res) => {
  const rule = memoryStore.getRuleByCode(req.params.ruleCode) || memoryStore.getRuleById(req.params.ruleCode);
  if (!rule) {
    return res.status(404).json({
      error: { code: 'RULE_NOT_FOUND', message: `Rule '${req.params.ruleCode}' not found.` },
    });
  }
  return res.json(rule);
});

// Mount Feature Routers
app.use('/api/auth', authRoutes);
app.use('/api/factory', factoryRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/fix-planner', plannerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/iso-roadmap', roadmapRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/legal', legalRoutes);

// Also alias under /api/v1 prefix for REST_API_ENDPOINTS.md compatibility
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/factory', factoryRoutes);
app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/planner', plannerRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/copilot', copilotRoutes);
app.use('/api/v1/iso-roadmap', roadmapRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/legal', legalRoutes);
app.use('/api/v1/rules', (req, res) => {
  const { category, active } = req.query;
  const rules = memoryStore.getRules({ category, active });
  return res.json(rules);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} does not exist on ExportReady backend.`,
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Backend Error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred.',
    },
  });
});

module.exports = app;
