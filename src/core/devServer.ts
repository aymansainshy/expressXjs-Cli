
import path from 'path';
import chokidar from 'chokidar';
import { colors } from "../constant/colors";
import { spawn, ChildProcess } from 'child_process';
import { IGNORE_PATTERNS } from "../constant/ignoreFiles";
import { getSourceDirectory } from "../utils/getSourceDirectory";

// --- Dev Server with Watch Mode ---
export class DevServer {
  private child: ChildProcess | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isRestarting = false;
  private restartTimeout: NodeJS.Timeout | null = null;
  private entry: string;
  private sourceDir: string;

  constructor(entry: string) {
    this.entry = entry;
    this.sourceDir = getSourceDirectory();
  }

  start(): void {
    console.log(colors.cyan('🛠 ExpressX: Starting dev server...'));
    console.log(colors.gray(`Entry: ${this.entry}`));
    console.log(colors.gray(`Source: ${this.sourceDir}\n`));

    this.startApp();
    this.setupWatcher();
    this.setupGracefulShutdown();
  }

  private startApp(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }

    process.env.EXPRESSX_RUNTIME = 'ts';
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

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

  private setupWatcher(): void {
    console.log(colors.gray('👀 Watching for file changes...\n'));

    const watchPattern = `${this.sourceDir}/**/*.ts`;

    this.watcher = chokidar.watch(watchPattern, {
      ignored: IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    this.watcher.on('change', (filepath) => {
      this.scheduleRestart(filepath);
    });

    this.watcher.on('add', (filepath) => {
      this.scheduleRestart(filepath);
    });

    this.watcher.on('unlink', (filepath) => {
      this.scheduleRestart(filepath);
    });
  }

  private scheduleRestart(filepath: string): void {
    const relativePath = path.relative(process.cwd(), filepath);
    console.log(colors.yellow(`\n📝 File changed: ${relativePath}`));

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
