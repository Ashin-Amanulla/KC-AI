import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import engineLoader from './engineLoader.js';
import updateManager from './updateManager.js';
import { runEngineAgentChat } from './engineAgent.js';

const router = express.Router();

// Initialize engine service - load default engine on startup
const initializeEngineService = async () => {
  console.log('🔧 Initializing engine service...');
  const status = engineLoader.getStatus();
  
  if (status.versions.length === 0) {
    // If no engine versions exist, create a fresh one from current source
    console.log('⚠️  No engine versions found. Loading default engine from source...');
    try {
      const sourceEnginePath = path.join(__dirname, '..', 'pay-hours', 'engine', 'wageEngine.js');
      const sourceEngine = await import(sourceEnginePath);
      console.log('✅ Default engine loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load default engine:', error.message);
    }
  } else {
    console.log(`✅ Engine service ready with ${status.versions.length} versions, current: ${status.currentVersion}`);
  }
};

initializeEngineService();

// Engine status endpoint
router.get('/status', (req, res) => {
  try {
    const status = updateManager.getEngineStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get engine status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Engine update endpoint - accept diff/code
router.post('/update', async (req, res) => {
  console.log('📥 Received engine update request');
  
  const { code, diff, metadata = {} } = req.body;
  
  if (!code && !diff) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Request body must contain either "code" or "diff" field',
      timestamp: new Date().toISOString()
    });
  }
  
  const updateSource = code ? 'code' : 'diff';
  console.log(`📝 Processing engine update via ${updateSource}`);
  
  try {
    const result = diff
      ? await updateManager.applyDiff(diff, metadata)
      : await updateManager.applyCodeUpdate(code, metadata);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Engine updated successfully',
        data: {
          version: result.version,
          appliedAt: result.metadata.appliedAt,
          testResults: result.testResults,
          metadata: result.metadata
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Engine update failed',
        message: result.error,
        details: {
          stage: result.stage,
          testResults: result.testResults
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Engine update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during engine update',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Conversational agent for non-technical users
router.post('/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing messages',
      message: 'Request must include a non-empty messages array',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const result = await runEngineAgentChat(messages);
    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Engine chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Chat failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Apply a proposal from the conversational agent
router.post('/apply-proposal', async (req, res) => {
  const { code, metadata = {} } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Missing code',
      message: 'Request must include the proposed rule code',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const result = await updateManager.applyCodeUpdate(code, {
      ...metadata,
      source: metadata.source || 'pay-rules-assistant',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Apply failed',
        message: result.error,
        details: { stage: result.stage, testResults: result.testResults },
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      message: 'Pay rules updated successfully',
      data: {
        version: result.version,
        appliedAt: result.metadata.appliedAt,
        testResults: result.testResults,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Apply proposal error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
