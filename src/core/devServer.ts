
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import { colors } from "../constant/colors";
import { spawn, ChildProcess } from 'child_process';
import { IGNORE_PATTERNS } from "../constant/ignoreFiles";
import { FileCache } from '../constant/scanInerfaces';
import { ExpressXScanner } from './scanner';

// ============================================
// CLI: DEV SERVER WITH HOT RELOAD
// ============================================

export class DevServer {
  private child: ChildProcess | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isRestarting = false;
  private cache: FileCache | null = null;
  private restartTimeout: NodeJS.Timeout | null = null;

  private entry: string;
  constructor(entery: string) {
    this.entry = entery
  }

  async start(): Promise<void> {
    console.log('\n🛠  ExpressX Development Server\n');
    console.log('═'.repeat(60) + '\n');

    await this.initializeCache();
    this.startApp();
    this.setupWatcher();
    this.setupGracefulShutdown();
  }

  /**
   * Load or create cache
   */
  private async initializeCache(): Promise<void> {
    this.cache = ExpressXScanner.loadCache(true);

    if (this.cache) {
      const cacheAge = Date.now() - new Date(this.cache.generatedAt).getTime();
      const ageMinutes = Math.round(cacheAge / 60000);

      console.log(`✅ Cache loaded: ${this.cache.decoratorFiles.length} decorator files`);
      console.log(`   Last updated: ${ageMinutes} minute(s) ago\n`);
    } else {
      console.log('🔍 No cache found - performing initial scan...\n');
      this.cache = await ExpressXScanner.fullScan(true);
      ExpressXScanner.saveCache(this.cache, true);
      console.log(`💾 Cache created and saved\n`);
    }
  }

  /**
   * Start the application process
   */
  private startApp(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }

    // const config = ExpressXScanner.getConfig();
    // const entryFile = path.join(config.sourceDir, this.entry);

    // if (!fs.existsSync(entryFile)) {
    //   throw new Error(
    //     `❌ Entry file not found: ${entryFile}\n` +
    //     `   Please create ${config.sourceDir}/index.ts`
    //   );
    // }

    process.env.EXPRESSX_RUNTIME = 'ts';
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    console.log('🚀 Starting application...\n');

    this.child = spawn(
      'node',
      [
        '--require', '@expressx/core/runtime',
        '--enable-source-maps',
        this.entry
      ],
      {
        stdio: 'inherit',
        env: process.env,
        cwd: process.cwd()
      }
    );

    this.child.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' || this.isRestarting) {
        return;
      }

      if (code !== 0) {
        console.log(colors.red(`\n❌ Process exited with code ${code}`));
        console.log(colors.yellow('Waiting for file changes to restart...\n'));
      }
    });

    this.child.on('error', (err) => {
      console.error(colors.red(`❌ Failed to start process: ${err.message}`));
    });
  }

  /**
   * Setup file watcher
   */
  private setupWatcher(): void {
    const config = ExpressXScanner.getConfig();
    const watchPattern = `${config.sourceDir}/**/*.ts`;

    console.log(`👀 Watching: ${watchPattern}\n`);
    console.log('═'.repeat(60) + '\n');

    this.watcher = chokidar.watch(watchPattern, {
      ignored: IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    this.watcher.on('change', (filepath) => this.handleFileChange(filepath, 'changed'));
    this.watcher.on('add', (filepath) => this.handleFileChange(filepath, 'added'));
    this.watcher.on('unlink', (filepath) => this.handleFileChange(filepath, 'deleted'));
  }

  /**
   * Handle file changes
   */
  private handleFileChange(filepath: string, action: string): void {
    if (!this.cache) return;

    const relativePath = path.relative(process.cwd(), filepath).replace(/\\/g, '/');
    const absolutePath = path.resolve(filepath);

    console.log(`📝 File ${action}: ${relativePath}`);

    let cacheUpdated = false;

    if (action === 'deleted') {
      // Remove from cache
      const index = this.cache.decoratorFiles.indexOf(relativePath);
      if (index !== -1) {
        this.cache.decoratorFiles.splice(index, 1);
        console.log(`   ➖ Removed from cache`);
        cacheUpdated = true;
      }
    } else {
      // Check if file has decorators
      const hasDecorators = this.checkForDecorators(absolutePath);
      const isInCache = this.cache.decoratorFiles.includes(relativePath);

      if (hasDecorators && !isInCache) {
        this.cache.decoratorFiles.push(relativePath);
        console.log(`   ➕ Added to cache (decorator detected)`);
        cacheUpdated = true;
      } else if (!hasDecorators && isInCache) {
        this.cache.decoratorFiles = this.cache.decoratorFiles.filter(f => f !== relativePath);
        console.log(`   ⚠️  Removed from cache (decorators removed)`);
        cacheUpdated = true;
      }
    }

    // Update cache timestamp and save
    if (cacheUpdated) {
      this.cache.generatedAt = new Date().toISOString();
      ExpressXScanner.saveCache(this.cache, true);
      console.log(`Cache size: ${this.cache.decoratorFiles.length} files`);
      return;
    }


    this.scheduleRestart();
  }

  /**
   * Check if file contains decorators
   */
  private checkForDecorators(filepath: string): boolean {
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      return content.includes('@expressx/core') &&
        ExpressXScanner['DECORATORS'].some((dec: any) => content.includes(dec));
    } catch {
      return false;
    }
  }

  /**
   * Schedule application restart (debounced)
   */
  private scheduleRestart(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }

    this.restartTimeout = setTimeout(() => {
      this.restart();
    }, 300);
  }

  /**
   * Restart the application
   */
  private restart(): void {
    if (this.isRestarting) return;

    this.isRestarting = true;
    console.log(colors.cyan('🔄 Restarting...\n'));

    if (this.child) {
      this.child.once('exit', () => {
        this.isRestarting = false;
        this.startApp();
      });
      this.child.kill('SIGTERM');
    } else {
      this.isRestarting = false;
      this.startApp();
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      console.log(colors.yellow(`\n\n🛑 Received ${signal}, shutting down gracefully...`));

      if (this.watcher) {
        this.watcher.close();
      }

      if (this.child) {
        this.child.kill('SIGTERM');
        setTimeout(() => {
          if (this.child && !this.child.killed) {
            this.child.kill('SIGKILL');
          }
          process.exit(0);
        }, 5000);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}