const fs = require('fs');
const content = fs.readFileSync('d:/EMON/procurement_project/krl-command-center/src/pages/AdminPanelPage.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Work Order') || lines[i].includes('work-order') || lines[i].includes('woList') || lines[i].includes('workOrdersList')) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
