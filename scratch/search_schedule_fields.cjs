const fs = require('fs');
const content = fs.readFileSync('d:/EMON/procurement_project/krl-command-center/src/pages/AdminPanelPage.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 1050; i < 1120; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
