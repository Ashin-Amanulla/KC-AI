import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.join(__dirname, '..', 'pay-hours', 'engine');
const VERSIONS_DIR = path.join(ENGINE_DIR, 'versions');

class EngineLoader {
  constructor() {
    this.cache = new Map();
    this.currentVersion = null;
    this.readyFlag = false;
    this.fallbackModule = null;
    this.ensureDirectories();
    this.loadFallbackModule();
  }

  ensureDirectories() {
    if (!fs.existsSync(VERSIONS_DIR)) {
      fs.mkdirSync(VERSIONS_DIR, { recursive: true });
    }
  }

  loadFallbackModule() {
    try {
      const fallbackPath = path.join(ENGINE_DIR, 'wageEngine.js');
      this.fallbackModule = import(fallbackPath);
    } catch (error) {
      console.error('Failed to load fallback engine:', error);
    }
  }

  getCurrentVersion() {
    if (this.currentVersion) return this.currentVersion;
    
    const symlinkPath = path.join(VERSIONS_DIR, 'current');
    try {
      const version = fs.readlinkSync(symlinkPath);
      this.currentVersion = version.replace(/^engine_/, '').replace(/\.js$/, '');
      return this.currentVersion;
    } catch {
      // If symlink doesn't exist, use v1
      this.currentVersion = 'v1';
      this.createDefaultSymlink();
      return this.currentVersion;
    }
  }

  createDefaultSymlink() {
    try {
      const source = path.join(VERSIONS_DIR, `engine_${this.currentVersion}.js`);
      const link = path.join(VERSIONS_DIR, 'current');
      fs.symlinkSync(source, link);
    } catch (error) {
      console.error('Failed to create version symlink:', error);
    }
  }

  invalidateCache(version) {
    this.cache.delete(version);
    console.log(`Cache invalidated for version: ${version}`);
  }

  async loadEngine(version = null) {
    const targetVersion = version || this.getCurrentVersion();
    
    // Return cached module if available
    if (this.cache.has(targetVersion)) {
      return this.cache.get(targetVersion);
    }

    const enginePath = path.join(VERSIONS_DIR, `engine_${targetVersion}.js`);
    
    try {
      console.log(`Loading engine version: ${targetVersion} from ${enginePath}`);
      
      const module = await import(enginePath);
      this.cache.set(targetVersion, module);
      
      this.readyFlag = true;
      console.log(`✅ Engine v${targetVersion} loaded successfully`);
      
      return module;
    } catch (error) {
      console.error(`❌ Failed to load engine v${targetVersion}:`, error.message);
      
      // Fallback to previous version if available
      if (targetVersion !== 'v1' && this.fallbackModule) {
        console.log('🔄 Falling back to v1 engine');
        this.cache.set(targetVersion, this.fallbackModule);
        return this.fallbackModule;
      }
      
      if (this.fallbackModule) {
        console.log('🔄 Falling back to default engine v1');
        this.cache.set(targetVersion, this.fallbackModule);
        return this.fallbackModule;
      }
      
      throw new Error(`Failed to load engine v${targetVersion} and no fallback available`);
    }
  }

  async getEngine() {
    return await this.loadEngine();
  }

  async switchVersion(newVersion) {
    console.log(`🔄 Switching engine to version: ${newVersion}`);
    
    // Invalidate cache for old version
    if (this.currentVersion && this.currentVersion !== newVersion) {
      this.invalidateCache(this.currentVersion);
    }
    
    // Update symlink
    const source = path.join(VERSIONS_DIR, `engine_${newVersion}.js`);
    const link = path.join(VERSIONS_DIR, 'current');
    
    try {
      if (fs.existsSync(source)) {
        fs.unlinkSync(link);
        fs.symlinkSync(source, link);
        this.currentVersion = newVersion;
        this.invalidateCache(newVersion);
        
        console.log(`✅ Engine switched to v${newVersion}`);
        return true;
      } else {
        throw new Error(`Engine version ${newVersion} not found`);
      }
    } catch (error) {
      console.error(`❌ Failed to switch engine version: ${error.message}`);
      return false;
    }
  }

  async saveEngineCode(code, version = null) {
    const targetVersion = version || `v${Date.now()}`;
    const enginePath = path.join(VERSIONS_DIR, `engine_${targetVersion}.js`);
    
    fs.writeFileSync(enginePath, code, 'utf8');
    console.log(`💾 Engine code saved as v${targetVersion} at ${enginePath}`);
    
    return targetVersion;
  }

  getStatus() {
    return {
      currentVersion: this.currentVersion,
      ready: this.readyFlag,
      versions: fs.existsSync(VERSIONS_DIR) 
        ? fs.readdirSync(VERSIONS_DIR)
            .filter(f => f.endsWith('.js') && !f.includes('current'))
            .map(f => f.replace('engine_', '').replace('.js', ''))
        : [],
      cacheSize: this.cache.size
    };
  }
}

const engineLoader = new EngineLoader();
export default engineLoader;
