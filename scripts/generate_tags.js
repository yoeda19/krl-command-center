import fs from 'fs';
import path from 'path';

const SRC_DIR = './src';
const OUTPUT_FILE = './src/code-outline.json';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const symbols = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Match Function Declarations (e.g. function test(), export async function test())
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
    if (funcMatch) {
      symbols.push({ name: funcMatch[1], type: 'function', line: lineNum });
      return;
    }

    // Match Const Arrow Functions / Hooks (e.g. const useTest = () =>, export const test = async () =>)
    const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)?\s*=>/);
    if (arrowMatch) {
      const name = arrowMatch[1];
      const type = name.startsWith('use') ? 'hook' : 'arrow-function';
      symbols.push({ name, type, line: lineNum });
      return;
    }

    // Match Interfaces
    const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({ name: interfaceMatch[1], type: 'interface', line: lineNum });
      return;
    }

    // Match Classes
    const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({ name: classMatch[1], type: 'class', line: lineNum });
      return;
    }
  });

  return symbols;
}

function generate() {
  console.log('🔄 Scanning codebase to generate token-saving outlines...');
  const files = walk(SRC_DIR);
  const outline = {};

  files.forEach(file => {
    const relativePath = path.relative('.', file).replace(/\\/g, '/');
    const symbols = parseFile(file);
    if (symbols.length > 0) {
      outline[relativePath] = symbols;
    }
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outline, null, 2), 'utf8');
  console.log(`✅ Code outline generated successfully at: ${OUTPUT_FILE}`);
  console.log(`📊 Indexed ${Object.keys(outline).length} files containing functions, hooks, and classes.`);
}

generate();
