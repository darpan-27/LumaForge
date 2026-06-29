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
    
    // Enable workflow toolbars
    toggleInteractiveState(true);
  }

  function toggleInteractiveState(isEnabled) {
    const interactiveElements = [removeBgButton, bgFeather, autoEnhanceBtn, downloadBtn];
    interactiveElements.forEach(el => {
      if (el) el.disabled = !isEnabled;
    });
  }

  // --- 2. AI Background Removal Pipeline Execution (Simulation Wrapper) ---
  removeBgButton.addEventListener('click', () => {
    if (!loadedImage) return;

    // Update state to Processing
    bgStatus.textContent = 'Processing...';
    bgStatus.className = 'status-badge processing';
    removeBgButton.disabled = true;

    // Simulate server/model execution delay latency
    setTimeout(() => {
      isolateSubjectForeground();
      
      // Update state to complete
      bgStatus.textContent = 'Removed';
      bgStatus.className = 'status-badge active';
      removeBgButton.disabled = false;
    }, 2200);
  });

  function isolateSubjectForeground() {
    const w = canvas.width;
    const h = canvas.height;
    
    // Extract Image Data Matrix buffers
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    // Center point configuration boundaries for subject simulation mapping
    const centerX = w / 2;
    const centerY = h / 2;
    const evaluationRadius = Math.min(w, h) * 0.38; // Radius parameterizing the subject boundary mask bounding box
    const featherValue = parseInt(bgFeather.value, 10) || 2;

    // Walk pixels scanning and transforming matching background elements alpha configuration bounds channel
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const index = (y * w + x) * 4;
        
        // Calculate Euclidean distance vector from canvas geometric frame center
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > evaluationRadius) {
          // Pixel is outside subject boundary: calculate falloff mask alpha channel transition decay
          const edgeDistance = distance - evaluationRadius;
          if (edgeDistance < featherValue) {
            const opacityRatio = 1 - (edgeDistance / featherValue);
            data[index + 3] = Math.min(data[index + 3], opacityRatio * 255); // Alpha channel
          } else {
            data[index + 3] = 0; // Absolute Transparency
          }
        }
      }
    }
    
    // Re-render modified byte matrices back down safely to user canvas surface layout frame views
    ctx.putImageData(imgData, 0, 0);
  }

  // Handle Feather Slider numeric output updates
  bgFeather.addEventListener('input', (e) => {
    bgFeatherValue.textContent = e.target.value;
  });

  // --- 3. Adjustment Sliders Integration ---
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

  // --- 4. Retouch Toolbar Controls Selection Map Routing ---
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

  // --- 5. Custom Canvas Brush Retouch System Interface Engine Hooks ---
  canvas.addEventListener('mouseenter', () => {
    brushCursor.style.display = 'block';
    updateBrushCursorSize();
  });

  canvas.addEventListener('mouseleave', () => {
    brushCursor.style.display = 'none';
  });

  canvas.addEventListener('mousemove', (e) => {
    // Sync absolute bounds relative targeting anchors offset maps
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    brushCursor.style.left = `${e.clientX}px`;
    brushCursor.style.top = `${e.clientY}px`;
    
    if (isDrawing) {
      executeBrushStroke(x, y);
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    executeBrushStroke(e.clientX - rect.left, e.clientY - rect.top);
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

  // --- 6. File Export Infrastructure Trigger ---
  downloadBtn.addEventListener('click', () => {
    if (!canvas) return;
    const targetDataUrl = canvas.toDataURL('image/png');
    const transferAnchor = document.createElement('a');
    transferAnchor.download = 'lumaforge-retouched-export.png';
    transferAnchor.href = targetDataUrl;
    transferAnchor.click();
  });
});
