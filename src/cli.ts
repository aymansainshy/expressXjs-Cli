#!/usr/bin/env node

import { verifyExpressXProject } from './utils/verfiyProject';
import { getEntrypoint } from './utils/getEntrypoint';

import { colors } from './constant/colors';
import { createProject } from './utils/createProject';
import { showHelp } from './utils/showHelp';
import { } from './core/generator';
import { Generator } from './core/generator';
import { DevServer } from './core/devServer';

// --- Main Bootstrap ---
async function bootstrap() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  try {
    switch (command) {
      case 'start':
      case 'dev':
        verifyExpressXProject();
        const entry = getEntrypoint();
        const server = new DevServer(entry);
        server.start();
        break;

      case 'new':
      case 'create':
        const projectName = args[1];
        if (!projectName) {
          console.error(colors.red('❌ Please provide a project name'));
          console.log(colors.gray('Usage: expressx new <project-name>'));
          process.exit(1);
        }
        createProject(projectName);
        break;

      case 'generate':
      case 'g':
        verifyExpressXProject();
        const type = args[1];
        const name = args[2];
        const customPath = args[3]; // Optional path

        if (!type || !name) {
          console.error(colors.red('❌ Please provide type and name'));
          console.log(colors.gray('Usage: expressx generate <type> <name> [path]'));
          console.log(colors.gray('Types: controller, service, middleware, interceptor, application'));
          process.exit(1);
        }

        const generator = new Generator();
        generator.generate(type, name, customPath);
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(colors.red(`❌ Unknown command: ${command}`));
        showHelp();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(colors.red(`\n❌ Error: ${err.message}\n`));
    process.exit(1);
  }
}

bootstrap();