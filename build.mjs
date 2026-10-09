import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(rootDir, 'dist');
const publicDir = join(rootDir, 'public');
const srcDir = join(rootDir, 'src');

const copyRecursive = (source, target) => {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const src = join(source, entry.name);
    const dst = join(target, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(src, dst);
    } else {
      cpSync(src, dst);
    }
  }
};

const buildExtension = async () => {
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  await build({
    entryPoints: {
      'background/service-worker': join(srcDir, 'background', 'service-worker.ts'),
      'content/index': join(srcDir, 'content', 'index.ts'),
      'popup/popup': join(srcDir, 'popup', 'popup.ts'),
      'options/options': join(srcDir, 'options', 'options.ts'),
      'onboarding/onboarding': join(srcDir, 'onboarding', 'onboarding.ts')
    },
    bundle: true,
    outdir: distDir,
    format: 'esm',
    platform: 'browser',
    target: ['chrome120'],
    sourcemap: false,
    minify: false,
    logLevel: 'info'
  });

  if (existsSync(publicDir)) {
    copyRecursive(publicDir, distDir);
  }
};

await buildExtension();
