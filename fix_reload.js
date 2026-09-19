const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf-8');

// We want to replace the block after `loadFromLocalStorage(restoreData);`
// Specifically:
// if (typeof triggerGDriveAutoSync === 'function') triggerGDriveAutoSync();
// alert('복원이 어쩌고 저쩌고');
// window.location.reload();

content = content.replace(
  /if \(typeof triggerGDriveAutoSync === 'function'\) triggerGDriveAutoSync\(\);[\s\S]*?window\.location\.reload\(\);/g,
  `if (typeof triggerGDriveAutoSync === 'function') triggerGDriveAutoSync();
              
              updateUI();
              const modal = document.getElementById('gdrive-recovery-modal');
              if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
              }
              
              alert('과거 기록이 성공적으로 복원되었습니다!');`
);

fs.writeFileSync('app.js', content, 'utf-8');
console.log('done');
