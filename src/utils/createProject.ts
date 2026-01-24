import path from 'path';
import fs from 'fs';
import { colors } from '../constant/colors';
import { toPascalCase } from './toPascalCase';

// --- Project Scaffolding ---
export function createProject(projectName: string): void {
  const projectPath = path.join(process.cwd(), projectName);

  if (fs.existsSync(projectPath)) {
    console.error(colors.red(`❌ Directory already exists: ${projectName}`));
    process.exit(1);
  }

  console.log(colors.cyan(`\n🎨 Creating new ExpressX project: ${projectName}\n`));

  // Create directory structure
  fs.mkdirSync(projectPath);
  fs.mkdirSync(path.join(projectPath, 'src'));

  // Create package.json
  const packageJson = {
    name: projectName,
    version: '1.0.0',
    description: 'ExpressX application',
    main: 'dist/index.js',
    scripts: {
      dev: 'expressx start',
      build: 'tsc',
      start: 'node dist/index.js',
      'generate:controller': 'expressx generate controller',
      'generate:service': 'expressx generate service'
    },
    dependencies: {
      '@expressx/core': '^1.0.0'
    },
    devDependencies: {
      '@expressx/cli': '^1.0.0',
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'ts-node': '^10.9.0'
    }
  };

  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      moduleResolution: 'node',
      declaration: true,
      declarationMap: true,
      sourceMap: true
    },
    include: ['src'],
    exclude: ['node_modules', 'dist']
  };

  fs.writeFileSync(
    path.join(projectPath, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // Create .gitignore
  const gitignore = `node_modules/
dist/
*.log
.env
.DS_Store
`;

  fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore);

  // Create main application file
  const mainApp = `import { ExpressX, Application } from '@expressx/core';

@Application({
  port: 3000
})
export class ${toPascalCase(projectName)}App extends ExpressX {
  async onInit() {
    console.log('🚀 ${projectName} is starting...');
  }

  async onReady() {
    console.log('✅ ${projectName} is ready!');
    console.log(\`🌍 Server running at http://localhost:\${this.config.port}\`);
  }
}
`;

  fs.writeFileSync(path.join(projectPath, 'src', 'main.ts'), mainApp);

  // Create example controller
  const exampleController = `import { Controller, Get } from '@expressx/core';

@Controller('/api')
export class AppController {
  @Get('/')
  async index() {
    return {
      message: 'Welcome to ${projectName}!',
      version: '1.0.0'
    };
  }

  @Get('/health')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  }
}
`;

  fs.writeFileSync(path.join(projectPath, 'src', 'app.controller.ts'), exampleController);

  // Create README
  const readme = `# ${projectName}

A new ExpressX application.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
\`\`\`

## Generate Code

\`\`\`bash
# Generate controller
expressx generate controller User

# Generate service
expressx generate service Auth

# Generate middleware
expressx generate middleware Logger
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── main.ts              # Application entry point
│   └── app.controller.ts    # Example controller
├── package.json
├── tsconfig.json
└── README.md
\`\`\`
`;

  fs.writeFileSync(path.join(projectPath, 'README.md'), readme);

  console.log(colors.green('✅ Project created successfully!\n'));
  console.log(colors.bold('Next steps:\n'));
  console.log(colors.cyan(`  cd ${projectName}`));
  console.log(colors.cyan('  npm install'));
  console.log(colors.cyan('  npm run dev\n'));
}
