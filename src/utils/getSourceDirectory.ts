import path from 'path';
import fs from 'fs';


// --- Utilities ---
export function getSourceDirectory(): string {
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, 'package.json');

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.expressx?.sourceDir) {
        return pkg.expressx.sourceDir.replace(/^\.\//, '').replace(/\/$/, '');
      }
    } catch (err) {
      // Ignore
    }
  }

  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    try {
      const content = fs.readFileSync(tsconfigPath, 'utf-8');
      const cleaned = content
        .replace(/\/\/.*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,(\s*[}\]])/g, '$1');

      const tsconfig = JSON.parse(cleaned);

      if (tsconfig.compilerOptions?.rootDir) {
        return tsconfig.compilerOptions.rootDir.replace(/^\.\//, '').replace(/\/$/, '');
      }
      if (tsconfig.compilerOptions?.baseUrl) {
        return tsconfig.compilerOptions.baseUrl.replace(/^\.\//, '').replace(/\/$/, '');
      }
    } catch (err) {
      // Ignore
    }
  }

  return 'src';
}