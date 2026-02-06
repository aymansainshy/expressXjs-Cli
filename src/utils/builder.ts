// ============================================
// CLI: BUILD COMMAND
// ============================================

import path from "path";
import { CachedFileMetadata, FileCache } from "../constant/scanInerfaces";
import { ExpressXScanner } from "@expressx/core/scanner";

export async function buildCommand(): Promise<void> {
  console.log('\n🔨 ExpressX Build Process\n');
  console.log('═'.repeat(60) + '\n');

  try {
    const config = ExpressXScanner.getConfig();

    // Step 1: Scan source files
    console.log('📦 Step 1/2: Scanning source files...\n');
    const devCache = await ExpressXScanner.fullScan(true);

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
          .replace(config.sourceDir + '/', config.outDir + '/')
          .replace(/\.ts$/, '.js')
      })
      ),
      totalScanned: devCache.totalScanned,
      generatedAt: new Date().toISOString(),
      environment: 'production'
    };

    ExpressXScanner.saveCache(prodCache, false);
    const prodCachePath = path.join(config.outDir, '.expressx', 'cache.json');

    console.log(`✅ Production cache generated!`);
    console.log(`   Location: ${prodCachePath}`);
    console.log(`   Files tracked: ${prodCache.decoratorFiles.length}\n`);

    console.log('═'.repeat(60));
    console.log('✅ Build preparation complete!\n');
    console.log('💡 Next step: Run TypeScript compiler');
    console.log('   Command: tsc\n');
    console.log('📋 Remember to include dist/.expressx/ in your deployment!\n');

  } catch (err) {
    console.error('\n❌ Build failed:', (err as Error).message);
    process.exit(1);
  }
}
