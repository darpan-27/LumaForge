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
    
    // Draw initial state matrix
    ctx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);
    
    imageMetaDisplay.textContent = `${loadedImage.width} × ${loadedImage.height} px`;
    
    // Clear initial view constraints out of view
    emptyState.style.display = 'none';
    canvas.style.display = 'block';
    
    // નવો ફોટો આવે ત્યારે ઝૂમ લેવલ રીસેટ કરો
    currentZoom = 1;
    applyZoom();
    
    // Enable workflow toolbars
    toggleInteractiveState(true);
  }

  function toggleInteractiveState(isEnabled) {
    const interactiveElements = [removeBgButton, bgFeather, autoEnhanceBtn, downloadBtn, zoomInBtn, zoomOutBtn];
    interactiveElements.forEach(el => {
      if (el) el.disabled = !isEnabled;
    });
  }

  // --- 2. Zoom In & Zoom Out Logic ---
  zoomInBtn.addEventListener('click', () => {
    if (!loadedImage) return;
    currentZoom += ZOOM_SPEED;
    if (currentZoom > 3) currentZoom = 3; // મેક્સિમમ ૩૦૦% ઝૂમ
    applyZoom();
  });

  zoomOutBtn.addEventListener('click', () => {
    if (!loadedImage) return;
    currentZoom -= ZOOM_SPEED;
    if (currentZoom < 0.5) currentZoom = 0.5; // મિનિમમ ૫૦% ઝૂમ આઉટ
    applyZoom();
  });

  function applyZoom() {
    canvas.style.transform = `scale(${currentZoom})`;
  }

  // --- 3. AI Background Removal Pipeline Execution ---
  removeBgButton.addEventListener('click', async () => {
    if (!loadedImage) return;

    // Update state to Processing
    bgStatus.textContent = 'AI Processing...';
    bgStatus.className = 'status-badge processing';
    removeBgButton.disabled = true;

    try {
      // AI મોડલ રન કરીને બેકગ્રાઉન્ડ રીમુવ કરો
      await isolateSubjectForeground();
      
      // Update state to complete
      bgStatus.textContent = 'Removed';
      bgStatus.className = 'status-badge active';
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

    // જો ગ્લોબલ વિન્ડોમાં Body-Pix મોડલ લોડ ન થયું હોય તો તેને લોડ કરો
    if (!window.bodyPixModel) {
      bgStatus.textContent = 'Loading AI Model...';
      window.bodyPixModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
    }

    // કેનવાસ પરથી માણસ (Person) ને સેગ્મેન્ટ (ડિટેક્ટ) કરો
    const segmentation = await window.bodyPixModel.segmentPerson(canvas, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7 // ચોકસાઈનો દર
    });

    // ઓરિજિનલ ઈમેજનો પિક્સેલ ડેટા લો
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    // લૂપ ચલાવીને જે ભાગ માણસનો નથી (0 છે), તેને ટ્રાન્સપરન્ટ (0 વિઝિબિલિટી) કરી દો
    for (let i = 0; i < segmentation.data.length; i++) {
      const isPerson = segmentation.data[i] === 1;
      const alphaIndex = i * 4 + 3; // 4થો ભાગ એટલે Alpha Channel

      if (!isPerson) {
        data[alphaIndex] = 0; // માણસ સિવાયનું બધું જ ગાયબ (Transparent)
      }
    }
    
    // સુધારેલો પિક્સેલ ડેટા પાછો કેનવાસ પર મૂકો
    ctx.putImageData(imgData, 0, 0);
  }

  // Handle Feather Slider numeric output updates
  bgFeather.addEventListener('input', (e) => {
    bgFeatherValue.textContent = e.target.value;
  });

  // --- 4. Adjustment Sliders Integration ---
  // Sync slider output elements and trigger generic re-render flags
  adjustmentSliders.forEach(slider => {
    const outputField = slider.nextElementSibling;
    slider.addEventListener('input', (e) => {
      if (outputField && outputField.tagName === 'OUTPUT') {
        outputField.textContent = e.target.value;
      }
      applyAdjustmentFilters();
    });
  });

  function applyAdjustmentFilters() {
    if (!loadedImage) return;
    
    // Clear frame base back down before compiling compound configurations
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
      ctx.filter = 'none'; // Clear state architecture properties
    }
  }

  resetAdjustmentsBtn.addEventListener('click', () => {
    adjustmentSliders.forEach(slider => {
      slider.value = 0;
      const outputField = slider.nextElementSibling;
      if (outputField && outputField.tagName === 'OUTPUT') {
        outputField.textContent = '0';
      }
    });
    if (loadedImage) initializeCanvasContext();
  });

  // --- 5. Retouch Toolbar Controls Selection Map Routing ---
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool;
      toolNameDisplay.textContent = activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
    });
  });

  // Interactive UI adjustments value sync tracking updates
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

  // --- 6. Custom Canvas Brush Retouch System Interface Engine Hooks ---
  canvas.addEventListener('mouseenter', () => {
    brushCursor.style.display = 'block';
    updateBrushCursorSize();
  });

  canvas.addEventListener('mouseleave', () => {
    brushCursor.style.display = 'none';
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    
    // કોર્ડિનેટ્સને currentZoom વડે ભાગવાથી ઝૂમ કરેલા ફોટા પર પણ બ્રશ એકદમ સાચી જગ્યાએ ચાલશે
    const x = (e.clientX - rect.left) / currentZoom;
    const y = (e.clientY - rect.top) / currentZoom;
    
    brushCursor.style.left = `${e.clientX}px`;
    brushCursor.style.top = `${e.clientY}px`;
    
    if (isDrawing) {
      executeBrushStroke(x, y);
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / currentZoom;
    const y = (e.clientY - rect.top) / currentZoom;
    executeBrushStroke(x, y);
  });

  window.addEventListener('mouseup', () => {
    isDrawing = false;
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
      // Heal samples neighboring context pixels safely nearby shifts
      ctx.globalAlpha = 0.3;
      ctx.drawImage(canvas, x + 15, y + 15, radius * 2, radius * 2, x - radius, y - radius, radius * 2, radius * 2);
    }
    
    ctx.restore();
  }

  // --- 7. File Export Infrastructure Trigger ---
  downloadBtn.addEventListener('click', () => {
    if (!canvas) return;
    const targetDataUrl = canvas.toDataURL('image/png');
    const transferAnchor = document.createElement('a');
    transferAnchor.download = 'lumaforge-retouched-export.png';
    transferAnchor.href = targetDataUrl;
    transferAnchor.click();
  });
});
