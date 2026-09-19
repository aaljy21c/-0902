const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf-8');

const correctBackupData = `const backupData = {
          todos: state.todos || {},
          diaries: state.diaries || {},
          categories: state.categories || {},
          tabIcons: state.tabIcons || {},
          appTitle: state.appTitle || '',
          ddays: state.ddays || [],
          routines: state.routines || [],
          routinesPopulatedDates: state.routinesPopulatedDates || {},
          preferences: {
            theme: localStorage.getItem('neon_planner_theme') || 'dark',
            fontSize: localStorage.getItem('neon_planner_font_size') || '16',
            dateSize: localStorage.getItem('neon_planner_date_size') || '14',
            bgHue: localStorage.getItem('neon_planner_bg_hue') || '0',
            bgIntensity: localStorage.getItem('neon_planner_bg_intensity') || '0',
            accentColor: localStorage.getItem('neon_planner_accent_color') || 'indigo',
            accentIntensity: localStorage.getItem('neon_planner_accent_intensity') || '100',
            showCalendar: localStorage.getItem('neon_planner_show_calendar') || 'true',
            showTodos: localStorage.getItem('neon_planner_show_todos') || 'true',
            showRecords: localStorage.getItem('neon_planner_show_records') || 'true',
            showAnalytics: localStorage.getItem('neon_planner_show_analytics') || 'false',
            showSearch: localStorage.getItem('neon_planner_show_search') || 'true',
            buttonOrder: localStorage.getItem('neon_planner_button_order') || ''
          },
          lastModified: Date.now()
        };`;

// In triggerGDriveAutoSync (around line 1396)
content = content.replace(
  /const backupData = \{[\s\S]*?showSearch: localStorage\.getItem\('neon_planner_show_search'\) \|\| 'true',\s*buttonOrder: localStorage\.getItem\('neon_planner_button_order'\) \|\| ''\s*\}\s*\};/g,
  correctBackupData
);

fs.writeFileSync('app.js', content, 'utf-8');
console.log('done');
