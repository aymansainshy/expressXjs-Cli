#!/usr/bin/env node

import { getEntrypoint } from "./utils/getEntrypoint";

// --- Commands ---
const command = process.argv[2] ?? 'start:dev';

async function bootstrap() {
  switch (command) {
    case 'start:dev':
      await devBootstrap();
      break;
    case 'create':
      console.log('✨ Scaffolding new project...');
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }
}

async function devBootstrap() {
  try {
    const entry = getEntrypoint();

    console.log(`\x1b[36m%s\x1b[0m`, `🛠  ExpressX: Starting dev server...`);
    console.log(`\x1b[90m%s\x1b[0m`, `Entry: ${entry}\n`);

    // Set environment flag
    process.env.EXPRESSX_RUNTIME = 'ts';

    // Register TS runtime (requires @expressx/core to have this bootstrap file)
    // This usually contains: require('ts-node/register'); require('tsconfig-paths/register');
    require('@expressx/core/runtime');

    // Dynamically require the user's entrypoint
    require(entry);

  } catch (err: any) {
    console.error(`\x1b[31m❌ Error:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}

bootstrap();