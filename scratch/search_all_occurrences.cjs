const fs = require('fs');
const content = fs.readFileSync('d:/EMON/procurement_project/krl-command-center/src/pages/AdminPanelPage.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('showWOForm')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
