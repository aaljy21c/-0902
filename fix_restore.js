const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf-8');

// Fix 1: Manual Restore
content = content.replace(
  /const restoreData = await contentRes\.json\(\);[\s\S]*?loadFromLocalStorage\(\);/g,
  `const restoreData = await contentRes.json();

        if (restoreData.preferences) {
          const prefs = restoreData.preferences;
          if (prefs.theme) safeStorageSet('neon_planner_theme', prefs.theme);
          if (prefs.fontSize) safeStorageSet('neon_planner_font_size', prefs.fontSize);
          if (prefs.dateSize) safeStorageSet('neon_planner_date_size', prefs.dateSize);
          if (prefs.bgHue) safeStorageSet('neon_planner_bg_hue', prefs.bgHue);
          if (prefs.bgIntensity) safeStorageSet('neon_planner_bg_intensity', prefs.bgIntensity);
          if (prefs.accentColor) safeStorageSet('neon_planner_accent_color', prefs.accentColor);
          if (prefs.accentIntensity) safeStorageSet('neon_planner_accent_intensity', prefs.accentIntensity);
          if (prefs.showCalendar) safeStorageSet('neon_planner_show_calendar', prefs.showCalendar);
          if (prefs.showTodos) safeStorageSet('neon_planner_show_todos', prefs.showTodos);
          if (prefs.showRecords) safeStorageSet('neon_planner_show_records', prefs.showRecords);
          if (prefs.showAnalytics) safeStorageSet('neon_planner_show_analytics', prefs.showAnalytics);
          if (prefs.showSearch) safeStorageSet('neon_planner_show_search', prefs.showSearch);
          if (prefs.buttonOrder) safeStorageSet('neon_planner_button_order', prefs.buttonOrder);
        }
        
        loadFromLocalStorage(restoreData);
        triggerGDriveAutoSync();`
);

// Fix 2: Revision Recover
content = content.replace(
  /const restoreData = await dlRes\.json\(\);[\s\S]*?loadFromLocalStorage\(\);/g,
  `const restoreData = await dlRes.json();
              
              if (restoreData.preferences) {
                const prefs = restoreData.preferences;
                if (prefs.theme) safeStorageSet('neon_planner_theme', prefs.theme);
                if (prefs.fontSize) safeStorageSet('neon_planner_font_size', prefs.fontSize);
                if (prefs.dateSize) safeStorageSet('neon_planner_date_size', prefs.dateSize);
                if (prefs.bgHue) safeStorageSet('neon_planner_bg_hue', prefs.bgHue);
                if (prefs.bgIntensity) safeStorageSet('neon_planner_bg_intensity', prefs.bgIntensity);
                if (prefs.accentColor) safeStorageSet('neon_planner_accent_color', prefs.accentColor);
                if (prefs.accentIntensity) safeStorageSet('neon_planner_accent_intensity', prefs.accentIntensity);
                if (prefs.showCalendar) safeStorageSet('neon_planner_show_calendar', prefs.showCalendar);
                if (prefs.showTodos) safeStorageSet('neon_planner_show_todos', prefs.showTodos);
                if (prefs.showRecords) safeStorageSet('neon_planner_show_records', prefs.showRecords);
                if (prefs.showAnalytics) safeStorageSet('neon_planner_show_analytics', prefs.showAnalytics);
                if (prefs.showSearch) safeStorageSet('neon_planner_show_search', prefs.showSearch);
                if (prefs.buttonOrder) safeStorageSet('neon_planner_button_order', prefs.buttonOrder);
              }
              
              loadFromLocalStorage(restoreData);
              triggerGDriveAutoSync();`
);

fs.writeFileSync('app.js', content, 'utf-8');
console.log('done');
