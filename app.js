document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Element Registrations ---
  const imageInput = document.getElementById('imageInput');
  const dropZone = document.getElementById('dropZone');
  const emptyState = document.getElementById('emptyState');
  const canvas = document.getElementById('photoCanvas');
  const ctx = canvas.getContext('2d');
  const brushCursor = document.getElementById('brushCursor');
  
  // Header Meta / Navigation
  const fileNameDisplay = document.getElementById('fileName');
  const imageMetaDisplay = document.getElementById('imageMeta');
  const downloadBtn = document.getElementById('downloadButton');
  
  // Zoom Controls
  const zoomInBtn = document.getElementById('zoomInButton');
  const zoomOutBtn = document.getElementById('zoomOutButton');

  // Undo & Redo Controls
  const undoButton = document.getElementById('undoButton');
  const redoButton = document.getElementById('redoButton');
  
  // Background Removal Tool Panel Nodes
  const removeBgButton = document.getElementById('removeBgButton');
  const bgStatus = document.getElementById('bgStatus');
  const bgFeather = document.getElementById('bgFeather');
  const bgFeatherValue = document.getElementById('bgFeatherValue');
  
  // Retouch Brush Controls
  const brushSizeInput = document.getElementById('brushSize');
  const brushSizeValue = document.getElementById('brushSizeValue');
  const brushStrengthInput = document.getElementById('brushStrength');
  const brushStrengthValue = document.getElementById('brushStrengthValue');
  const toolButtons = document.querySelectorAll('.icon-button');
  const toolNameDisplay = document.getElementById('toolName');

  // Adjustment Sliders
  const adjustmentSliders = document.querySelectorAll('.adjustments input[type="range"]');
  const resetAdjustmentsBtn = document.getElementById('resetAdjustments');
  const autoEnhanceBtn = document.getElementById('autoEnhance');
  
  // Context Management Variables
  let loadedImage = null;
  let isDrawing = false;
  let activeTool = 'heal';
  
  // Zoom State Variables
  let currentZoom = 1; // 1 = 100% ઓરિજિનલ સાઇઝ
  const ZOOM_SPEED = 0.1; // એક ક્લિક પર કેટલું ઝૂમ કરવું

  // Undo & Redo State History Stacks
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY_STATES = 20;

  // --- 1. Image Import Management Pipeline ---
  imageInput.addEventListener('change', handleFileSelection);

  function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        initializeCanvasContext();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function initializeCanvasContext() {
    if (!loadedImage) return;

    // Constraint-bounded canvas layout geometry map scaling
    const maxWorkspaceWidth = Math.min(800, dropZone.clientWidth - 48);
    const maxWorkspaceHeight = Math.min(500, dropZone.clientHeight - 48);
    
    let targetWidth = loadedImage.width;
    let targetHeight = loadedImage.height;
    
    const scaleFactor = Math.min(maxWorkspaceWidth / targetWidth, maxWorkspaceHeight / targetHeight);
    if (scaleFactor < 1) {
      targetWidth = Math.floor(targetWidth * scaleFactor);
      targetHeight = Math.floor(targetHeight * scaleFactor);
    }
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // બેઝિક ફિલ્ટર્સ ક્લિયર કરી ઓરિજિનલ ફોટો ડ્રો કરવો
    ctx.filter = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);
    
    imageMetaDisplay.textContent = `${loadedImage.width} × ${loadedImage.height} px`;
    
    // વ્યુ સેટિંગ્સ બદલવા
    emptyState.style.display = 'none';
    canvas.style.display = 'block';
    
    // નવો ફોટો આવે ત્યારે ઝૂમ અને હિસ્ટ્રી ક્લિયર કરો
    currentZoom = 1;
    applyZoom();
    
    // હિસ્ટ્રી રીસેટ કરીને પહેલી સ્ટેટ પુશ કરવી
    undoStack = [];
    redoStack = [];
    undoStack.push(canvas.toDataURL()); 
    
    // સ્લાઇડર્સ રીસેટ કરવા
    adjustmentSliders.forEach(slider => {
      slider.value = 0;
      const outputField = slider.nextElementSibling;
      if (outputField && outputField.tagName === 'OUTPUT') {
        outputField.textContent = '0';
      }
    });

    // ટૂલબાર એક્ટિવેટ કરવા
    toggleInteractiveState(true);
  }

  function toggleInteractiveState(isEnabled) {
    const interactiveElements = [removeBgButton, bgFeather, autoEnhanceBtn, downloadBtn, zoomInBtn, zoomOutBtn];
    interactiveElements.forEach(el => {
      if (el) el.disabled = !isEnabled;
    });
    updateUndoRedoButtons();
  }

  // --- 2. Zoom In & Zoom Out Logic ---
  zoomInBtn.addEventListener('click', () => {
    if (!loadedImage) return;
    currentZoom += ZOOM_SPEED;
    if (currentZoom > 3) currentZoom = 3; 
    applyZoom();
  });

  zoomOutBtn.addEventListener('click', () => {
    if (!loadedImage) return;
    currentZoom -= ZOOM_SPEED;
    if (currentZoom < 0.5) currentZoom = 0.5; 
    applyZoom();
  });

  function applyZoom() {
    canvas.style.transform = `scale(${currentZoom})`;
  }

  // --- 3. Undo & Redo System Engine ---
  function saveHistoryState() {
    if (!loadedImage) return;
    if (undoStack.length >= MAX_HISTORY_STATES) {
      undoStack.shift(); 
    }
    undoStack.push(canvas.toDataURL());
    redoStack = []; // નવી એક્શન પર રેડુ ક્લિયર થાય
    updateUndoRedoButtons();
  }

  undoButton.addEventListener('click', () => {
    if (undoStack.length <= 1) return; 

    const currentState = undoStack.pop();
    redoStack.push(currentState);
    
    const previousStateImg = undoStack[undoStack.length - 1];
    restoreCanvasFromDataURL(previousStateImg);
  });

  redoButton.addEventListener('click', () => {
    if (redoStack.length === 0) return;

    const nextStateImg = redoStack.pop();
    undoStack.push(nextStateImg);
    restoreCanvasFromDataURL(nextStateImg);
  });

  function restoreCanvasFromDataURL(dataUrl) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      updateUndoRedoButtons();
    };
    img.src = dataUrl;
  }

  function updateUndoRedoButtons() {
    if (!loadedImage) {
      undoButton.disabled = true;
      redoButton.disabled = true;
      return;
    }
    undoButton.disabled = undoStack.length <= 1;
    redoButton.disabled = redoStack.length === 0;
  }

  // --- 4. AI Background Removal Pipeline Execution ---
  removeBgButton.addEventListener('click', async () => {
    if (!loadedImage) return;

    bgStatus.textContent = 'AI Processing...';
    bgStatus.className = 'status-badge processing';
    removeBgButton.disabled = true;

    try {
      await isolateSubjectForeground();
      bgStatus.textContent = 'Removed';
      bgStatus.className = 'status-badge active';
      saveHistoryState(); 
    } catch (error) {
      console.error("AI Background Removal Error: ", error);
      bgStatus.textContent = 'Error';
      bgStatus.className = 'status-badge error';
    } finally {
      removeBgButton.disabled = false;
    }
  });

  async function isolateSubjectForeground() {
    const w = canvas.width;
    const h = canvas.height;
    
    if (typeof bodyPix === 'undefined') {
      throw new Error("BodyPix library is not loaded. Check HTML scripts.");
    }

    if (!window.bodyPixModel) {
      bgStatus.textContent = 'Loading AI Model...';
      window.bodyPixModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
    }

    const segmentation = await window.bodyPixModel.segmentPerson(canvas, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7 
    });

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    for (let i = 0; i < segmentation.data.length; i++) {
      const isPerson = segmentation.data[i] === 1;
      const alphaIndex = i * 4 + 3;

      if (!isPerson) {
        data[alphaIndex] = 0; 
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
  }

  bgFeather.addEventListener('input', (e) => {
    bgFeatherValue.textContent = e.target.value;
  });

  // --- 5. Adjustment Sliders Integration ---
  adjustmentSliders.forEach(slider => {
    const outputField = slider.nextElementSibling;
    slider.addEventListener('input', (e) => {
      if (outputField && outputField.tagName === 'OUTPUT') {
        outputField.textContent = e.target.value;
      }
      applyAdjustmentFilters();
    });

    slider.addEventListener('change', () => {
      saveHistoryState();
    });
  });

  function applyAdjustmentFilters() {
    if (!loadedImage) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
    
    let filterString = '';
    
    adjustmentSliders.forEach(slider => {
      const type = slider.dataset.adjust;
      const value = parseInt(slider.value, 10);
      
      if (value === 0) return;
      
      switch(type) {
        case 'exposure':
          filterString += `brightness(${100 + value}%) `;
          break;
        case 'contrast':
          filterString += `contrast(${100 + value}%) `;
          break;
        case 'saturation':
          filterString += `saturate(${100 + value}%) `;
          break;
        case 'clarity':
          filterString += `contrast(${100 + (value * 0.5)}%) saturate(${100 + (value * 0.1)}%) `;
          break;
      }
    });
    
    if (filterString.trim() !== '') {
      ctx.filter = filterString;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none'; 
    }
  }

  resetAdjustmentsBtn.addEventListener('click', () => {
    if (loadedImage) initializeCanvasContext();
  });

  // --- 6. Retouch Toolbar Controls Selection Map Routing ---
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool;
      toolNameDisplay.textContent = activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
    });
  });

  brushSizeInput.addEventListener('input', (e) => {
    brushSizeValue.textContent = e.target.value;
    updateBrushCursorSize();
  });

  brushStrengthInput.addEventListener('input', (e) => {
    brushStrengthValue.textContent = e.target.value;
  });

  function updateBrushCursorSize() {
    const size = brushSizeInput.value;
    brushCursor.style.width = `${size}px`;
    brushCursor.style.height = `${size}px`;
  }

  // --- 7. Custom Canvas Brush Retouch System Interface Engine Hooks ---
  canvas.addEventListener('mouseenter', () => {
    brushCursor.style.display = 'block';
    updateBrushCursorSize();
  });

  canvas.addEventListener('mouseleave', () => {
    brushCursor.style.display = 'none';
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / currentZoom;
    const y = (e.clientY - rect.top) / currentZoom;
    
    brushCursor.style.left = `${e.clientX}px`;
    brushCursor.style.top = `${e.clientY}px`;
    
    if (isDrawing) {
      executeBrushStroke(x, y);
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!loadedImage) return;
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / currentZoom;
    const y = (e.clientY - rect.top) / currentZoom;
    executeBrushStroke(x, y);
  });

  window.addEventListener('mouseup', () => {
    if (isDrawing) {
      isDrawing = false;
      saveHistoryState(); 
    }
  });

  function executeBrushStroke(x, y) {
    const radius = parseInt(brushSizeInput.value, 10) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    
    if (activeTool === 'brighten') {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
    } else if (activeTool === 'darken') {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fill();
    } else if (activeTool === 'smooth') {
      ctx.globalAlpha = 0.1;
      ctx.drawImage(canvas, x - 2, y - 2, radius, radius, x - 2, y - 2, radius, radius);
    } else if (activeTool === 'heal') {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(canvas, x + 15, y + 15, radius * 2, radius * 2, x - radius, y - radius, radius * 2, radius * 2);
    }
    
    ctx.restore();
  }

  // --- 8. File Export Infrastructure Trigger ---
  downloadBtn.addEventListener('click', () => {
    if (!canvas || !loadedImage) return;
    const targetDataUrl = canvas.toDataURL('image/png');
    const transferAnchor = document.createElement('a');
    transferAnchor.download = 'lumaforge-retouched-export.png';
    transferAnchor.href = targetDataUrl;
    transferAnchor.click();
  });
});
