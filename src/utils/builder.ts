import path from "path";
import { CachedFileMetadata, FileCache } from "../constant/scanInerfaces";
import { ExpressXScanner } from "@expressx/core/scanner";
import { colors } from "../constant/colors";

export interface BuildOptions {
  output?: string;
  minify?: boolean;
  sourcemap?: boolean;
  verbose?: boolean;
}

export async function buildCommand(options: BuildOptions = {}): Promise<void> {
  const verbose = options.verbose || false;

  console.log('\n🔨 ExpressX Build Process\n');
  console.log('═'.repeat(60) + '\n');

  // Show build options
  if (verbose) {
    console.log(colors.cyan('⚙️  Build Options:'));
    if (options.output) console.log(`   Output: ${options.output}`);
    if (options.minify) console.log('   Minify: enabled');
    if (options.sourcemap) console.log('   Source maps: enabled');
    console.log('');
  }

  try {
    const config = ExpressXScanner.getConfig();

    // Override output directory if specified
    const outputDir = options.output || config.outDir;

    // Step 1: Scan source files
    console.log('📦 Step 1/2: Scanning source files...\n');
    const devCache = await ExpressXScanner.fullScan(true);

    if (verbose) {
      console.log(colors.gray(`   Total files scanned: ${devCache.totalScanned}`));
      console.log(colors.gray(`   Decorator files found: ${devCache.decoratorFiles.length}`));
      console.log('');
    }

    // Save development cache
    ExpressXScanner.saveCache(devCache, true);
    const devCachePath = path.join(config.sourceDir, '.expressx', 'cache.json');
    console.log(`💾 Development cache saved: ${devCachePath}\n`);

    // Step 2: Generate production cache
    console.log('📦 Step 2/2: Generating production cache...\n');

    // Convert source paths to compiled paths
    const prodCache: FileCache = {
      version: devCache.version,
      decoratorFiles: devCache.decoratorFiles.map((data: CachedFileMetadata) =>
      ({
        ...data,
        path: data.path
          .replace(config.sourceDir + '/', outputDir + '/')
          .replace(/\.ts$/, '.js')
      })
      ),
      totalScanned: devCache.totalScanned,
      generatedAt: new Date().toISOString(),
      environment: 'production'
    };

    ExpressXScanner.saveCache(prodCache, false);
    const prodCachePath = path.join(outputDir, '.expressx', 'cache.json');

    console.log(`✅ Production cache generated!`);
    console.log(`   Location: ${prodCachePath}`);
    console.log(`   Files tracked: ${prodCache.decoratorFiles.length}\n`);

    // Show TypeScript compilation hints
    console.log('═'.repeat(60));
    console.log('✅ Build preparation complete!\n');
    console.log('💡 Next step: Run TypeScript compiler');

    if (options.minify || options.sourcemap || options.output) {
      console.log('   Note: Additional options detected. Configure your tsconfig.json:');
      if (options.output) {
        console.log(`   - Set "outDir": "${outputDir}"`);
      }
      if (options.sourcemap) {
        console.log('   - Set "sourceMap": true');
      }
      if (options.minify) {
        console.log('   - Consider using a bundler like esbuild or webpack for minification');
      }
    }

    console.log('   Command: tsc\n');
    console.log(`📋 Remember to include ${outputDir}/.expressx/ in your deployment!\n`);

    if (verbose) {
      console.log(colors.gray('═'.repeat(60)));
      console.log(colors.gray('Build Summary:'));
      console.log(colors.gray(`  Source dir: ${config.sourceDir}`));
      console.log(colors.gray(`  Output dir: ${outputDir}`));
      console.log(colors.gray(`  Cache files: 2 (dev + prod)`));
      console.log(colors.gray(`  Decorator files: ${prodCache.decoratorFiles.length}`));
      console.log(colors.gray('═'.repeat(60) + '\n'));
    }

  } catch (err) {
    console.error('\n❌ Build failed:', (err as Error).message);

    if (verbose && err instanceof Error) {
      console.error(colors.gray('\nStack trace:'));
      console.error(colors.gray(err.stack || 'No stack trace available'));
    }

    process.exit(1);
  }
}