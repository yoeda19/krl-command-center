const fs = require('fs');
const content = fs.readFileSync('d:/EMON/procurement_project/krl-command-center/src/pages/WorkOrderPage.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Master BOM') || line.includes('BOM (Bill of Materials)')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
console.log('--- checking surrounding lines around 400-450 ---');
for (let i = 400; i < 450; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
