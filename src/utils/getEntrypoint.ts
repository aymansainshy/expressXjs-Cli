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

    // 1. Check package.json
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

        // Support standard "main" or a framework-specific key
        const definedEntry = pkg.expressx?.entry || pkg.main;

        if (definedEntry) {
            const absolutePath = path.resolve(root, definedEntry);
            // If the user pointed to a .js file but we are in dev mode, 
            // we try to find the .ts equivalent first
            const tsVersion = absolutePath.replace(/\.js$/, '.ts');

            if (fs.existsSync(tsVersion)) return tsVersion;
            if (fs.existsSync(absolutePath)) return absolutePath;
        }
    }

    // 2. Try Fallbacks
    for (const file of FALLBACK_ENTRIES) {
        const fullPath = path.join(root, file);
        if (fs.existsSync(fullPath)) return fullPath;
    }

    throw new Error(
        'Could not find an entrypoint. Please define "main" in package.json or create src/main.ts'
    );
}