import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import engineLoader from './engineLoader.js';
import updateManager from './updateManager.js';

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

// Engine suggestion endpoint (simulated AI) - returns suggested updates
router.post('/suggest', async (req, res) => {
  console.log('🤖 Received engine suggestion request');
  const { prompt, specificFix, context } = req.body;

  if (!prompt && !specificFix) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Request must contain "prompt" or "specificFix"',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const status = updateManager.getEngineStatus();
    const currentVersion = status.currentVersion;

    // Read current engine source
    const enginePath = path.join(__dirname, '..', 'pay-hours', 'engine', 'wageEngine.js');
    let currentCode = fs.readFileSync(enginePath, 'utf8');

    const userPrompt = prompt || specificFix;
    const systemPrompt = `You are an expert JavaScript developer. You are given the full source code of a wage calculation engine. The user will request an improvement or fix. Respond with ONLY a unified diff (like git diff) that modifies the code to satisfy the request. Do not include explanations, only the diff.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set in environment');
    }

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User request: ${userPrompt}\n\nCode:\n${currentCode}` }
        ],
        max_tokens: 1500,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const suggestionText = data.choices?.[0]?.message?.content || 'No suggestion generated.';

    // Assume the entire response is the diff
    const diff = suggestionText;

    // Build a short human-readable summary
    const suggestion = `AI suggestion: ${diff.split('\n').slice(0, 3).join(' ')}...`;

    res.status(200).json({
      success: true,
      data: {
        suggestion,
        diff,
        currentVersion,
        currentCode: currentCode.substring(0, 1000) + (currentCode.length > 1000 ? '...' : ''),
        recommendations: [
          'Review the diff carefully before applying',
          'Run the full test suite after applying',
          'Monitor performance after engine switch'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Engine suggestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate suggestion',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
