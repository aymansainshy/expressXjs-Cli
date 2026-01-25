import path from 'path';
import fs from 'fs';

// --- Configuration ---
const FALLBACK_ENTRIES = [
    'src/main.ts',
    'src/index.ts',
    'main.ts',
    'index.ts'
];


// --- Utilities ---
export function getEntrypoint(): string {
    const root = process.cwd();
    const pkgPath = path.join(root, 'package.json');

    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const definedEntry = pkg.expressx?.main || pkg.main;

        if (definedEntry) {
            const absolutePath = path.resolve(root, definedEntry);
            const tsVersion = absolutePath.replace(/\.js$/, '.ts');

            if (fs.existsSync(tsVersion)) return tsVersion;
            if (fs.existsSync(absolutePath)) return absolutePath;
        }
    }

    for (const file of FALLBACK_ENTRIES) {
        const fullPath = path.join(root, file);
        if (fs.existsSync(fullPath)) return fullPath;
    }

    throw new Error(
        'Could not find an entrypoint. Please define "main" in package.json or create src/main.ts'
    );
}