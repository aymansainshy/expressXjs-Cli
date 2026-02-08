import path from 'path';
import fs, { existsSync } from 'fs';
import chokidar from 'chokidar';
import { colors } from "../constant/colors";
import { spawn, ChildProcess } from 'child_process';
import { IGNORE_PATTERNS } from "../constant/ignoreFiles";
import { CachedFileMetadata, FileCache } from '../constant/scanInerfaces';
import { ExpressXScanner } from '@expressx/core/scanner';
import { frameworkLogo } from '../constant/appStarter';
import { logger } from '../constant/logger';





export interface DevServerOptions {
  nodeFlags?: string[];
  appFlags?: string[];
}

export class DevServer {
  private child: ChildProcess | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private cacheWatcher: chokidar.FSWatcher | null = null;
  private isRestarting = false;
  private cache: FileCache | null = null;
  private restartTimeout: NodeJS.Timeout | null = null;
  private entry: string;
  private options: DevServerOptions;

  constructor(entry: string, options: DevServerOptions = {}) {
    this.entry = entry;
    this.options = {
      nodeFlags: options.nodeFlags || [],
      appFlags: options.appFlags || []
    };
  }

  async start(): Promise<void> {
    console.log(colors.green(`\n${frameworkLogo}\n`));

    // Display enabled flags
    if (this.options.nodeFlags && this.options.nodeFlags.length > 0) {
      console.log(colors.cyan('⚙️  Node.js flags:'));
      this.options.nodeFlags.forEach(arg => {
        console.log(`   ${arg}`);
      });
      console.log('');
    }

    if (this.options.appFlags && this.options.appFlags.length > 0) {
      console.log(colors.green('🎯 Application flags:'));
      this.options.appFlags.forEach(arg => {
        console.log(`   ${arg}`);
      });
      console.log('');
    }

    await this.initializeCache();
    this.watchCacheDirectory();
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
      //  Validate cache entries - remove files that don't exist
      // PHASE 1: Validate existing cached files (fast)
      const { validFiles, updatedCount, removedCount } = await this.validateCachedFiles();

      // Report changes
      const totalChanges = updatedCount + removedCount


      if (totalChanges > 0) {
        this.cache.decoratorFiles = validFiles;
        this.cache.generatedAt = new Date().toISOString();
        ExpressXScanner.saveCache(this.cache, true);

        console.log(colors.cyan('\n📊 Cache Update Summary:'));
        if (updatedCount > 0) console.log(colors.yellow(`   ✏️  Updated: ${updatedCount} file(s)`));
        if (removedCount > 0) console.log(colors.red(`   ➖ Removed: ${removedCount} file(s)`));

      } else {
        logger.info('.expressx.cache is up-to-date! No changes detected.', '.expressx/cache.json');
      }

      const cacheAge = Date.now() - new Date(this.cache.generatedAt).getTime();
      const ageMinutes = Math.round(cacheAge / 60000);

      logger.info(`Total decorator files: ${this.cache.decoratorFiles.length},  Last updated: ${ageMinutes} minute(s) ago`, '.expressx/cache.json');

    } else {
      logger.info('No cache found, creating new cache...', '.expressx/cache.json');

      this.cache = {
        version: '1.0.0',
        decoratorFiles: [],
        totalScanned: 0,
        generatedAt: new Date().toISOString(),
        environment: 'development'
      };
    }
  }


  /**
   * PHASE 1: Validate existing cache entries using metadata
   * Returns: { validFiles, updatedCount, removedCount }
   */
  private async validateCachedFiles(): Promise<{
    validFiles: CachedFileMetadata[];
    updatedCount: number;
    removedCount: number;
  }> {
    const validFiles: CachedFileMetadata[] = [];
    let updatedCount = 0;
    let removedCount = 0;

    for (const cachedFile of this.cache!.decoratorFiles) {
      const absolutePath = path.join(process.cwd(), cachedFile.path);

      try {
        const stats = fs.statSync(absolutePath);

        // FAST PATH: Metadata matches - no need to read file
        if (stats.mtimeMs === cachedFile.mtime && stats.size === cachedFile.size) {
          validFiles.push(cachedFile);
          continue;
        }

        // SLOW PATH: Metadata changed - re-check content
        if (this.checkForDecorators(absolutePath)) {
          validFiles.push({
            path: cachedFile.path,
            mtime: stats.mtimeMs,
            size: stats.size
          });
          updatedCount++;
        } else {
          // File changed and no longer has decorators
          removedCount++;
        }
      } catch {
        // File deleted
        removedCount++;
      }
    }

    return { validFiles, updatedCount, removedCount };
  }

  /**
   * Watch cache directory persistently
   */
  private watchCacheDirectory(): void {
    const config = ExpressXScanner.getConfig();
    const cachePath = path.join(process.cwd(), config.sourceDir, '.expressx', 'cache.json');

    this.cacheWatcher = chokidar.watch(cachePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    // Cache deleted
    this.cacheWatcher.on('unlink', () => {
      console.log('\n⚠️  Cache deleted - resetting to empty cache\n');
      if (this.cache) {
        this.cache.decoratorFiles = [];
        this.cache.totalScanned = 0;
        this.cache.generatedAt = new Date().toISOString();
      }
    });

    // Cache added/recreated
    this.cacheWatcher.on('add', () => {
      // logger.info('Cache created by framework - reloading...', '.expressx/cache.json');
      setTimeout(() => {
        this.cache = ExpressXScanner.loadCache(true);
        // if (this.cache) {
        //   logger.info(`Loaded ${this.cache.decoratorFiles.length} decorator files`, '.expressx/cache.json');
        // }
      }, 100);
    });

    // Cache changed
    this.cacheWatcher.on('change', () => {
      const updatedCache = ExpressXScanner.loadCache(true);
      if (updatedCache) {
        this.cache = updatedCache;
      }
    });
  }

  private startApp(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }

    // Inside your CLI command handler
    if (!this.runDoctor(this.entry)) {
      console.error('\n🚨 Environmental checks failed. Please fix the issues above.');
      process.exit(1);
    }

    process.env.EXPRESSX_RUNTIME = 'ts';
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    logger.info(`Starting application, Entry file: ${this.entry}`, 'Startup');

    // Build complete command array
    // Format: node [nodeFlags] [entry] [appFlags]
    const nodeArgs = [
      ...(this.options.nodeFlags || []),      // Custom Node.js flags (--inspect, etc.)
      '--require', '@expressx/core/runtime',  // Required runtime
      '--enable-source-maps',                 // Source maps
      this.entry,                             // Entry file
      ...(this.options.appFlags || [])        // Application flags (--port, etc.)
    ];

    if (this.options.nodeFlags && this.options.nodeFlags.length > 0) {
      console.log(colors.gray(`   Node flags: ${this.options.nodeFlags.join(' ')}`));
    }
    if (this.options.appFlags && this.options.appFlags.length > 0) {
      console.log(colors.gray(`   App flags: ${this.options.appFlags.join(' ')}`));
    }

    this.child = spawn(
      'node',
      nodeArgs,
      {
        stdio: 'inherit',
        env: process.env,
        cwd: process.cwd()
      }
    );

    this.child.on('exit', (code, signal) => {
      // Clear the child reference when process exits
      const wasRestarting = this.isRestarting;
      this.child = null; // ✅ FIX: Clear reference

      if (signal === 'SIGTERM' || wasRestarting) {
        return;
      }

      if (code !== 0) {
        console.log(colors.red(`\n❌ Process exited with code ${code}`));
        console.log(colors.yellow('⏳ Waiting for file changes to restart...\n'));
      }
    });

    this.child.on('error', (err) => {
      console.error(colors.red(`❌ Failed to start: ${err.message}`));
      this.child = null; // ✅ FIX: Clear reference on spawn error
    });
  }


  private runDoctor(entry: string): boolean {
    logger.info('ExpressXjs Doctor: Checking your environment...', 'doctor');

    const checks = [
      {
        name: 'Entry File',
        passed: existsSync(path.resolve(process.cwd(), entry)),
        error: `Could not find entry file at ${entry}`,
      },
      // {
      //   name: 'Reflect Polyfill',
      //   passed: !!require.resolve('reflect-metadata'),
      //   error: 'reflect-metadata is missing from the dependency tree.',
      // },
      {
        name: 'Runtime Entry',
        passed: !!require.resolve('@expressx/core/runtime'),
        error: '@expressx/core/runtime is not reachable.',
      }
    ];

    let allPassed = true;

    checks.forEach(check => {
      if (check.passed) {
        logger.info(`${check.name}`, 'doctor');
      } else {
        logger.error(`${check.name}: ${check.error}`, 'doctor');
        allPassed = false;
      }
    });

    return allPassed;
  }

  private setupWatcher(): void {
    const config = ExpressXScanner.getConfig();
    const watchPattern = `${config.sourceDir}/**/*.ts`;

    logger.info(`Start Watching file : ${watchPattern}`, 'watcher');

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

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📝 File ${action}: ${relativePath}`);

    let cacheUpdated = false;

    if (action === 'deleted') {
      const index = this.cache.decoratorFiles.findIndex(f => f.path === relativePath);
      if (index !== -1) {
        this.cache.decoratorFiles.splice(index, 1);
        console.log(`   ➖ Removed from cache`);
        cacheUpdated = true;
      }
    } else {
      const hasDecorators = this.checkForDecorators(absolutePath);
      const cachedFile = this.cache.decoratorFiles.find(f => f.path === relativePath);

      if (hasDecorators) {
        const stats = fs.statSync(absolutePath);
        const newData: CachedFileMetadata = {
          path: relativePath,
          mtime: stats.mtimeMs,
          size: stats.size
        };

        if (!cachedFile) {
          this.cache.decoratorFiles.push(newData);
          console.log(`   ➕ Added to cache (decorator detected)`);
          cacheUpdated = true;
        } else if (cachedFile.mtime !== stats.mtimeMs) {
          Object.assign(cachedFile, newData);
          console.log(`   🔄 Updated cache metadata`);
          cacheUpdated = true;
        }
      } else if (cachedFile) {
        this.cache.decoratorFiles = this.cache.decoratorFiles.filter(f => f.path !== relativePath);
        console.log(`   ⚠️  Removed from cache (decorators removed)`);
        cacheUpdated = true;
      }
    }

    // Save cache if updated
    if (cacheUpdated) {
      this.cache.generatedAt = new Date().toISOString();
      ExpressXScanner.saveCache(this.cache, true);
      console.log(`   💾 Cache updated: ${this.cache.decoratorFiles.length} files`);
    } else {
      console.log(`   ℹ️  No cache update (${this.cache.decoratorFiles.length} files)`);
    }

    this.scheduleRestart();
  }

  /**
   * Check if file contains decorators - FIXED VERSION
   */
  private checkForDecorators(filepath: string): boolean {
    try {
      const content = fs.readFileSync(filepath, 'utf-8');

      // Fast-Path 2: Symbol check (instant)
      if (!content.includes('@')) return false;

      // Fast-Path 3: Decorator name substring (fast)
      const decorators = ExpressXScanner['DECORATORS'] as string[];

      return decorators.some(decorator => {
        // Quick substring check before regex
        if (!content.includes(decorator)) return false;

        const decoratorName = decorator.replace('@', '');
        const pattern = new RegExp(`@${decoratorName}(\\s*\\(|\\s|$)`, 'm');
        return pattern.test(content);
      });
    } catch {
      return false;
    }
  }

  private scheduleRestart(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }

    this.restartTimeout = setTimeout(() => {
      this.restart();
    }, 300);
  }

  private restart(): void {
    if (this.isRestarting) return;

    this.isRestarting = true;
    console.log(colors.cyan('\n🔄 Restarting application...\n'));

    if (this.child && !this.child.killed) {
      // Process is still alive - kill it gracefully
      this.child.once('exit', () => {
        this.isRestarting = false;
        this.startApp();
      });
      this.child.kill('SIGTERM');
    } else {
      // Process already dead or doesn't exist - start immediately
      this.isRestarting = false;
      this.startApp();
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      console.log(colors.yellow(`\n\n🛑 Received ${signal} - shutting down gracefully...\n`));

      if (this.watcher) {
        this.watcher.close();
      }

      if (this.cacheWatcher) {
        this.cacheWatcher.close();
      }

      if (this.child) {
        this.child.kill('SIGTERM');
        setTimeout(() => {
          if (this.child && !this.child.killed) {
            this.child.kill('SIGKILL');
          }
          process.exit(0);
        }, 2000);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}