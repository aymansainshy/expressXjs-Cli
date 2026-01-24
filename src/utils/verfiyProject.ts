import fs from 'fs';
import path from 'path';

export function verifyExpressXProject(): void {
    const pkgPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(pkgPath)) {
        throw new Error('❌ No package.json found.');
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (!deps['@expressx/core']) {
        throw new Error('❌ @expressx/core is not installed in this project.');
    }
}

