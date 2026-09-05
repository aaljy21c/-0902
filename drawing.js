class NeonDrawingBoard {
  constructor(container, options = {}) {
    this.container = container;
    this.onChange = options.onChange || null;
    this.onClose = options.onClose || null;
    this.readOnly = options.readOnly || false;

    // Load initial data

    // Multi-page State
    this.isMultiPage = false;
    this.pdfFileId = null;
    this._pages = [{ type: 'blank', _strokes: [], bgCanvas: null }];
    this.currentPageIndex = 0;
    this.isCalligraphyMode = false;
    this.layoutMode = localStorage.getItem('planeer_drawing_mode') || 'paged';
    this.pageHeight = 1130; // Virtual page height

    Object.defineProperty(this, 'strokes', {
      get: () => this._pages[this.currentPageIndex]._strokes,
      set: (val) => { this._pages[this.currentPageIndex]._strokes = val; }
    });

    // Load initial data
    if (options.initialData && !Array.isArray(options.initialData) && options.initialData.type === 'pdf_drawing') {
      this.isMultiPage = true;
      this.pdfFileId = options.initialData.pdfFileId;
      if (options.initialData.pages) {
        this._pages = options.initialData.pages.map(p => ({
          type: p.type || 'pdf',
          pdfPageNum: p.pdfPageNum,
          width: p.width,
          height: p.height,
          _strokes: p._strokes || [],
          bgCanvas: null
        }));
      } else {
        this._pages = options.initialData.strokesPerPage.map((st, i) => ({ type: 'pdf', pdfPageNum: i + 1, _strokes: st, bgCanvas: null }));
      }
      this.loadExistingPdf();
    } else {
      this.strokes = options.initialData ? JSON.parse(JSON.stringify(options.initialData)) : [];
    }

    const bgStroke = this.strokes.find(s => s.isBg);

    let globalBg = '#1e1e1e';
    if (window.state && window.state.settings && window.state.settings.drawingBgColor) {
      globalBg = window.state.settings.drawingBgColor;
    } else {
      globalBg = localStorage.getItem('planeer_drawing_bg') || '#1e1e1e';
    }
    this.bgColor = bgStroke ? bgStroke.color : globalBg;
    this.undoStack = [];
    this.redoStack = [];

    // Settings
    this.currentTool = 'pen'; // pen, highlighter, eraser, lasso
    this.penColor = '#ffffff';
    this.penSize = 2;
    this.penOpacity = 1.0;
    this.highlighterColor = '#facc15';
    this.highlighterSize = 15;
    this.highlighterOpacity = 0.4;

    this.penPresets = JSON.parse(localStorage.getItem('planeer_pen_presets')) || ['#ffffff', '#ff4d4d', '#4da6ff', '#50c878', '#facc15'];
    if (this.penPresets.length < 5) this.penPresets = [...this.penPresets, '#ffffff', '#ff4d4d', '#4da6ff', '#50c878', '#facc15'].slice(0, 5);
    this.hlPresets = JSON.parse(localStorage.getItem('planeer_hl_presets')) || ['#facc15', '#ff7b72', '#79c0ff', '#50c878', '#d8b4e2'];
    if (this.hlPresets.length < 5) this.hlPresets = [...this.hlPresets, '#facc15', '#ff7b72', '#79c0ff', '#50c878', '#d8b4e2'].slice(0, 5);

    // Interaction state
    this.isDrawing = false;
    this.currentStroke = null;
    this.points = [];
    this.holdTimer = null;
    this.isSnapped = false;
    this.penOnlyMode = true; // Pen mode by default

    // Pan and Zoom
    this.viewScale = 1;
    this.panX = 0;
    this.panY = 0;
    this.activePointers = new Map();
    this.isPanning = false;

    // Lasso state
    this.lassoPoints = [];
    this.selectedStrokes = [];
    this.isDraggingSelection = false;
    this.dragStartPoint = null;
    this.dragOffset = { x: 0, y: 0 };

    this.initDOM();
    if (!this.readOnly) {
      this.bindEvents();
    }

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.wrapper);

    // Initial render
    setTimeout(() => {
      this.resize();
      if (!this.readOnly) this.saveState(); // push initial state
    }, 0);
  }

  initDOM() {
    this.container.innerHTML = '';

    // Main wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'neon-drawing-wrapper';

    // Toolbar
    if (!this.readOnly) {

      // Sidebar
      this.sidebar = document.createElement('div');
      this.sidebar.className = 'drawing-sidebar hidden';
      this.sidebar.innerHTML = `
      <div class="sidebar-header">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="color:#fff; font-size:0.9rem; font-weight:bold;">페이지 미리보기</span>
          <button type="button" id="btn-close-sidebar" title="미리보기 닫기 (위쪽 📑 버튼으로 다시 열 수 있습니다)" style="background:none; border:none; color:#fff; font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <label class="sidebar-btn" style="display:block; text-align:center; cursor:pointer;">
          📄 PDF 불러오기
          <input type="file" id="pdf-import-input" accept="application/pdf" style="display:none">
        </label>
        <label class="sidebar-btn" style="display:block; width:100%; text-align:center; margin-top:6px; padding:8px; background:rgba(255,255,255,0.1); border:1px dashed #888; border-radius:8px; color:#fff; cursor:pointer; font-size:0.9rem;">
          🖼️ 사진 불러오기
          <input type="file" id="image-import-input" accept="image/*" style="display:none">
        </label>
        <button type="button" id="btn-add-blank-page" class="sidebar-btn" style="display:block; width:100%; text-align:center; margin-top:6px; padding:8px; background:rgba(255,255,255,0.1); border:1px dashed #888; border-radius:8px; color:#fff; cursor:pointer; font-size:0.9rem;">
          ➕ 빈 페이지 추가
        </button>
      </div>
      <div id="drawing-thumbnails" class="sidebar-thumbnails"></div>
    `;
      this.container.appendChild(this.sidebar);

      this.sidebar.querySelector('#btn-close-sidebar').addEventListener('click', () => {
        this.sidebar.classList.add('hidden');
      });

      this.sidebar.querySelector('#pdf-import-input').addEventListener('change', (e) => this.handlePdfImport(e));
      this.sidebar.querySelector('#image-import-input').addEventListener('change', (e) => this.handleImageImport(e));

      // Add blank page button
      const btnAddBlankPage = this.sidebar.querySelector('#btn-add-blank-page');
      if (btnAddBlankPage) {
        btnAddBlankPage.addEventListener('click', () => {
          this._pages.push({ type: 'blank', _strokes: [], bgCanvas: null });
          this.isMultiPage = true;
          this.currentPageIndex = this._pages.length - 1;
          this.updateSidebar();
          this.sidebar.classList.remove('hidden'); // keep sidebar open
          this.resetViewToPage();
          if (this.onChange) this.onChange(this.getData());
        });
      }

      // Floating Toolbar
      this.toolbar = document.createElement('div');

      this.toolbar.className = 'neon-drawing-toolbar';
      this.buildToolbar();
      this.wrapper.appendChild(this.toolbar);
    }

    // Canvas Container
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'neon-drawing-canvas-container';
    this.canvasContainer.style.backgroundColor = this.bgColor;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    // Prevent touch gestures like scrolling
    this.canvas.style.touchAction = 'none';

    this.canvasContainer.appendChild(this.canvas);

    this.zoomIndicator = document.createElement('div');
    this.zoomIndicator.style.cssText = 'position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.6); color:white; padding:4px 8px; border-radius:6px; font-size:0.8rem; pointer-events:none; z-index:100; transition: opacity 0.3s;';
    this.zoomIndicator.innerText = '100%';
    this.canvasContainer.appendChild(this.zoomIndicator);

    this.wrapper.appendChild(this.canvasContainer);
    this.container.appendChild(this.wrapper);

    // Add transparent overlay in readOnly mode to intercept and bubble click events reliably
    if (this.readOnly) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute; top:0; left:0; right:0; bottom:0; z-index:10; cursor:pointer;';
      this.canvasContainer.appendChild(overlay);
    }

    // Auto-expand if initial strokes go beyond default height
    let maxY = 0;
    this.strokes.forEach(stroke => {
      if (stroke.points) {
        stroke.points.forEach(p => {
          if (p.y > maxY) maxY = p.y;
        });
      }
    });
    if (maxY > 350) { // Default is 400, add padding
      this.canvasContainer.style.minHeight = `${maxY + 50}px`;
    }
  }

  buildToolbar() {
    this.toolbar.innerHTML = `
      <div class="drawing-tools">
        <button class="tool-btn active" data-tool="pen" title="펜">🖊️</button>
        <button class="tool-btn" data-tool="highlighter" title="형광펜">🖍️</button>
        <button class="tool-btn" data-tool="eraser" title="지우개">🧽</button>
        <button class="tool-btn" data-tool="lasso" title="올가미 선택">✂️</button>
        <div class="tool-divider"></div>
        <button type="button" id="btn-layout-mode" class="drawing-tool-btn" title="모드 전환 (현재: 페이지)" style="font-size: 1.1rem;">📄</button>
        <button type="button" id="btn-drawing-close" class="drawing-tool-btn" title="닫기">❌</button>
      </div>
      <div class="drawing-settings">
        <!-- Settings dynamically change based on tool -->
      </div>
      <div class="global-settings" style="display:flex; align-items:center; gap:4px; margin-left:auto; border-left: 1px solid #444; padding-left: 8px;">
        <span style="font-size:0.8rem; color:#aaa; margin-right:4px;">배경지</span>
        <div class="bg-presets" style="display:flex; gap:4px;">
          <input type="color" id="bg-color-picker" class="color-picker" value="${this.bgColor}" title="배경색 변경" style="width:24px; height:24px; padding:0; border:2px solid #555; border-radius:50%; cursor:pointer;">
        </div>
      </div>
      <div class="drawing-actions">
        <button class="action-btn" id="btn-save-image" title="이미지로 저장">💾</button>
        <button class="action-btn" id="btn-toggle-sidebar" title="페이지 미리보기(사이드바) 켜기/끄기">📑</button>
        <button class="action-btn" id="btn-export-pdf" title="PDF로 다운로드" style="display:none">📥</button>
        <button class="action-btn" id="btn-zoom-out" title="축소">➖</button>
        <button class="action-btn" id="btn-reset-view" title="1:1 화면 초기화">🔍</button>
        <button class="action-btn" id="btn-zoom-in" title="확대">➕</button>
        <button class="action-btn active" id="btn-pen-mode" title="펜 전용 모드 켜짐 (클릭하여 손가락 그리기 허용)">🖊️</button>
        <button class="action-btn" id="btn-undo" title="실행 취소">↩️</button>
        <button class="action-btn" id="btn-redo" title="다시 실행">↪️</button>
        <button class="action-btn" id="btn-clear" title="전체 지우기">🗑️</button>
        ${this.onClose ? `<button class="drawing-toolbar-close-btn" id="btn-close-drawing" title="저장 후 닫기">✅ 저장/닫기</button>` : ''}
      </div>
    `;

    // Tool switching
    const toolBtns = this.toolbar.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
        this.clearSelection();
        this.updateSettingsUI();
      });
    });

    // Action buttons
    this.toolbar.querySelector('#btn-undo').addEventListener('click', (e) => { e.preventDefault(); this.undo(); });
    this.toolbar.querySelector('#btn-redo').addEventListener('click', (e) => { e.preventDefault(); this.redo(); });
    
    const calliBtn = this.toolbar.querySelector('#btn-toggle-calligraphy');
    if (calliBtn) {
      calliBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.isCalligraphyMode = !this.isCalligraphyMode;
        if (this.isCalligraphyMode) calliBtn.classList.add('active');
        else calliBtn.classList.remove('active');
      });
    }
    this.toolbar.querySelector('#btn-clear').addEventListener('click', () => {
      if (confirm('그림을 모두 지우시겠습니까?')) this.clearAll();
    });

    const btnPenMode = this.toolbar.querySelector('#btn-pen-mode');
    if (btnPenMode) {
      btnPenMode.addEventListener('click', () => {
        this.penOnlyMode = !this.penOnlyMode;
        if (this.penOnlyMode) {
          btnPenMode.innerHTML = '🖊️';
          btnPenMode.title = '펜 전용 모드 켜짐 (클릭하여 손가락 그리기 허용)';
          btnPenMode.classList.add('active');
        } else {
          btnPenMode.innerHTML = '👆';
          btnPenMode.title = '손가락 그리기 허용됨 (클릭하여 펜 전용 모드로 전환)';
          btnPenMode.classList.remove('active');
        }
      });
    }

    const btnClose = this.toolbar.querySelector('#btn-close-drawing');
    if (btnClose && this.onClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isDrawing) {
          this.endDrawing(e);
        }
        this.onClose(this.getData());
      });
    }

    // Layout mode toggle: paged <-> infinite scroll
    const btnLayoutMode = this.toolbar.querySelector('#btn-layout-mode');
    if (btnLayoutMode) {
      btnLayoutMode.addEventListener('click', (e) => {
        e.preventDefault();
        this.layoutMode = this.layoutMode === 'paged' ? 'infinite' : 'paged';
        localStorage.setItem('planeer_drawing_mode', this.layoutMode);
        btnLayoutMode.innerHTML = this.layoutMode === 'paged' ? '📄' : '📜';
        btnLayoutMode.title = this.layoutMode === 'paged' ? '페이지 모드 (클릭하면 무한 스크롤)' : '무한 스크롤 모드 (클릭하면 페이지 모드)';
        this.render();
      });
      // Init icon
      btnLayoutMode.innerHTML = this.layoutMode === 'paged' ? '📄' : '📜';
      btnLayoutMode.title = this.layoutMode === 'paged' ? '페이지 모드 (클릭하면 무한 스크롤)' : '무한 스크롤 모드 (클릭하면 페이지 모드)';
    }

    // X close button (no save)
    const btnDrawingClose = this.toolbar.querySelector('#btn-drawing-close');
    if (btnDrawingClose) {
      btnDrawingClose.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isDrawing) {
          this.endDrawing(e);
        }
        if (this.onClose) this.onClose(this.getData());
      });
    }

    const bgColorPicker = this.toolbar.querySelector('#bg-color-picker');
    if (bgColorPicker) {
      bgColorPicker.addEventListener('input', (e) => {
        this.bgColor = e.target.value;
        localStorage.setItem('planeer_drawing_bg', this.bgColor);
        if (window.state) {
          if (!window.state.settings) window.state.settings = {};
          window.state.settings.drawingBgColor = this.bgColor;
          if (typeof window.saveData === 'function') window.saveData();
        }
        this.canvasContainer.style.backgroundColor = this.bgColor;
        this.strokes = this.strokes.filter(s => !s.isBg);
        this.strokes.unshift({ isBg: true, color: this.bgColor });
        this.saveState();
      });
    }



    const btnExportPdf = this.toolbar.querySelector('#btn-export-pdf');
    if (btnExportPdf) {
      if (this.isMultiPage || this.layoutMode === 'paged') {
        btnExportPdf.style.display = 'inline-block';
      }
      btnExportPdf.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const originalText = btnExportPdf.innerHTML;
          btnExportPdf.innerHTML = '⏳';

          const { PDFDocument } = window.PDFLib;
          const pdfDoc = await PDFDocument.create();


          const pageWidth = this.canvas.width / window.devicePixelRatio;
          const pageHeight = this.pageHeight || 1130;
          const pageGap = 20;

          if (this.isMultiPage) {
            for (let i = 0; i < this._pages.length; i++) {
              const pageObj = this._pages[i];

              const tempCanvas = document.createElement('canvas');
              const targetWidth = pageObj.width || this.canvas.width;
              const targetHeight = pageObj.height || this.canvas.height;
              tempCanvas.width = targetWidth;
              tempCanvas.height = targetHeight;
              const tempCtx = tempCanvas.getContext('2d');

              if (pageObj.bgCanvas) {
                tempCtx.drawImage(pageObj.bgCanvas, 0, 0, targetWidth, targetHeight);
              } else {
                tempCtx.fillStyle = this.bgColor;
                tempCtx.fillRect(0, 0, targetWidth, targetHeight);
              }

              pageObj._strokes.forEach(stroke => {
                tempCtx.beginPath();
                tempCtx.lineCap = 'round'; tempCtx.lineJoin = 'round';
                tempCtx.lineWidth = stroke.size; tempCtx.strokeStyle = stroke.color; tempCtx.globalAlpha = stroke.opacity || 1;

                if (stroke.tool === 'highlighter') {
                  tempCtx.globalCompositeOperation = 'multiply';
                }

                stroke.points.forEach((pt, j) => {
                  if (j === 0) tempCtx.moveTo(pt.x, pt.y); else tempCtx.lineTo(pt.x, pt.y);
                });
                tempCtx.stroke();
                tempCtx.globalCompositeOperation = 'source-over';
              });

              const pngDataUrl = tempCanvas.toDataURL('image/png');
              const pngImage = await pdfDoc.embedPng(pngDataUrl);
              const pdfPage = pdfDoc.addPage([targetWidth, targetHeight]);
              pdfPage.drawImage(pngImage, { x: 0, y: 0, width: targetWidth, height: targetHeight });
            }
          } else if (this.layoutMode === 'paged') {
            let maxY = 0;
            this.strokes.forEach(stroke => {
              stroke.points.forEach(p => { if (p.y > maxY) maxY = p.y; });
            });
            const numPages = Math.max(1, Math.ceil(maxY / (pageHeight + pageGap)));

            for (let i = 0; i < numPages; i++) {
              const yOffset = i * (pageHeight + pageGap);
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = pageWidth;
              tempCanvas.height = pageHeight;
              const tempCtx = tempCanvas.getContext('2d');

              tempCtx.fillStyle = this.bgColor;
              tempCtx.fillRect(0, 0, pageWidth, pageHeight);

              this.strokes.forEach(stroke => {
                if (stroke.isBg) return;
                // Filter strokes that intersect this page bounding box
                let inBounds = false;
                stroke.points.forEach(p => {
                  if (p.y >= yOffset && p.y <= yOffset + pageHeight) inBounds = true;
                });
                if (!inBounds) return;

                tempCtx.beginPath();
                tempCtx.lineCap = 'round'; tempCtx.lineJoin = 'round';
                tempCtx.lineWidth = stroke.size; tempCtx.strokeStyle = stroke.color; tempCtx.globalAlpha = stroke.opacity || 1;
                if (stroke.tool === 'highlighter') tempCtx.globalCompositeOperation = 'multiply';

                stroke.points.forEach((pt, j) => {
                  const adjY = pt.y - yOffset; // Offset local to page
                  if (j === 0) tempCtx.moveTo(pt.x, adjY); else tempCtx.lineTo(pt.x, adjY);
                });
                tempCtx.stroke();
                tempCtx.globalCompositeOperation = 'source-over';
              });

              const pngDataUrl = tempCanvas.toDataURL('image/png');
              const pngImage = await pdfDoc.embedPng(pngDataUrl);
              const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
              pdfPage.drawImage(pngImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
            }
          }

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'edited_planeer_notes.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          btnExportPdf.innerHTML = originalText;
        } catch (err) {
          console.error('PDF Export Error:', err);
          alert('PDF 다운로드 중 오류가 발생했습니다.');
          btnExportPdf.innerHTML = '📥';
        }
      });
    }

    const btnToggleSidebar = this.toolbar.querySelector('#btn-toggle-sidebar');
    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        this.sidebar.classList.toggle('hidden');
      });
    }

    const btnZoomIn = this.toolbar.querySelector('#btn-zoom-in');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', (e) => {
        e.preventDefault();
        this.doZoom(1.2);
      });
    }

    const btnZoomOut = this.toolbar.querySelector('#btn-zoom-out');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', (e) => {
        e.preventDefault();
        this.doZoom(1 / 1.2);
      });
    }

    const btnResetView = this.toolbar.querySelector('#btn-reset-view');

    if (btnResetView) {
      btnResetView.addEventListener('click', (e) => {
        e.preventDefault();
        this.viewScale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateZoomIndicator();
        this.render();
      });
    }

    const btnSaveImage = this.toolbar.querySelector('#btn-save-image');
    if (btnSaveImage) {
      btnSaveImage.addEventListener('click', (e) => {
        e.preventDefault();

        let minX = 0, minY = 0, maxX = this.canvas.width, maxY = this.canvas.height;
        let hasStrokes = false;

        this.getCurrentStrokes().forEach(s => {
          if (s.isBg) return;
          if (!s.points || s.points.length === 0) return;
          s.points.forEach(p => {
            if (!hasStrokes) { minX = maxX = p.x; minY = maxY = p.y; hasStrokes = true; }
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
        });

        minX -= 50; minY -= 50; maxX += 50; maxY += 50;
        if (maxX - minX < this.canvas.width) { minX = 0; maxX = this.canvas.width; }
        if (maxY - minY < this.canvas.height) { minY = 0; maxY = Math.max(this.canvas.height, maxY); }

        const targetWidth = maxX - minX;
        const targetHeight = maxY - minY;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.fillStyle = this.bgColor;
        tempCtx.fillRect(0, 0, targetWidth, targetHeight);

        this.strokes.forEach(stroke => {
          if (stroke.isBg) return;
          tempCtx.beginPath();
          tempCtx.lineCap = 'round'; tempCtx.lineJoin = 'round';
          tempCtx.lineWidth = stroke.size; tempCtx.strokeStyle = stroke.color; tempCtx.globalAlpha = stroke.opacity || 1;

          if (stroke.tool === 'highlighter') {
            tempCtx.globalCompositeOperation = 'multiply';
          }

          stroke.points.forEach((pt, j) => {
            const adjX = pt.x - minX;
            const adjY = pt.y - minY;
            if (j === 0) tempCtx.moveTo(adjX, adjY); else tempCtx.lineTo(adjX, adjY);
          });
          tempCtx.stroke();
          tempCtx.globalCompositeOperation = 'source-over';
        });

        const dataUrl = tempCanvas.toDataURL('image/png');
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        const filename = `planeer_drawing_${dateStr}.png`;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;';

          const title = document.createElement('div');
          title.innerHTML = '이미지를 길게 눌러서 <strong>[사진 앱에 저장]</strong>을 선택하세요.';
          title.style.cssText = 'color:white; margin-bottom:20px; text-align:center; font-size:1rem; line-height:1.5; background:rgba(255,255,255,0.1); padding:12px; border-radius:8px;';

          const img = document.createElement('img');
          img.src = dataUrl;
          img.style.cssText = 'max-width:100%; max-height:70vh; object-fit:contain; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.5);';

          const closeBtn = document.createElement('button');
          closeBtn.innerText = '닫기';
          closeBtn.style.cssText = 'margin-top:20px; padding:12px 32px; font-size:1.1rem; border-radius:24px; background:#ef4444; color:white; border:none; font-weight:bold; cursor:pointer;';
          closeBtn.onclick = () => document.body.removeChild(overlay);

          overlay.appendChild(title);
          overlay.appendChild(img);
          overlay.appendChild(closeBtn);
          document.body.appendChild(overlay);
        } else {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
    }

    this.settingsContainer = this.toolbar.querySelector('.drawing-settings');
    this.updateSettingsUI();
  }

  onWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? (1 / 1.1) : 1.1;
      this.doZoom(zoomFactor, e);
    }
  }

  doZoom(factor, e = null) {
    let newScale = this.viewScale * factor;
    newScale = Math.max(0.2, Math.min(newScale, 5.0));

    let zoomCenterX, zoomCenterY;
    const rect = this.canvas.getBoundingClientRect();
    if (e) {
      zoomCenterX = e.clientX - rect.left;
      zoomCenterY = e.clientY - rect.top;
    } else {
      zoomCenterX = rect.width / 2;
      zoomCenterY = rect.height / 2;
    }

    const mouseBeforeX = (zoomCenterX - this.panX) / this.viewScale;
    const mouseBeforeY = (zoomCenterY - this.panY) / this.viewScale;

    this.viewScale = newScale;

    this.panX = zoomCenterX - mouseBeforeX * this.viewScale;
    this.panY = zoomCenterY - mouseBeforeY * this.viewScale;

    this.updateZoomIndicator();
    this.render();
  }

  updateZoomIndicator() {
    if (this.zoomIndicator) {
      this.zoomIndicator.innerText = Math.round(this.viewScale * 100) + '%';
      this.zoomIndicator.style.opacity = '1';
      clearTimeout(this.zoomTimer);
      this.zoomTimer = setTimeout(() => {
        this.zoomIndicator.style.opacity = '0.4';
      }, 1500);
    }
  }

  updateSettingsUI() {
    this.settingsContainer.innerHTML = '';

    const renderPresets = (presets) => {
      return presets.map((color, idx) => {
        const isActive = (this.currentTool === 'pen' && this.penColor === color) || (this.currentTool === 'highlighter' && this.highlighterColor === color);
        const borderStyle = isActive ? '2px solid #fff' : '2px solid transparent';
        const boxShadow = isActive ? '0 0 0 2px #3b82f6' : '0 0 0 1px #555';
        return `<button class="preset-color" style="background:${color}; width:26px; height:26px; border-radius:50%; border:${borderStyle}; box-shadow:${boxShadow}; cursor:pointer; padding:0;" data-index="${idx}" data-color="${color}" title="클릭하여 선택 (다시 클릭 시 색상 변경)"></button>`;
      }).join('');
    };

    if (this.currentTool === 'pen') {
      this.settingsContainer.innerHTML = `
        <div class="setting-group" style="display:flex; align-items:center; gap:6px;">
          ${renderPresets(this.penPresets)}
          <input type="color" class="color-picker" id="hidden-preset-picker" style="opacity:0; position:absolute; width:0; height:0; pointer-events:none;">
          <input type="color" class="color-picker" value="${this.penColor}" id="pen-color" style="margin-left:4px;" title="색상 지정">
          <input type="range" class="size-slider" min="1" max="20" value="${this.penSize}" id="pen-size" title="굵기">
          <input type="range" class="opacity-slider" min="0.1" max="1" step="0.1" value="${this.penOpacity}" id="pen-opacity" title="농도">
        </div>
      `;
    } else if (this.currentTool === 'highlighter') {
      this.settingsContainer.innerHTML = `
        <div class="setting-group" style="display:flex; align-items:center; gap:6px;">
          ${renderPresets(this.hlPresets)}
          <input type="color" class="color-picker" id="hidden-preset-picker" style="opacity:0; position:absolute; width:0; height:0; pointer-events:none;">
          <input type="color" class="color-picker" value="${this.highlighterColor}" id="hl-color" style="margin-left:4px;" title="색상 지정">
          <input type="range" class="size-slider" min="5" max="50" value="${this.highlighterSize}" id="hl-size" title="굵기">
          <input type="range" class="opacity-slider" min="0.1" max="1" step="0.1" value="${this.highlighterOpacity}" id="hl-opacity" title="농도">
        </div>
      `;
    }

    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      const isPen = this.currentTool === 'pen';
      const colorInputId = isPen ? '#pen-color' : '#hl-color';
      const sizeInputId = isPen ? '#pen-size' : '#hl-size';
      const opacityInputId = isPen ? '#pen-opacity' : '#hl-opacity';

      const hiddenPicker = this.settingsContainer.querySelector('#hidden-preset-picker');
      let targetPresetIndex = -1;

      hiddenPicker.addEventListener('input', e => {
        if (targetPresetIndex >= 0) {
          const newColor = e.target.value;
          const presets = isPen ? this.penPresets : this.hlPresets;
          presets[targetPresetIndex] = newColor;
          localStorage.setItem(isPen ? 'planeer_pen_presets' : 'planeer_hl_presets', JSON.stringify(presets));
          this.updateSettingsUI();
          if (isPen) this.penColor = newColor;
          else this.highlighterColor = newColor;
          this.settingsContainer.querySelector(colorInputId).value = newColor;
        }
      });

      this.settingsContainer.querySelectorAll('.preset-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const color = btn.dataset.color;
          const isActive = (isPen ? this.penColor : this.highlighterColor) === color;

          if (isActive) {
            targetPresetIndex = parseInt(btn.dataset.index);
            hiddenPicker.value = color;
            hiddenPicker.click();
          } else {
            if (isPen) this.penColor = color;
            else this.highlighterColor = color;
            this.settingsContainer.querySelector(colorInputId).value = color;
            this.updateSettingsUI(); // Re-render to update active borders
          }
        });
      });

      this.settingsContainer.querySelector(colorInputId).addEventListener('input', e => {
        if (isPen) this.penColor = e.target.value;
        else this.highlighterColor = e.target.value;
      });
      this.settingsContainer.querySelector(sizeInputId).addEventListener('input', e => {
        if (isPen) this.penSize = parseInt(e.target.value);
        else this.highlighterSize = parseInt(e.target.value);
      });
      this.settingsContainer.querySelector(opacityInputId).addEventListener('input', e => {
        if (isPen) this.penOpacity = parseFloat(e.target.value);
        else this.highlighterOpacity = parseFloat(e.target.value);
      });
    }
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('pointerout', this.onPointerUp.bind(this));

    // Mouse wheel zoom
    this.wrapper.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
  }

  getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) - this.panX) / this.viewScale,
      y: ((e.clientY - rect.top) - this.panY) / this.viewScale,
      t: Date.now()
    };
  }

  onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.isTempEraser = false;
    if (e.pointerType === 'pen' && (e.button === 2 || e.button === 5 || (e.buttons & 2) || (e.buttons & 32))) {
      this.isTempEraser = true;
    }

    if (this.penOnlyMode && e.pointerType === 'touch') {
      this.activePointers.set(e.pointerId, e);
      if (this.activePointers.size < 2) return;
    } else {
      this.activePointers.set(e.pointerId, e);
    }

    if (this.activePointers.size >= 2) {
      this.isDrawing = false;
      this.isPanning = true;
      const pts = Array.from(this.activePointers.values());
      this.initialPinchDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      this.initialScale = this.viewScale;
      const midX = (pts[0].clientX + pts[1].clientX) / 2;
      const midY = (pts[0].clientY + pts[1].clientY) / 2;
      const rect = this.canvas.getBoundingClientRect();
      this.pinchPanStartX = (midX - rect.left) - this.panX;
      this.pinchPanStartY = (midY - rect.top) - this.panY;
      return;
    }

    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Pointer capture failed:', err);
    }

    const pos = this.getPointerPos(e);
    const activeTool = this.isTempEraser ? 'eraser' : this.currentTool;

    if (activeTool === 'lasso' && this.selectedStrokes.length > 0) {
      if (this.isPointInSelectionBounds(pos)) {
        this.isDraggingSelection = true;
        this.dragStartPoint = pos;
        this.originalSelectionStrokes = JSON.parse(JSON.stringify(this.selectedStrokes));
        return;
      } else {
        this.clearSelection();
      }
    }

    this.isDrawing = true;
    this.isSnapped = false;
    this.points = [pos];

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      this.currentStroke = {
        tool: activeTool,
        color: activeTool === 'pen' ? this.penColor : this.highlighterColor,
        size: activeTool === 'pen' ? this.penSize : this.highlighterSize,
        opacity: activeTool === 'pen' ? this.penOpacity : this.highlighterOpacity,
        points: [...this.points],
        isShape: false
      };
      this.startHoldTimer();
    } else if (activeTool === 'lasso') {
      this.lassoPoints = [pos];
    } else if (activeTool === 'eraser') {
      this.eraseAt(pos);
    }

    this.render();
  }

  onPointerMove(e) {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, e);
    }

    if (this.isPanning && this.activePointers.size >= 2) {
      const pts = Array.from(this.activePointers.values());
      const currentDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      const midX = (pts[0].clientX + pts[1].clientX) / 2;
      const midY = (pts[0].clientY + pts[1].clientY) / 2;
      const rect = this.canvas.getBoundingClientRect();

      let newScale = this.initialScale * (currentDist / (this.initialPinchDist || 1));
      newScale = Math.max(0.2, Math.min(newScale, 5.0));

      this.viewScale = newScale;
      this.panX = (midX - rect.left) - this.pinchPanStartX * (newScale / this.initialScale);
      this.panY = (midY - rect.top) - this.pinchPanStartY * (newScale / this.initialScale);

      this.updateZoomIndicator();
      this.render();
      return;
    }

    let pos = this.getPointerPos(e);

    // Auto-expand canvas height and pan if near the vertical edges while drawing or dragging
    if (this.isDrawing || this.isDraggingSelection) {
      const containerHeight = this.canvasContainer.clientHeight;
      let physicalY = pos.y * this.viewScale + this.panY;
      let panned = false;

      if (physicalY > containerHeight - 80) {
        this.panY -= 15 / this.viewScale;
        panned = true;
      } else if (physicalY < 80 && this.panY < 0) {
        this.panY += 15 / this.viewScale;
        if (this.panY > 0) this.panY = 0;
        panned = true;
      }

      if (panned) {
        pos = this.getPointerPos(e); // Recalculate logical pos after pan
        physicalY = pos.y * this.viewScale + this.panY;
        this.canvasContainer.style.minHeight = `${Math.max(this.canvasContainer.clientHeight, (physicalY + 300))}px`;
      }
    }

    if (this.isDraggingSelection) {
      const dx = pos.x - this.dragStartPoint.x;
      const dy = pos.y - this.dragStartPoint.y;

      this.selectedStrokes.forEach((s, idx) => {
        const orig = this.originalSelectionStrokes[idx];
        s.points = orig.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      });
      this.render();
      return;
    }

    if (!this.isDrawing) return;

    const activeTool = this.isTempEraser ? 'eraser' : this.currentTool;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      if (this.isSnapped && this.currentStroke) {
        this.currentStroke.points[this.currentStroke.points.length - 1] = pos;
      } else {
        const lastPt = this.points[this.points.length - 1];
        if (Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y) > 3) {
          this.resetHoldTimer();
        }
        this.points.push(pos);
        this.currentStroke.points.push(pos);
      }
    } else if (activeTool === 'lasso') {
      this.lassoPoints.push(pos);
    } else if (activeTool === 'eraser') {
      this.eraseAt(pos);
    }

    this.render();
  }

  onPointerUp(e) {
    this.activePointers.delete(e.pointerId);
    if (this.isPanning && this.activePointers.size < 2) {
      this.isPanning = false;
      return;
    }

    this.clearHoldTimer();

    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
      this.saveState();
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;

    const activeTool = this.isTempEraser ? 'eraser' : this.currentTool;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      if (this.currentStroke && this.currentStroke.points.length > 0) {
        this.getCurrentStrokes().push(this.currentStroke);
        this.saveState();
      }
      this.currentStroke = null;
    } else if (activeTool === 'lasso') {
      if (this.lassoPoints.length < 3) {
        // It was a tap! Check if we tapped on an image
        this.checkLassoTap(pos);
      } else {
        this.applyLassoSelection();
      }
      this.lassoPoints = [];
    }

    this.points = [];
    this.isTempEraser = false;
    this.render();
  }

  checkLassoTap(pt) {
    const strokes = this.getCurrentStrokes();
    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i];
      if (stroke.tool === 'image') {
        const minX = Math.min(...stroke.points.map(p => p.x));
        const maxX = Math.max(...stroke.points.map(p => p.x));
        const minY = Math.min(...stroke.points.map(p => p.y));
        const maxY = Math.max(...stroke.points.map(p => p.y));
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
          strokes.splice(i, 1);
          this.activeImage = {
            imgData: stroke.imgData,
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
            w: maxX - minX,
            h: maxY - minY
          };
          this.buildImageOverlay();
          this.render();
          return;
        }
      }
    }
  }

  simplifyPoints(points, epsilon) {
    if (points.length < 3) return points;
    const findPerpendicularDistance = (p, p1, p2) => {
      let area = Math.abs(0.5 * (p1.x * p2.y + p2.x * p.y + p.x * p1.y - p2.x * p1.y - p.x * p2.y - p1.x * p.y));
      let bottom = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      return bottom === 0 ? Math.hypot(p.x - p1.x, p.y - p1.y) : area / bottom * 2.0;
    };
    
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;
    for (let i = 1; i < end; i++) {
      let d = findPerpendicularDistance(points[i], points[0], points[end]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }
    
    if (dmax > epsilon) {
      let recResults1 = this.simplifyPoints(points.slice(0, index + 1), epsilon);
      let recResults2 = this.simplifyPoints(points.slice(index), epsilon);
      return recResults1.slice(0, -1).concat(recResults2);
    } else {
      return [points[0], points[end]];
    }
  }

  detectShape(points) {
    if (points.length < 5) return { type: 'line', points: [points[0], points[points.length-1]] };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });

    const start = points[0];
    const end = points[points.length - 1];
    const distStartEnd = Math.hypot(start.x - end.x, start.y - end.y);
    const diag = Math.hypot(maxX - minX, maxY - minY);
    const w = maxX - minX;
    const h = maxY - minY;
    const cx = minX + w/2;
    const cy = minY + h/2;

    if (distStartEnd > diag * 0.3) {
      return { type: 'line', points: [start, end] };
    }

    // 1. Check for Heart
    let lowestP = points[0];
    let highestLeft = points[0];
    let highestRight = points[0];
    let topMid = { x: cx, y: maxY };
    
    points.forEach(p => {
      if (p.y > lowestP.y) lowestP = p;
      if (p.x < cx && p.y < highestLeft.y) highestLeft = p;
      if (p.x > cx && p.y < highestRight.y) highestRight = p;
      if (Math.abs(p.x - cx) < w * 0.2 && p.y < cy) {
        if (p.y > highestLeft.y && p.y > highestRight.y) {
           if (p.y < topMid.y) topMid = p;
        }
      }
    });

    const isDip = topMid.y > highestLeft.y + h*0.05 && topMid.y > highestRight.y + h*0.05;
    const isPointyBottom = Math.abs(lowestP.x - cx) < w * 0.25 && lowestP.y > cy + h*0.2;
    if (isDip && isPointyBottom) {
      return { type: 'heart', rect: { x: minX, y: minY, w, h } };
    }

    // 2. Polygonal detection via Douglas-Peucker simplification
    let epsilon = diag * 0.06;
    let simplified = this.simplifyPoints(points, epsilon);
    
    let uniqueVerts = [simplified[0]];
    for (let i = 1; i < simplified.length; i++) {
       const dist = Math.hypot(simplified[i].x - uniqueVerts[uniqueVerts.length-1].x, simplified[i].y - uniqueVerts[uniqueVerts.length-1].y);
       if (dist > diag * 0.08) uniqueVerts.push(simplified[i]);
    }
    if (uniqueVerts.length > 2) {
      const endDist = Math.hypot(uniqueVerts[0].x - uniqueVerts[uniqueVerts.length-1].x, uniqueVerts[0].y - uniqueVerts[uniqueVerts.length-1].y);
      if (endDist < diag * 0.15) uniqueVerts.pop();
    }
    
    const vertices = uniqueVerts.length;

    // Check Convexity
    let isConvex = true;
    let sign = 0;
    for (let i = 0; i < vertices; i++) {
       const p1 = uniqueVerts[i];
       const p2 = uniqueVerts[(i+1)%vertices];
       const p3 = uniqueVerts[(i+2)%vertices];
       const cross = (p2.x - p1.x)*(p3.y - p2.y) - (p2.y - p1.y)*(p3.x - p2.x);
       if (Math.abs(cross) > diag * diag * 0.01) { // ignore small colinearity
          if (sign === 0) sign = cross > 0 ? 1 : -1;
          else if ((cross > 0 ? 1 : -1) !== sign) {
             isConvex = false;
             break;
          }
       }
    }

    if (vertices === 3) {
      return { type: 'triangle', points: [uniqueVerts[0], uniqueVerts[1], uniqueVerts[2]] };
    } else if (vertices === 4) {
      return { type: 'rectangle', rect: { x: minX, y: minY, w, h } };
    } else if (vertices === 5) {
      if (isConvex) return { type: 'polygon', points: uniqueVerts };
      else return { type: 'star', rect: { x: minX, y: minY, w, h } };
    } else if (vertices === 6) {
      return { type: 'polygon', points: uniqueVerts };
    } else if (vertices >= 9 && vertices <= 11 && !isConvex) {
      return { type: 'star', rect: { x: minX, y: minY, w, h } };
    } else {
      // Circle or Ellipse
      if (Math.abs(w - h) < Math.max(w, h) * 0.2) {
        return { type: 'circle', center: { x: cx, y: cy }, radius: (w + h) / 4 };
      }
      return { type: 'ellipse', center: { x: cx, y: cy }, rx: w/2, ry: h/2 };
    }
  }

  startHoldTimer() {
    this.clearHoldTimer();
    this.holdTimer = setTimeout(() => {
      if (this.isDrawing && this.points.length > 5) {
        this.isSnapped = true;
        const shape = this.detectShape(this.points);
        
        this.currentStroke.isShape = true;
        this.currentStroke.shapeType = shape.type;
        
        if (shape.type === 'line' || shape.type === 'triangle' || shape.type === 'polygon') {
          this.currentStroke.points = shape.points;
        } else if (['rectangle', 'star', 'heart'].includes(shape.type)) {
          this.currentStroke.rect = shape.rect;
        } else if (shape.type === 'circle') {
          this.currentStroke.center = shape.center;
          this.currentStroke.radius = shape.radius;
        } else if (shape.type === 'ellipse') {
          this.currentStroke.center = shape.center;
          this.currentStroke.rx = shape.rx;
          this.currentStroke.ry = shape.ry;
        }
        
        this.render();
      }
    }, 800); // slightly faster snap feel
  }

  resetHoldTimer() {
    this.startHoldTimer();
  }

  clearHoldTimer() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  eraseAt(pos) {
    const eraseRadius = 15;
    let erased = false;
    let currentStrokes = this.getCurrentStrokes();
    for (let i = currentStrokes.length - 1; i >= 0; i--) {
      const stroke = currentStrokes[i];
      if (stroke.isBg || !stroke.points) continue;
      if (stroke.tool === 'image') continue;
      if (this.isPointNearStroke(pos, stroke, eraseRadius)) {
        currentStrokes.splice(i, 1);
        erased = true;
        break; // Erase one at a time
      }
    }
    if (erased) {
      this.saveState();
      this.render();
    }
  }

  isPointNearStroke(pt, stroke, radius) {
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      if (this.distToSegmentSquared(pt, p1, p2) < radius * radius) {
        return true;
      }
    }
    return false;
  }

  distToSegmentSquared(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
  }

  applyLassoSelection() {
    this.selectedStrokes = [];
    if (this.lassoPoints.length < 3) return;

    this.getCurrentStrokes().forEach(stroke => {
      if (stroke.isBg || !stroke.points) return;
      let insideCount = 0;
      stroke.points.forEach(p => {
        if (this.isPointInPolygon(p, this.lassoPoints)) insideCount++;
      });
      
      if (stroke.tool === 'image') {
        if (insideCount > 0) this.selectedStrokes.push(stroke);
      } else {
        if (insideCount > stroke.points.length / 3 || insideCount > 5) {
          this.selectedStrokes.push(stroke);
        }
      }
    });

    // If exactly one image is selected and nothing else, convert it back to activeImage!
    if (this.selectedStrokes.length === 1 && this.selectedStrokes[0].tool === 'image') {
      const imgStroke = this.selectedStrokes[0];
      const currentStrokes = this.getCurrentStrokes();
      const index = currentStrokes.indexOf(imgStroke);
      if (index !== -1) {
        currentStrokes.splice(index, 1);
        this.clearSelection();

        const minX = Math.min(...imgStroke.points.map(p => p.x));
        const maxX = Math.max(...imgStroke.points.map(p => p.x));
        const minY = Math.min(...imgStroke.points.map(p => p.y));
        const maxY = Math.max(...imgStroke.points.map(p => p.y));

        this.activeImage = {
          imgData: imgStroke.imgData,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
          w: maxX - minX,
          h: maxY - minY
        };
        this.buildImageOverlay();
        this.render();
      }
    }
  }

  clearSelection() {
    this.selectedStrokes = [];
    this.render();
  }

  getCurrentStrokes() {
    if (this.isMultiPage && this._pages && this._pages.length > 0 && this.currentPageIndex >= 0 && this.currentPageIndex < this._pages.length) {
      if (!this._pages[this.currentPageIndex]._strokes) {
        this._pages[this.currentPageIndex]._strokes = [];
      }
      return this._pages[this.currentPageIndex]._strokes;
    }
    return this.strokes;
  }

  setCurrentStrokes(newStrokes) {
    if (this.isMultiPage && this._pages && this._pages.length > 0 && this.currentPageIndex >= 0 && this.currentPageIndex < this._pages.length) {
      this._pages[this.currentPageIndex]._strokes = newStrokes;
    } else {
      this.strokes = newStrokes;
    }
  }

  isPointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      let xi = vs[i].x, yi = vs[i].y;
      let xj = vs[j].x, yj = vs[j].y;
      let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  isPointInSelectionBounds(pt) {
    if (this.selectedStrokes.length === 0) return false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.selectedStrokes.forEach(s => {
      s.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });
    const pad = 10;
    return pt.x >= minX - pad && pt.x <= maxX + pad && pt.y >= minY - pad && pt.y <= maxY + pad;
  }

  saveState() {
    const currentState = {
      isMultiPage: this.isMultiPage,
      pdfFileId: this.pdfFileId,
      currentPageIndex: this.currentPageIndex,
      pages: this._pages.map(p => ({ ...p, _strokes: JSON.parse(JSON.stringify(p._strokes)) }))
    };
    
    // Only push if there's an actual change (or it's the first state)
    // We avoid pushing the exact same state twice to fix the off-by-one issue
    this.undoStack.push(currentState);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    if (this.onChange) this.onChange(this.getData());
  }

  undo() {
    if (this.undoStack.length > 1) { // Need at least 2 states (current + previous)
      const currentState = this.undoStack.pop();
      this.redoStack.push(currentState);
      
      const previousState = this.undoStack[this.undoStack.length - 1];
      this._applyState(previousState);
      
      this.clearSelection();
      this.render();
      this.updateSidebar();
      if (this.onChange) this.onChange(this.getData());
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const nextState = this.redoStack.pop();
      this.undoStack.push(nextState);
      
      this._applyState(nextState);
      
      this.clearSelection();
      this.render();
      this.updateSidebar();
      if (this.onChange) this.onChange(this.getData());
    }
  }

  _applyState(state) {
    this.isMultiPage = state.isMultiPage;
    this.pdfFileId = state.pdfFileId;
    this.currentPageIndex = state.currentPageIndex;
    this._pages = state.pages.map(p => ({ ...p, _strokes: JSON.parse(JSON.stringify(p._strokes)) }));
  }

  clearAll() {
    let strokes = this.getCurrentStrokes();
    if (strokes.length > 0) {
      this.saveState();
      this.setCurrentStrokes(strokes.filter(s => s.isBg));
      this.clearSelection();
      this.render();
      if (this.onChange) this.onChange(this.getData());
    }
  }


  handleImageImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round(height * (MAX_DIM / width));
            width = MAX_DIM;
          } else {
            width = Math.round(width * (MAX_DIM / height));
            height = MAX_DIM;
          }
        }

        const cvs = document.createElement('canvas');
        cvs.width = width;
        cvs.height = height;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = cvs.toDataURL('image/jpeg', 0.85);

        // Calculate center of current view in logical coordinates
        const rect = this.canvasContainer.getBoundingClientRect();
        const centerX = (-this.panX + rect.width / 2) / this.viewScale;
        const centerY = (-this.panY + rect.height / 2) / this.viewScale;

        // Ensure it fits within view roughly if it's too big
        let displayWidth = width;
        let displayHeight = height;
        const maxDisplayWidth = (rect.width * 0.8) / this.viewScale;
        if (displayWidth > maxDisplayWidth) {
          const ratio = maxDisplayWidth / displayWidth;
          displayWidth *= ratio;
          displayHeight *= ratio;
        }

        this.activeImage = {
          imgData: dataUrl,
          cx: centerX,
          cy: centerY,
          w: displayWidth,
          h: displayHeight,
          img: img
        };
        this.buildImageOverlay();
        this.render();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  buildImageOverlay() {
    if (!this.activeImage) return;
    if (this.imageOverlay) this.imageOverlay.remove();
    
    this.imageOverlay = document.createElement('div');
    this.imageOverlay.style.position = 'absolute';
    this.imageOverlay.style.border = '2px dashed #4da6ff';
    this.imageOverlay.style.cursor = 'move';
    this.imageOverlay.style.boxSizing = 'border-box';
    this.imageOverlay.style.zIndex = '1000';
    this.imageOverlay.style.backgroundImage = `url(${this.activeImage.imgData})`;
    this.imageOverlay.style.backgroundSize = '100% 100%';
    this.imageOverlay.style.touchAction = 'none'; // Prevent browser scrolling while dragging

    const resizeHandle = document.createElement('div');
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.right = '-8px';
    resizeHandle.style.bottom = '-8px';
    resizeHandle.style.width = '16px';
    resizeHandle.style.height = '16px';
    resizeHandle.style.backgroundColor = '#4da6ff';
    resizeHandle.style.borderRadius = '50%';
    resizeHandle.style.cursor = 'nwse-resize';
    resizeHandle.style.touchAction = 'none';

    const btnConfirm = document.createElement('button');
    btnConfirm.innerHTML = '✔ 적용';
    btnConfirm.style.position = 'absolute';
    btnConfirm.style.right = '-60px';
    btnConfirm.style.top = '0px';
    btnConfirm.style.background = '#50c878';
    btnConfirm.style.color = '#fff';
    btnConfirm.style.border = 'none';
    btnConfirm.style.borderRadius = '4px';
    btnConfirm.style.padding = '4px 8px';
    btnConfirm.style.cursor = 'pointer';

    const btnCancel = document.createElement('button');
    btnCancel.innerHTML = '❌ 취소';
    btnCancel.style.position = 'absolute';
    btnCancel.style.right = '-60px';
    btnCancel.style.top = '34px';
    btnCancel.style.background = '#ff4d4d';
    btnCancel.style.color = '#fff';
    btnCancel.style.border = 'none';
    btnCancel.style.borderRadius = '4px';
    btnCancel.style.padding = '4px 8px';
    btnCancel.style.cursor = 'pointer';

    this.imageOverlay.appendChild(resizeHandle);
    this.imageOverlay.appendChild(btnConfirm);
    this.imageOverlay.appendChild(btnCancel);
    this.canvasContainer.appendChild(this.imageOverlay);

    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startCx, startCy, startW, startH;

    const getEvtCoords = (e) => {
      if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    };

    const onPointerDown = (e) => {
      const targetBtn = e.target.closest('button');
      if (targetBtn === btnConfirm || targetBtn === btnCancel) return;
      e.preventDefault();
      e.stopPropagation();
      const coords = getEvtCoords(e);
      startX = coords.x;
      startY = coords.y;
      startCx = this.activeImage.cx;
      startCy = this.activeImage.cy;
      startW = this.activeImage.w;
      startH = this.activeImage.h;

      if (e.target === resizeHandle) {
        isResizing = true;
      } else {
        isDragging = true;
      }
      
      const onMove = (ev) => {
        ev.preventDefault();
        const c = getEvtCoords(ev);
        const dx = (c.x - startX) / this.viewScale;
        const dy = (c.y - startY) / this.viewScale;
        
        if (isDragging) {
          this.activeImage.cx = startCx + dx;
          this.activeImage.cy = startCy + dy;
        } else if (isResizing) {
          const newRight = (startCx + startW/2) + dx;
          const newBottom = (startCy + startH/2) + dy;
          const left = startCx - startW/2;
          const top = startCy - startH/2;
          
          this.activeImage.w = Math.max(20, newRight - left);
          this.activeImage.h = Math.max(20, newBottom - top);
          this.activeImage.cx = left + this.activeImage.w / 2;
          this.activeImage.cy = top + this.activeImage.h / 2;
        }
        this.updateImageOverlay();
      };

      const onUp = () => {
        isDragging = false;
        isResizing = false;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onUp);
    };

    this.imageOverlay.addEventListener('pointerdown', onPointerDown);

    btnConfirm.addEventListener('click', (e) => {
      e.stopPropagation();
      this.commitActiveImage();
    });

    btnCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cancelActiveImage();
    });

    this.updateImageOverlay();
  }

  updateImageOverlay() {
    if (!this.activeImage || !this.imageOverlay) return;
    const ai = this.activeImage;
    const screenX = (ai.cx - ai.w/2) * this.viewScale + this.panX;
    const screenY = (ai.cy - ai.h/2) * this.viewScale + this.panY;
    const screenW = ai.w * this.viewScale;
    const screenH = ai.h * this.viewScale;

    this.imageOverlay.style.left = `${screenX}px`;
    this.imageOverlay.style.top = `${screenY}px`;
    this.imageOverlay.style.width = `${screenW}px`;
    this.imageOverlay.style.height = `${screenH}px`;
  }

  commitActiveImage() {
    if (!this.activeImage) return;
    const ai = this.activeImage;
    const imgStroke = {
      tool: 'image',
      imgData: ai.imgData,
      opacity: 1,
      points: [
        { x: ai.cx - ai.w / 2, y: ai.cy - ai.h / 2 },
        { x: ai.cx + ai.w / 2, y: ai.cy - ai.h / 2 },
        { x: ai.cx + ai.w / 2, y: ai.cy + ai.h / 2 },
        { x: ai.cx - ai.w / 2, y: ai.cy + ai.h / 2 }
      ],
      isShape: false
    };
    this.getCurrentStrokes().push(imgStroke);
    this.cancelActiveImage();
    this.saveState();
    this.render();
  }

  cancelActiveImage() {
    if (this.imageOverlay) {
      this.imageOverlay.remove();
      this.imageOverlay = null;
    }
    this.activeImage = null;
  }

  async handlePdfImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (!window.pdfjsLib) throw new Error("PDF.js not loaded");

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Save PDF to FileDB
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      this.pdfFileId = await FileDB.saveFile(blob, 'pdf', file.name);

      const scale = 2.0; // High resolution rendering
      const firstPagePdf = await pdf.getPage(1);
      const firstViewport = firstPagePdf.getViewport({ scale });

      if (!this.isMultiPage) {
        this.isMultiPage = true;
        const currentStrokes = this._pages[0] ? this._pages[0]._strokes : this.strokes;
        this._pages = [{ 
          type: 'blank', 
          _strokes: currentStrokes, 
          bgCanvas: null,
          width: firstViewport.width,
          height: firstViewport.height
        }];
      }
      
      const startIdx = this._pages.length;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        this._pages.push({
          type: 'pdf',
          pdfPageNum: i,
          width: viewport.width,
          height: viewport.height,
          bgCanvas: canvas,
          _strokes: []
        });
      }

      this.currentPageIndex = startIdx > 0 ? startIdx : 0;
      this.updateSidebar();
      this.sidebar.classList.remove('hidden');
      const expBtn = this.toolbar.querySelector("#btn-export-pdf"); if (expBtn) expBtn.style.display = "inline-block";
      this.resetViewToPage();
      this.saveState();
      if (this.onChange) this.onChange(this.getData());
    } catch (err) {
      console.error("PDF Import Error:", err);
      alert("PDF를 불러오는 중 오류가 발생했습니다.");
    }
  }

  async loadExistingPdf() {
    if (!this.pdfFileId || !window.pdfjsLib) return;
    try {
      const fileRecord = await FileDB.getFile(this.pdfFileId);
      if (!fileRecord || !fileRecord.blob) return;

      const arrayBuffer = await fileRecord.blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const scale = 2.0;

      for (let i = 0; i < this._pages.length; i++) {
        const pageMeta = this._pages[i];
        if (pageMeta.type === 'pdf' && pageMeta.pdfPageNum && pageMeta.pdfPageNum <= pdf.numPages) {
          const page = await pdf.getPage(pageMeta.pdfPageNum);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          pageMeta.bgCanvas = canvas;
          pageMeta.width = viewport.width;
          pageMeta.height = viewport.height;
        }
      }
      this.updateSidebar();
      this.resetViewToPage();
    } catch (e) {
      console.error("Existing PDF Load Error", e);
    }
  }

  resetViewToPage() {
    const page = this._pages[this.currentPageIndex];
    if (page && page.width) {
      // Fit page to screen
      const scaleX = this.container.clientWidth / page.width;
      const scaleY = this.container.clientHeight / page.height;
      this.viewScale = Math.min(scaleX, scaleY) * 0.9; // 90% fit
      this.panX = (this.container.clientWidth - (page.width * this.viewScale)) / 2;
      this.panY = 20; // Slight top margin
    } else {
      this.viewScale = 1;
      this.panX = 0;
      this.panY = 0;
    }
    this.render();
  }

  switchPage(index) {
    if (index < 0 || index >= this._pages.length || index === this.currentPageIndex) return;
    this.currentPageIndex = index;
    this.undoStack = [];
    this.redoStack = [];
    this.updateSidebar();
    this.resetViewToPage();
  }

  updateSidebar() {
    const container = this.sidebar.querySelector('#drawing-thumbnails');
    container.innerHTML = '';

    this._pages.forEach((page, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'page-thumbnail' + (idx === this.currentPageIndex ? ' active' : '');
      thumb.draggable = true;

      if (page.bgCanvas) {
        // Create thumbnail sized canvas
        const tCanvas = document.createElement('canvas');
        tCanvas.width = 150;
        tCanvas.height = 150 * (page.bgCanvas.height / page.bgCanvas.width);
        const tCtx = tCanvas.getContext('2d');
        tCtx.drawImage(page.bgCanvas, 0, 0, tCanvas.width, tCanvas.height);

        // Draw strokes on thumbnail
        const pScale = tCanvas.width / page.bgCanvas.width;
        tCtx.scale(pScale, pScale);
        page._strokes.forEach(s => {
          tCtx.beginPath();
          tCtx.lineCap = 'round'; tCtx.lineJoin = 'round';
          tCtx.lineWidth = s.size; tCtx.strokeStyle = s.color; tCtx.globalAlpha = s.opacity || 1;
          s.points.forEach((pt, i) => {
            if (i === 0) tCtx.moveTo(pt.x, pt.y); else tCtx.lineTo(pt.x, pt.y);
          });
          tCtx.stroke();
        });

        thumb.appendChild(tCanvas);
      } else {
        thumb.style.height = '150px';
        thumb.style.background = '#333';
      }

      const num = document.createElement('div');
      num.className = 'page-thumbnail-num';
      num.textContent = (idx + 1);
      thumb.appendChild(num);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'page-thumbnail-delete';
      deleteBtn.innerHTML = '✖';
      deleteBtn.title = '이 페이지 삭제';
      deleteBtn.style.cssText = 'position:absolute; top:4px; right:4px; background:rgba(255,0,0,0.8); color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10; opacity:0; transition:opacity 0.2s;';
      
      thumb.addEventListener('mouseenter', () => deleteBtn.style.opacity = '1');
      thumb.addEventListener('mouseleave', () => deleteBtn.style.opacity = '0');

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._pages.length <= 1) {
          alert('마지막 페이지는 삭제할 수 없습니다.');
          return;
        }
        if (confirm('이 페이지를 삭제하시겠습니까?')) {
          this._pages.splice(idx, 1);
          if (this.currentPageIndex >= this._pages.length) {
            this.currentPageIndex = this._pages.length - 1;
          } else if (this.currentPageIndex > idx) {
            this.currentPageIndex--;
          }
          this.updateSidebar();
          this.resetViewToPage();
          if (this.onChange) this.onChange(this.getData());
        }
      });
      thumb.appendChild(deleteBtn);

      thumb.addEventListener('click', () => this.switchPage(idx));

      // Drag and drop
      thumb.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', idx);
        thumb.style.opacity = '0.5';
      });
      thumb.addEventListener('dragend', () => {
        thumb.style.opacity = '1';
        container.querySelectorAll('.page-thumbnail').forEach(el => el.classList.remove('drag-over'));
      });
      thumb.addEventListener('dragover', (e) => {
        e.preventDefault();
        thumb.classList.add('drag-over');
      });
      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drag-over');
      });
      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = idx;
        if (fromIdx !== toIdx) {
          const moved = this._pages.splice(fromIdx, 1)[0];
          this._pages.splice(toIdx, 0, moved);
          if (this.currentPageIndex === fromIdx) this.currentPageIndex = toIdx;
          else if (fromIdx < this.currentPageIndex && toIdx >= this.currentPageIndex) this.currentPageIndex--;
          else if (fromIdx > this.currentPageIndex && toIdx <= this.currentPageIndex) this.currentPageIndex++;
          this.updateSidebar();
        }
      });

      container.appendChild(thumb);
    });
  }


  getData() {
    if (this.activeImage) {
      this.commitActiveImage();
    }
    
    if (this.isMultiPage) {
      return {
        type: 'pdf_drawing',
        pdfFileId: this.pdfFileId,
        strokesPerPage: JSON.parse(JSON.stringify(this._pages.map(p => p._strokes))),
        pages: JSON.parse(JSON.stringify(this._pages.map(p => ({
          type: p.type,
          pdfPageNum: p.pdfPageNum,
          width: p.width,
          height: p.height,
          _strokes: p._strokes
        }))))
      };
    }
    return JSON.parse(JSON.stringify(this.strokes));
  }


  fitContent() {
    let contentWidth = 0;
    let contentHeight = 0;
    let minX = 0, minY = 0;
    const padding = 20;

    if (this.isMultiPage && this._pages && this._pages.length > 0) {
      const page = this._pages[this.currentPageIndex];
      if (page && page.width && page.height) {
        contentWidth = page.width + padding * 2;
        contentHeight = page.height + padding * 2;
        minX = 0;
        minY = 0;
      }
    }

    if (contentWidth === 0) {
      let strokes = this.getCurrentStrokes();
      if (!strokes || strokes.length === 0) return;
      let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
      let hasStrokes = false;
      strokes.forEach(s => {
        if (s.isBg) return;
        if (!s.points || s.points.length === 0) return;
        const size = s.size || 2;
        hasStrokes = true;
        s.points.forEach(p => {
          if (p.x - size < sMinX) sMinX = p.x - size;
          if (p.y - size < sMinY) sMinY = p.y - size;
          if (p.x + size > sMaxX) sMaxX = p.x + size;
          if (p.y + size > sMaxY) sMaxY = p.y + size;
        });
      });
      if (!hasStrokes) return;
      
      minX = sMinX;
      minY = sMinY;
      contentWidth = sMaxX - sMinX + padding * 2;
      contentHeight = sMaxY - sMinY + padding * 2;
    }

    if (contentWidth <= 0 || contentHeight <= 0) return;

    const rect = this.canvasContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    this.viewScale = Math.min(scaleX, scaleY, 1);

    const scaledWidth = contentWidth * this.viewScale;
    
    // Always align to top instead of centering vertically to avoid the "empty toolbar space" illusion
    this.panX = (rect.width - scaledWidth) / 2 - (minX - padding) * this.viewScale;
    this.panY = - (minY - padding) * this.viewScale;
    
    this.updateZoomIndicator();
  }

  resize() {
    const rect = this.canvasContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(dpr, dpr);

    if (this.readOnly) {
      this.fitContent();
    }

    this.render();
  }

  render() {
    if (this.activeImage) this.updateImageOverlay();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();

    // Apply pan and zoom
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.viewScale, this.viewScale);

    const currentPage = this._pages[this.currentPageIndex];
    if (currentPage && currentPage.bgCanvas) {
      this.ctx.drawImage(currentPage.bgCanvas, 0, 0);
    } else if (this.layoutMode === 'paged' && !this.isMultiPage) {
      // Calculate how many pages to draw based on strokes
      let maxY = 0;
      this.strokes.forEach(stroke => {
        stroke.points.forEach(p => {
          if (p.y > maxY) maxY = p.y;
        });
      });
      const pageHeight = this.pageHeight || 1130;
      const pageGap = 20;
      const pageWidth = this.canvas.width / window.devicePixelRatio;

      const numPages = Math.max(1, Math.ceil(maxY / (pageHeight + pageGap)));

      for (let i = 0; i < numPages + 1; i++) { // +1 to always show the next blank page
        const yOffset = i * (pageHeight + pageGap);
        // Draw page shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(5, yOffset + 5, pageWidth, pageHeight);
        // Draw page background
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, yOffset, pageWidth, pageHeight);
      }
    }


    // Draw saved strokes
    this.getCurrentStrokes().forEach(stroke => this.drawStroke(stroke));

    // Draw current stroke
    if (this.currentStroke) {
      this.drawStroke(this.currentStroke);
    }

    // Draw Lasso path
    if (this.lassoPoints.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
      for (let i = 1; i < this.lassoPoints.length; i++) {
        this.ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
      }
      this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      this.ctx.lineWidth = 1 / this.viewScale;
      this.ctx.setLineDash([5 / this.viewScale, 5 / this.viewScale]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Draw Selection Bounding Box
    if (this.selectedStrokes.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.selectedStrokes.forEach(s => {
        s.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
      });
      const pad = 5;
      this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      this.ctx.lineWidth = 1 / this.viewScale;
      this.ctx.setLineDash([4 / this.viewScale, 4 / this.viewScale]);
      this.ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
      this.ctx.setLineDash([]);

      this.selectedStrokes.forEach(stroke => {
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.shadowColor = '#3b82f6';
        this.ctx.shadowBlur = 10 / this.viewScale;
        this.drawStroke(stroke, true);
        this.ctx.restore();
      });
    }

    this.ctx.restore();
  }

  drawStroke(stroke, isHighlight = false) {
    if (stroke.isBg) return;

    if (stroke.tool === 'image') {
      if (!stroke.imgElement) {
        stroke.imgElement = new Image();
        stroke.imgElement.onload = () => this.render();
        stroke.imgElement.src = stroke.imgData;
      }
      if (stroke.points && stroke.points.length >= 4 && stroke.imgElement.complete) {
        this.ctx.save();
        if (isHighlight) {
          this.ctx.globalAlpha = 0.5; // highlight effect
        } else {
          this.ctx.globalAlpha = stroke.opacity || 1;
        }
        const w = stroke.points[1].x - stroke.points[0].x;
        const h = stroke.points[2].y - stroke.points[1].y;
        this.ctx.drawImage(stroke.imgElement, stroke.points[0].x, stroke.points[0].y, w, h);
        this.ctx.restore();
      }
      return;
    }

    if (!stroke.points || stroke.points.length === 0) return;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = stroke.size;
    this.ctx.strokeStyle = stroke.color;
    this.ctx.globalAlpha = stroke.opacity || 1;

    // Simulate highlighter blending
    if (stroke.tool === 'highlighter' && !isHighlight) {
      this.ctx.globalCompositeOperation = 'multiply'; // Works well on light backgrounds
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
    }

    if (stroke.points.length === 1) {
      // Draw a dot
      this.ctx.fillStyle = stroke.color;
      this.ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (stroke.isShape) {
      if (stroke.shapeType === 'line' || stroke.shapeType === undefined) {
        this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        this.ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
        this.ctx.stroke();
      } else if (stroke.shapeType === 'rectangle') {
        this.ctx.strokeRect(stroke.rect.x, stroke.rect.y, stroke.rect.w, stroke.rect.h);
      } else if (stroke.shapeType === 'triangle' || stroke.shapeType === 'polygon') {
        this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for(let i=1; i<stroke.points.length; i++) this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        this.ctx.closePath();
        this.ctx.stroke();
      } else if (stroke.shapeType === 'circle') {
        this.ctx.arc(stroke.center.x, stroke.center.y, stroke.radius, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (stroke.shapeType === 'ellipse') {
        this.ctx.ellipse(stroke.center.x, stroke.center.y, stroke.rx, stroke.ry, 0, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (stroke.shapeType === 'star') {
        const cx = stroke.rect.x + stroke.rect.w/2;
        const cy = stroke.rect.y + stroke.rect.h/2;
        const outerR = Math.min(stroke.rect.w, stroke.rect.h) / 2;
        const innerR = outerR * 0.4;
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = -Math.PI / 2 + (i * Math.PI / 5);
          const px = cx + r * Math.cos(angle);
          const py = cy + r * Math.sin(angle);
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.stroke();
      } else if (stroke.shapeType === 'heart') {
        const x = stroke.rect.x;
        const y = stroke.rect.y;
        const w = stroke.rect.w;
        const h = stroke.rect.h;
        this.ctx.moveTo(x + w/2, y + h*0.25);
        this.ctx.bezierCurveTo(x + w/2, y, x, y, x, y + h*0.35);
        this.ctx.bezierCurveTo(x, y + h*0.6, x + w/2, y + h*0.85, x + w/2, y + h);
        this.ctx.bezierCurveTo(x + w/2, y + h*0.85, x + w, y + h*0.6, x + w, y + h*0.35);
        this.ctx.bezierCurveTo(x + w, y, x + w/2, y, x + w/2, y + h*0.25);
        this.ctx.stroke();
      }
    } else {
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        this.ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }
      const last = stroke.points[stroke.points.length - 1];
      this.ctx.lineTo(last.x, last.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}

window.NeonDrawingBoard = NeonDrawingBoard;
