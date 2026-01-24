import path from "path";
import fs from 'fs';
import { templates } from "../constant/appComponents";
import { getSourceDirectory } from "../utils/getSourceDirectory";
import { toKebabCase } from "../utils/toKebabCase";
import { toPascalCase } from "../utils/toPascalCase";
import { colors } from "../constant/colors";

// --- Generators ---
export class Generator {
  private sourceDir: string;

  constructor() {
    this.sourceDir = getSourceDirectory();
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
