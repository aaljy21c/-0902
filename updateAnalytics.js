function updateAnalytics() {
  const panel = document.getElementById('analytics-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  // 1. Gather all tasks across all dates
  let totalCount = 0;
  let completedCount = 0;
  
  // To track completion by category
  const catTotals = {};
  const catCompletes = {};
  Object.keys(state.categories).forEach(catId => {
    catTotals[catId] = 0;
    catCompletes[catId] = 0;
  });

  // Track unique todo text
  const uniqueTodos = new Set();

  Object.keys(state.todos).forEach(dateKey => {
    state.todos[dateKey].forEach(todo => {
      totalCount++;
      if (todo.completed) completedCount++;

      // Category count
      const catId = todo.category;
      if (catTotals[catId] !== undefined) {
        catTotals[catId]++;
        if (todo.completed) {
          catCompletes[catId]++;
        }
      }

      // Collect unique todo text
      if (todo.text.trim()) {
        uniqueTodos.add(todo.text.trim());
      }
    });
  });

  // 2. Set overall stats
  const totalRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const statsTotalRate = document.getElementById('stats-total-rate');
  const statsTotalProgress = document.getElementById('stats-total-progress');
  const statsCompletedCount = document.getElementById('stats-completed-count');
  const statsPendingCount = document.getElementById('stats-pending-count');

  if (statsTotalRate) statsTotalRate.textContent = `${totalRate}%`;
  if (statsTotalProgress) statsTotalProgress.style.width = `${totalRate}%`;
  if (statsCompletedCount) statsCompletedCount.textContent = completedCount;
  if (statsPendingCount) statsPendingCount.textContent = totalCount - completedCount;

  // 3. Draw Category Bar Chart
  const categoryBarChart = document.getElementById('category-bar-chart');
  if (categoryBarChart) {
    categoryBarChart.innerHTML = '';
    
    Object.keys(state.categories).forEach(catId => {
      const cat = state.categories[catId];
      const tot = catTotals[catId] || 0;
      const comp = catCompletes[catId] || 0;
      const rate = tot > 0 ? Math.round((comp / tot) * 100) : 0;

      const row = document.createElement('div');
      row.classList.add('chart-bar-row');

      const label = document.createElement('div');
      label.classList.add('chart-bar-label');
      label.textContent = cat.label;
      row.appendChild(label);

      const barWrapper = document.createElement('div');
      barWrapper.classList.add('chart-bar-wrapper');

      const barFill = document.createElement('div');
      barFill.classList.add('chart-bar-fill');
      barFill.style.width = `${rate}%`;
      barFill.style.backgroundColor = cat.color;
      barFill.style.boxShadow = `0 0 8px ${hexToRgba(cat.color, 0.5)}`;
      barWrapper.appendChild(barFill);
      row.appendChild(barWrapper);

      const valLabel = document.createElement('div');
      valLabel.classList.add('chart-bar-value');
      valLabel.textContent = `${rate}% (${comp}/${tot}개)`;
      row.appendChild(valLabel);

      categoryBarChart.appendChild(row);
    });
  }

  // 3.5 Update Routine Stats
  const routineStatsContainer = document.getElementById('routine-stats-container');
  if (routineStatsContainer) {
    routineStatsContainer.innerHTML = '';
    
    // Group routines by text
    const routineCounts = {};
    state.routines.forEach(r => {
      routineCounts[r.text] = { total: 0, completed: 0, category: r.category };
    });
    
    // Count occurrences in todos
    Object.keys(state.todos).forEach(dk => {
      state.todos[dk].forEach(todo => {
        if (todo.isRoutine && routineCounts[todo.text]) {
          routineCounts[todo.text].total++;
          if (todo.completed) {
            routineCounts[todo.text].completed++;
          }
        }
      });
    });

    if (state.routines.length === 0) {
      routineStatsContainer.innerHTML = '<div style="color:var(--text-muted); font-size: 0.85rem; font-style: italic;">아직 등록된 루틴이 없습니다.</div>';
    } else {
      Object.keys(routineCounts).forEach(rText => {
        const stats = routineCounts[rText];
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.background = 'rgba(255,255,255,0.03)';
        row.style.padding = '10px 14px';
        row.style.borderRadius = '8px';
        row.style.border = '1px solid var(--panel-border)';
        
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '8px';
        
        const cat = getCategory(stats.category);
        const dot = document.createElement('span');
        dot.style.display = 'inline-block';
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = cat.color;
        
        const label = document.createElement('span');
        label.style.fontWeight = '600';
        label.style.fontSize = '0.9rem';
        label.textContent = rText;
        
        left.appendChild(dot);
        left.appendChild(label);
        
        const right = document.createElement('div');
        right.style.fontWeight = '700';
        right.style.color = 'var(--accent-color)';
        right.style.fontSize = '1rem';
        right.textContent = `총 ${stats.completed}회 완료`;
        
        row.appendChild(left);
        row.appendChild(right);
        routineStatsContainer.appendChild(row);
      });
    }
  }

  // 4. Update Todo Tracker Selector List
  const trackerSelect = document.getElementById('tracker-todo-select');
  if (trackerSelect) {
    const previousSelection = trackerSelect.value;
    trackerSelect.innerHTML = '';

    const sortedTodos = Array.from(uniqueTodos).sort();
    
    if (sortedTodos.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(등록된 할 일이 없습니다)';
      trackerSelect.appendChild(opt);
    } else {
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- 할 일을 선택하세요 --';
      trackerSelect.appendChild(defaultOpt);

      sortedTodos.forEach(text => {
        const opt = document.createElement('option');
        opt.value = text;
        opt.textContent = text;
        trackerSelect.appendChild(opt);
      });
    }

    if (uniqueTodos.has(previousSelection)) {
      trackerSelect.value = previousSelection;
    }
  }

  updateSelectedTodoTracker();
  applyDrilldownVisibility();
  applyCompletedPendingDrilldownVisibility();
}
