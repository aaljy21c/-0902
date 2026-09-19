const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf-8');
const lines = content.split('\n');

for (let i = 4000; i < lines.length; i++) {
  if (lines[i].includes('window.location.reload();')) {
    console.log('Found reload at line: ', i + 1);
    
    // Replace reload with UI updates
    lines[i] = `// window.location.reload();
              updateUI();
              const modal = document.getElementById('gdrive-recovery-modal');
              if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
              }
              if (typeof triggerGDriveAutoSync === 'function') triggerGDriveAutoSync();
    `;
  }
}

fs.writeFileSync('app.js', lines.join('\n'), 'utf-8');
console.log('done');
