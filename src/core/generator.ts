import path from "path";
import fs from 'fs';
import { templates } from "../constant/appComponents";
import { toKebabCase } from "../utils/toKebabCase";
import { toPascalCase } from "../utils/toPascalCase";
import { colors } from "../constant/colors";
import { ScanConfig } from "../constant/scanInerfaces";



// --- Generators ---
export class Generator {
  private sourceDir: string;

  constructor() {
    this.sourceDir = this.getConfig().sourceDir;
  }

  getConfig(): ScanConfig {
    const pkgPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(pkgPath)) {
      throw new Error('❌ package.json not found in current directory.');
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    if (!pkg.expressx?.sourceDir) {
      throw new Error(
        '❌ Missing "expressx.sourceDir" in package.json.\n\n' +
        'Add this configuration:\n' +
        '{\n' +
        '  "expressx": {\n' +
        '    "sourceDir": "src"\n' +
        '  }\n' +
        '}'
      );
    }

    return {
      sourceDir: pkg.expressx.sourceDir,
      outDir: pkg.expressx.outDir
    };
  }


  generate(type: string, name: string, customPath?: string): void {
    const className = toPascalCase(name);
    const fileName = toKebabCase(name);

    if (!templates[type as keyof typeof templates]) {
      throw new Error(`Unknown type: ${type}. Available: controller, service, middleware, interceptor, application`);
    }

    const content = templates[type as keyof typeof templates](className);

    // Determine file path
    let filePath: string;
    if (customPath) {
      filePath = path.join(process.cwd(), customPath, `${fileName}.${type}.ts`);
    } else {
      filePath = path.join(process.cwd(), this.sourceDir, `${fileName}.${type}.ts`);
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Check if file exists
    if (fs.existsSync(filePath)) {
      console.log(colors.yellow(`⚠️  File already exists: ${filePath}`));
      console.log(colors.gray('Use --force to overwrite'));
      return;
    }

    // Write file
    fs.writeFileSync(filePath, content);
    console.log(colors.green(`✅ Created ${type}: ${path.relative(process.cwd(), filePath)}`));
  }
}
