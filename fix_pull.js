const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf-8');

// 1. Update checkGDriveLoginStatus setTimeout to pass true
content = content.replace(
  /setTimeout\(autoSyncWithDrive, 500\);/g,
  `setTimeout(() => autoSyncWithDrive(true), 500);`
);

// 2. Update scheduleGDriveTokenRefresh to pass false
content = content.replace(
  /gdrivePollInterval = setInterval\(autoSyncWithDrive, 3000\);/g,
  `gdrivePollInterval = setInterval(() => autoSyncWithDrive(false), 3000);`
);

// 3. Update autoSyncWithDrive signature
content = content.replace(
  /async function autoSyncWithDrive\(\) \{/g,
  `async function autoSyncWithDrive(forcePull = false) {`
);

// 4. Update the logic inside autoSyncWithDrive
content = content.replace(
  /if \(driveModified > localModified\) \{/g,
  `if (forcePull || driveModified > localModified) {`
);

fs.writeFileSync('app.js', content, 'utf-8');
console.log('done');
