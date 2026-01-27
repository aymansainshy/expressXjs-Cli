export interface ScanConfig {
  sourceDir: string;
  outDir: string;
}

export interface FileCache {
  version: string;
  decoratorFiles: string[];
  totalScanned: number;
  generatedAt: string;
  environment: 'development' | 'production';
}
