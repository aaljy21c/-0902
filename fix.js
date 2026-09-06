const fs = require('fs');

const srcPath = 'c:\\\\Users\\\\이진영\\\\Desktop\\\\플래너9.2\\\\플래너9.1\\\\app.js';
const dstPath = 'c:\\\\Users\\\\이진영\\\\Desktop\\\\플래너9.2\\\\app.js';

let content = fs.readFileSync(srcPath, 'utf8');

const oldSync = `      if (contentRes.ok) {
        const restoreData = await contentRes.json();
        if (restoreData.todos) localStorage.setItem('neon_planner_todos', JSON.stringify(restoreData.todos));
        if (restoreData.diaries) localStorage.setItem('neon_planner_diaries', JSON.stringify(restoreData.diaries));
        if (restoreData.categories) localStorage.setItem('neon_planner_categories', JSON.stringify(restoreData.categories));
        if (restoreData.tabIcons) localStorage.setItem('neon_planner_tab_icons', JSON.stringify(restoreData.tabIcons));
        if (restoreData.appTitle) localStorage.setItem('neon_planner_app_title', restoreData.appTitle);
        if (restoreData.ddays) localStorage.setItem('neon_planner_ddays', JSON.stringify(restoreData.ddays));
        if (restoreData.routines) localStorage.setItem('neon_planner_routines', JSON.stringify(restoreData.routines));
        if (restoreData.routinesPopulatedDates) localStorage.setItem('neon_planner_populated_dates', JSON.stringify(restoreData.routinesPopulatedDates));
        if (restoreData.preferences) {
          const prefs = restoreData.preferences;
          if (prefs.theme) localStorage.setItem('neon_planner_theme', prefs.theme);
          if (prefs.fontSize) localStorage.setItem('neon_planner_font_size', prefs.fontSize);
          if (prefs.dateSize) localStorage.setItem('neon_planner_date_size', prefs.dateSize);
          if (prefs.bgHue) localStorage.setItem('neon_planner_bg_hue', prefs.bgHue);
          if (prefs.bgIntensity) localStorage.setItem('neon_planner_bg_intensity', prefs.bgIntensity);
          if (prefs.accentColor) localStorage.setItem('neon_planner_accent_color', prefs.accentColor);
          if (prefs.accentIntensity) localStorage.setItem('neon_planner_accent_intensity', prefs.accentIntensity);
          if (prefs.showCalendar) localStorage.setItem('neon_planner_show_calendar', prefs.showCalendar);
          if (prefs.showTodos) localStorage.setItem('neon_planner_show_todos', prefs.showTodos);
          if (prefs.showRecords) localStorage.setItem('neon_planner_show_records', prefs.showRecords);
          if (prefs.showAnalytics) localStorage.setItem('neon_planner_show_analytics', prefs.showAnalytics);
          if (prefs.showSearch) localStorage.setItem('neon_planner_show_search', prefs.showSearch);
          if (prefs.buttonOrder) localStorage.setItem('neon_planner_button_order', prefs.buttonOrder);
        }
        localStorage.setItem('neon_planner_last_modified', restoreData.lastModified ? restoreData.lastModified.toString() : Date.now().toString());
      }
    }

    triggerGDriveAutoSync();
    
    setTimeout(() => {
      alert('구글 연동 및 자동 복원/백업이 완료되었습니다. 변경사항 적용을 위해 새로고침합니다.');
      window.location.reload();
    }, 1500);

  } catch (e) {
    console.error('Auto restore/backup failed:', e);
    alert('구글 연동은 완료되었으나 자동 복원/백업 중 오류가 발생했습니다.');
    window.location.reload();
  }`;
  
const newSync = `      if (contentRes.ok) {
        const restoreData = await contentRes.json();
        const driveModified = parseInt(restoreData.lastModified || '0', 10);
        const localModified = parseInt(localStorage.getItem('neon_planner_last_modified') || '0', 10);
        let shouldRestore = true;
        
        if (localModified > driveModified && driveModified > 0) {
          shouldRestore = confirm("클라우드와 현재 기기의 데이터에 차이가 있습니다.\\n\\n[확인] 클라우드 데이터로 기기를 덮어씁니다 (현재 기기의 최근 변경사항 삭제)\\n[취소] 현재 기기의 데이터로 클라우드를 덮어씁니다 (백업 진행)");
        } else if (localModified > driveModified && driveModified === 0) {
          shouldRestore = false;
        }

        if (shouldRestore) {
          if (restoreData.todos) localStorage.setItem('neon_planner_todos', JSON.stringify(restoreData.todos));
          if (restoreData.diaries) localStorage.setItem('neon_planner_diaries', JSON.stringify(restoreData.diaries));
          if (restoreData.categories) localStorage.setItem('neon_planner_categories', JSON.stringify(restoreData.categories));
          if (restoreData.tabIcons) localStorage.setItem('neon_planner_tab_icons', JSON.stringify(restoreData.tabIcons));
          if (restoreData.appTitle) localStorage.setItem('neon_planner_app_title', restoreData.appTitle);
          if (restoreData.ddays) localStorage.setItem('neon_planner_ddays', JSON.stringify(restoreData.ddays));
          if (restoreData.routines) localStorage.setItem('neon_planner_routines', JSON.stringify(restoreData.routines));
          if (restoreData.routinesPopulatedDates) localStorage.setItem('neon_planner_populated_dates', JSON.stringify(restoreData.routinesPopulatedDates));
          if (restoreData.preferences) {
            const prefs = restoreData.preferences;
            if (prefs.theme) localStorage.setItem('neon_planner_theme', prefs.theme);
            if (prefs.fontSize) localStorage.setItem('neon_planner_font_size', prefs.fontSize);
            if (prefs.dateSize) localStorage.setItem('neon_planner_date_size', prefs.dateSize);
            if (prefs.bgHue) localStorage.setItem('neon_planner_bg_hue', prefs.bgHue);
            if (prefs.bgIntensity) localStorage.setItem('neon_planner_bg_intensity', prefs.bgIntensity);
            if (prefs.accentColor) localStorage.setItem('neon_planner_accent_color', prefs.accentColor);
            if (prefs.accentIntensity) localStorage.setItem('neon_planner_accent_intensity', prefs.accentIntensity);
            if (prefs.showCalendar) localStorage.setItem('neon_planner_show_calendar', prefs.showCalendar);
            if (prefs.showTodos) localStorage.setItem('neon_planner_show_todos', prefs.showTodos);
            if (prefs.showRecords) localStorage.setItem('neon_planner_show_records', prefs.showRecords);
            if (prefs.showAnalytics) localStorage.setItem('neon_planner_show_analytics', prefs.showAnalytics);
            if (prefs.showSearch) localStorage.setItem('neon_planner_show_search', prefs.showSearch);
            if (prefs.buttonOrder) localStorage.setItem('neon_planner_button_order', prefs.buttonOrder);
          }
          localStorage.setItem('neon_planner_last_modified', driveModified.toString());
        } else {
          const prevMod = parseInt(localStorage.getItem('neon_planner_last_modified') || '0', 10);
          localStorage.setItem('neon_planner_last_modified', Math.max(Date.now(), prevMod + 1).toString());
        }
      }
    }

    triggerGDriveAutoSync();
    
    setTimeout(() => {
      alert('구글 연동 및 동기화가 완료되었습니다. 변경사항 적용을 위해 새로고침합니다.');
      window.location.reload();
    }, 1500);

  } catch (e) {
    console.error('Auto restore/backup failed:', e);
    alert('구글 연동은 완료되었으나 자동 동기화 중 오류가 발생했습니다.');
    window.location.reload();
  }`;

content = content.replace(oldSync, newSync);

content = content.replace("device: 'pc', // 'pc' or 'phone'", "device: 'phone', // 'pc' or 'phone'");
content = content.replace("if (state.device === 'phone' || window.innerWidth <= 900) {", "if (state.device === 'phone') {");

const oldVid = `          // Full view mode: show actual video player
          const vid = document.createElement('video');
          vid.src = blobUrl;
          vid.controls = true;
          vid.style.width = '100%';
          vid.style.height = '100%';
          vid.style.objectFit = 'cover';
          container.appendChild(vid);`;
const newVid = `          // Full view mode: show actual video player
          const vid = document.createElement('video');
          vid.src = blobUrl;
          vid.controls = true;
          vid.style.width = '100%';
          vid.style.height = '100%';
          vid.style.objectFit = 'contain';
          vid.style.background = '#000';
          container.appendChild(vid);`;

content = content.replace(oldVid, newVid);

const customJs = `

// Fullscreen Memo Modal Logic
document.addEventListener('DOMContentLoaded', () => {
  const btnFullscreenMemo = document.getElementById('btn-fullscreen-memo');
  const fullscreenMemoModal = document.getElementById('fullscreen-memo-modal');
  const fullscreenMemoTextarea = document.getElementById('fullscreen-memo-textarea');
  const btnFullscreenMemoSave = document.getElementById('btn-fullscreen-memo-save');
  const btnFullscreenMemoCancel = document.getElementById('btn-fullscreen-memo-cancel');
  const fullscreenMemoBackdrop = document.getElementById('fullscreen-memo-backdrop');
  const todoEditModalMemo = document.getElementById('todo-edit-modal-memo');

  if (btnFullscreenMemo && fullscreenMemoModal && fullscreenMemoTextarea && todoEditModalMemo) {
    const closeFullscreenMemo = () => {
      fullscreenMemoModal.classList.add('hidden');
      fullscreenMemoModal.style.display = 'none';
      document.body.style.overflow = '';
    };

    btnFullscreenMemo.addEventListener('click', () => {
      fullscreenMemoTextarea.value = todoEditModalMemo.value;
      fullscreenMemoModal.classList.remove('hidden');
      fullscreenMemoModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      setTimeout(() => fullscreenMemoTextarea.focus(), 100);
    });

    btnFullscreenMemoSave.addEventListener('click', () => {
      todoEditModalMemo.value = fullscreenMemoTextarea.value;
      closeFullscreenMemo();
    });

    btnFullscreenMemoCancel.addEventListener('click', closeFullscreenMemo);
    if (fullscreenMemoBackdrop) fullscreenMemoBackdrop.addEventListener('click', closeFullscreenMemo);
  }
});

// Long press on header logo to toggle device mode
document.addEventListener('DOMContentLoaded', () => {
  const headerLogo = document.querySelector('.header-logo');
  if (headerLogo) {
    let pressTimer = null;
    let isPressing = false;

    const startPress = (e) => {
      if (e.type === 'mousedown' && e.button !== 0) return;
      isPressing = true;
      pressTimer = setTimeout(() => {
        if (isPressing) {
          state.device = state.device === 'pc' ? 'phone' : 'pc';
          localStorage.setItem('neon_planner_device', state.device);
          if (typeof applyPreferences === 'function') applyPreferences();
          
          if (navigator.vibrate) navigator.vibrate(50);
          
          const logoTextEl = headerLogo.querySelector('.logo-text');
          if (logoTextEl) {
            const originalText = localStorage.getItem('neon_planner_app_title') || '플래너';
            logoTextEl.textContent = state.device === 'pc' ? 'PC 모드 전환' : '핸드폰 모드 전환';
            setTimeout(() => {
               logoTextEl.textContent = localStorage.getItem('neon_planner_app_title') || '플래너';
            }, 1500);
          }
        }
      }, 700);
    };

    const cancelPress = () => {
      isPressing = false;
      if (pressTimer) clearTimeout(pressTimer);
    };

    headerLogo.addEventListener('mousedown', startPress);
    headerLogo.addEventListener('touchstart', startPress, {passive: true});
    headerLogo.addEventListener('mouseup', cancelPress);
    headerLogo.addEventListener('mouseleave', cancelPress);
    headerLogo.addEventListener('touchend', cancelPress);
    headerLogo.addEventListener('touchcancel', cancelPress);
    headerLogo.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelPress(); });
    
    headerLogo.style.cursor = 'pointer';
    headerLogo.style.userSelect = 'none';
    headerLogo.style.WebkitUserSelect = 'none';
  }
});
`;

content += customJs;

fs.writeFileSync(dstPath, content, 'utf8');
console.log('app.js restored and patched successfully via Node!');
