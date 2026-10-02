import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set(['node_modules', '.next', '.git', '.vercel', 'coverage', 'SOURCE_CODE.md']);
async function list(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignored.has(entry.name) || (entry.name.startsWith('.env') && entry.name !== '.env.example') || entry.name.endsWith('.log')) continue;
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await list(path.join(dir, entry.name), relative + '/'));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}
function tree(files) {
  const nodes = {};
  for (const file of files) {
    let current = nodes;
    for (const part of file.split('/')) current = current[part] ||= {};
  }
  function lines(node, prefix = '') {
    const entries = Object.entries(node);
    return entries.flatMap(([name, child], index) => {
      const last = index === entries.length - 1;
      const directory = Object.keys(child).length > 0;
      return [prefix + (last ? '└── ' : '├── ') + name + (directory ? '/' : ''), ...lines(child, prefix + (last ? '    ' : '│   '))];
    });
  }
  return ['eyecon-module-1/', ...lines(nodes)].join('\n');
}
const files = await list(root);
const assets = files.filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
const source = files.filter(f => f !== 'README.md' && !assets.includes(f));
let result = '# Full folder structure\n\n```text\n' + tree([...files, 'SOURCE_CODE.md']) + '\n```\n\n';
result += 'The ZIP contains these files in their actual folders. `node_modules`, `.next` and `.env.local` are created on your machine and are deliberately excluded. `SOURCE_CODE.md` is this generated guide.\n\n# Complete source files\n\nEvery text source file is reproduced below, including the lockfile. Create each file at its exact relative path. The image restoration command follows the source; the full README and setup instructions are last.\n\n';
for (const file of source) {
  const content = await readFile(path.join(root, file), 'utf8');
  const language = file.endsWith('.js') || file.endsWith('.mjs') ? 'javascript' : file.endsWith('.json') ? 'json' : file.endsWith('.css') ? 'css' : file.endsWith('.sql') ? 'sql' : file.endsWith('.svg') ? 'xml' : file.endsWith('.md') ? 'markdown' : 'text';
  const fences = content.match(/`{3,}/g) || [];
  const fence = '`'.repeat(Math.max(3, ...fences.map(f => f.length + 1)));
  result += '## ' + file + '\n\n' + fence + language + '\n' + content + (content.endsWith('\n') ? '' : '\n') + fence + '\n\n';
}
const encoded = {};
for (const file of assets) encoded[file] = (await readFile(path.join(root, file))).toString('base64');
result += '# Complete image assets\n\nThese are binary WebP files, already included in the ZIP. For manual reconstruction, run the following complete Node.js command from the project root. It restores the exact supplied images from Base64; no external download is required. Paste it as a single command in a terminal that supports the shown quoting, or save the JavaScript between the outer quotes as `restore-images.cjs` and run `node restore-images.cjs`. The temporary restoration script is not needed to run the site.\n\n```bash\nnode -e \'const fs=require("node:fs");const path=require("node:path");const assets=' + JSON.stringify(encoded) + ';for(const [name,data] of Object.entries(assets)){fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,Buffer.from(data,"base64"));}\'\n```\n\n';
result += '# README.md — complete setup instructions\n\nSave the following full contents as `README.md`. These instructions follow the source as requested.\n\n' + await readFile(path.join(root, 'README.md'), 'utf8');
await writeFile(path.join(root, 'SOURCE_CODE.md'), result);
console.log(`SOURCE_CODE.md: ${source.length} complete text source files, README, ${assets.length} complete image assets.`);
