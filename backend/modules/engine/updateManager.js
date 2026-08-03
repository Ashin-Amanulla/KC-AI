import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import engineLoader from './engineLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class UpdateManager {
  constructor() {
    this.engineDir = path.join(__dirname, '..', 'pay-hours', 'engine');
    this.versionsDir = path.join(this.engineDir, 'versions');
  }

  async validateSyntax(code) {
    const tmpPath = path.join(this.engineDir, `.syntax-check-${Date.now()}.js`);

    try {
      fs.writeFileSync(tmpPath, code, 'utf8');

      return await new Promise((resolve) => {
        const child = spawn('node', ['--check', tmpPath]);
        let stderr = '';

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (exitCode) => {
          if (exitCode === 0) {
            resolve({ valid: true });
            return;
          }

          resolve({
            valid: false,
            error: stderr.replace(/\u001b\[[0-9;]*m/g, '').trim() || 'Syntax check failed',
          });
        });

        child.on('error', (error) => {
          resolve({ valid: false, error: error.message });
        });
      });
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  }

  async runEngineTests() {
    return new Promise((resolve) => {
      const child = spawn('node', ['--test', 'modules/pay-hours/services/wageParity.test.js'], {
        cwd: '/home/cntrlx/Code/Xyvin/KCXyvin/kcai/backend',
        timeout: 60000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const passed = code === 0;
        const results = {
          passed,
          exitCode: code,
          stdout,
          stderr,
          timestamp: new Date().toISOString()
        };
        
        // Try to parse test output for more details
        const testMatch = stdout.match(/ℹ tests (\d+)/);
        const passMatch = stdout.match(/ℹ pass (\d+)/);
        const failMatch = stdout.match(/ℹ fail (\d+)/);
        
        if (testMatch) {
          results.totalTests = parseInt(testMatch[1]);
        }
        if (passMatch) {
          results.passedTests = parseInt(passMatch[1]);
        }
        if (failMatch) {
          results.failedTests = parseInt(failMatch[1]);
        }
        
        resolve(results);
      });

      child.on('error', (error) => {
        resolve({
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  async applyCodeUpdate(newCode, metadata = {}) {
    console.log('📥 Applying engine code update...');

    // Step 1: Validate syntax
    const syntaxCheck = await this.validateSyntax(newCode);
    if (!syntaxCheck.valid) {
      return {
        success: false,
        error: `Syntax validation failed: ${syntaxCheck.error}`,
        stage: 'syntax'
      };
    }
    console.log('✅ Syntax validation passed');

    // Step 2: Save as new version
    const version = await engineLoader.saveEngineCode(newCode);
    console.log(`✅ Saved as version: ${version}`);

    // Step 3: Load and validate the new version
    try {
      const testModule = await engineLoader.loadEngine(version);
      console.log('✅ New engine version loads without errors');
    } catch (error) {
      return {
        success: false,
        error: `Engine load failed: ${error.message}`,
        stage: 'load'
      };
    }

    // Step 4: Run tests against new version
    console.log('🧪 Running parity tests...');
    const testResults = await this.runEngineTests();
    
    if (!testResults.passed) {
      // Clean up the failed version
      const failedPath = path.join(this.versionsDir, `engine_${version}.js`);
      if (fs.existsSync(failedPath)) {
        fs.unlinkSync(failedPath);
      }
      
      return {
        success: false,
        error: 'Parity tests failed',
        stage: 'test',
        testResults
      };
    }
    
    console.log('✅ All parity tests passed');

    // Step 5: Switch to new version
    const switched = await engineLoader.switchVersion(version);
    if (!switched) {
      return {
        success: false,
        error: 'Failed to switch engine version',
        stage: 'switch'
      };
    }

    console.log('🎉 Engine update complete!');
    
    return {
      success: true,
      version,
      testResults,
      metadata: {
        ...metadata,
        appliedAt: new Date().toISOString()
      }
    };
  }

  async applyDiff(diff, metadata = {}) {
    // For now, we accept full code replacement
    // Future: implement actual diff parsing
    console.log('📝 Processing diff update...');
    
    // Assume diff contains the full new code for simplicity
    // In production, parse and apply diff
    return await this.applyCodeUpdate(diff, { ...metadata, type: 'diff' });
  }

  getEngineStatus() {
    return engineLoader.getStatus();
  }
}

const updateManager = new UpdateManager();
export default updateManager;