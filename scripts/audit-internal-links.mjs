import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'src', 'app');
const sourceRoot = path.join(root, 'src');

async function walk(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry);
    const info = await stat(absolute);
    if (info.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }
  return files;
}

function pageRoute(file) {
  const relative = path.relative(appRoot, path.dirname(file)).split(path.sep);
  const segments = relative.filter((segment) => segment && !segment.startsWith('('));
  if (!segments.length) return '/';
  return `/${segments.join('/')}`;
}

function normalizeHref(raw) {
  const withoutFragment = raw.split('#', 1)[0];
  const withoutQuery = withoutFragment.split('?', 1)[0];
  if (!withoutQuery) return '/';
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/$/, '') : withoutQuery;
}

const appFiles = await walk(appRoot);
const pageRoutes = new Set(
  appFiles
    .filter((file) => file.endsWith(`${path.sep}page.tsx`) || file.endsWith(`${path.sep}page.ts`))
    .map(pageRoute)
);

const sourceFiles = (await walk(sourceRoot)).filter((file) => /\.(tsx?|jsx?)$/.test(file));
const hrefPatterns = [
  /\bhref\s*=\s*["'](\/[^"'<>]*)["']/g,
  /\bhref\s*:\s*["'](\/[^"']*)["']/g,
];

const allowedFiles = new Set(['/robots.txt', '/sitemap.xml', '/favicon.ico']);
const missing = [];

for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  for (const pattern of hrefPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const raw = match[1];
      if (raw.includes('${') || raw.includes('{')) continue;
      const route = normalizeHref(raw);
      if (
        pageRoutes.has(route) ||
        allowedFiles.has(route) ||
        route.startsWith('/api/') ||
        route.startsWith('/_next/')
      ) {
        continue;
      }
      missing.push({
        file: path.relative(root, file),
        href: raw,
        route,
      });
    }
  }
}

if (missing.length) {
  console.error('Broken literal internal links detected:');
  for (const item of missing) {
    console.error(`- ${item.file}: ${item.href} -> missing route ${item.route}`);
  }
  process.exit(1);
}

console.log(`Internal link audit passed for ${pageRoutes.size} application routes and ${sourceFiles.length} source files.`);
