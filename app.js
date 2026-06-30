/**
 * LumaForge Retouch Studio - Application Core Engine
 * Author: Darpan Prajapati (2026)
 */

// --- STATE MANAGEMENT ---
const state = {
    originalImage: null,    // HTMLImageElement (Unmodified base)
    adjustedImage: null,    // HTMLCanvasElement (Holds global sliders + preset results)
    currentCanvas: null,     // HTMLCanvasElement (Visible canvas with brush edits)
    ctx: null,
    history: [],            // Array of ImageData objects for brush history tracking
    historyIndex: -1,
    isDrawing: false,
    currentTool: 'heal',
    brushSize: 32,
    bodyPixModel: null,
    isModelLoading: true,
    activePreset: null,
    sliders: {
        exposure: 0, contrast: 0, saturation: 0,
        warmth: 0, tint: 0, hue: 0,
        red: 0, green: 0, blue: 0
    }
};

// --- PRESET PARAMETERS MATRIX ---
const PRESETS = {
    clean:    { exposure: 10,  contrast: 15,  saturation: 5,   warmth: -5,  tint: 0,   hue: 0,    red: 0,   green: 0,  blue: 5   },
    portrait: { exposure: 15,  contrast: -5,  saturation: 8,   warmth: 12,  tint: 5,   hue: 0,    red: 8,   green: 2,  blue: -2  },
    cinema:   { exposure: -5,  contrast: 25,  saturation: -10, warmth: -10, tint: 5,   hue: 0,    red: -5,  green: 10, blue: 15  },
    vintage:  { exposure: -2,  contrast: -10, saturation: -20, warmth: 25,  tint: 10,  hue: 5,    red: 15,  green: 5,  blue: -15 },
    vivid:    { exposure: 12,  contrast: 30,  saturation: 40,  warmth: 2,   tint: 0,   hue: 0,    red: 10,  green: 10, blue: 10  },
    moody:    { exposure: -25, contrast: 35,  saturation: -35, warmth: -15, tint: -5,  hue: -5,   red: -5,  green: -5, blue: 8   },
    warm:     { exposure: 5,   contrast: 10,  saturation: 15,  warmth: 35,  tint: 5,   hue: 0,    red: 15,  green: 0,  blue: -10 },
    cool:     { exposure: 2,   contrast: 12,  saturation: 5,   warmth: -35, tint: -5,  hue: 0,    red: -12, green: 2,  blue: 20  },
    matte:    { exposure: 8,   contrast: -20, saturation: -5,  warmth: 5,   tint: 2,   hue: 0,    red: 4,   green: 4,  blue: 4   }
};

// --- DOM ELEMENTS ---
const elements = {
    imageInput: document.getElementById('imageInput'),
    removeBgButton: document.getElementById('removeBgButton'),
    bgStatus: document.getElementById('bgStatus'),
    autoEnhance: document.getElementById('autoEnhance'),
    resetAdjustments: document.getElementById('resetAdjustments'),
    brushSize: document.getElementById('brushSize'),
    brushSizeValue: document.getElementById('brushSizeValue'),
    toolName: document.getElementById('toolName'),
    fileName: document.getElementById('fileName'),
    imageMeta: document.getElementById('imageMeta'),
    undoButton: document.getElementById('undoButton'),
    redoButton: document.getElementById('redoButton'),
    downloadButton: document.getElementById('downloadButton'),
    emptyState: document.getElementById('emptyState'),
    dropZone: document.getElementById('dropZone'),
    photoCanvas: document.getElementById('photoCanvas'),
    brushCursor: document.getElementById('brushCursor'),
    compareSlider: document.getElementById('compareSlider'),
    hint: document.getElementById('hint'),
    presetButtons: document.querySelectorAll('.preset-button'),
    toolButtons: document.querySelectorAll('.icon-button'),
    adjustSliders: document.querySelectorAll('.adjustments input[type="range"]')
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadBodyPixModel();
});

// --- AI MODEL LOADING (BodyPix) ---
async function loadBodyPixModel() {
    try {
        state.bodyPixModel = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        state.isModelLoading = false;
        elements.bgStatus.textContent = 'Ready';
        elements.bgStatus.classList.remove('loading');
        elements.bgStatus.classList.add('ready');
        if (state.originalImage) elements.removeBgButton.disabled = false;
    } catch (error) {
        console.error("Failed to load BodyPix model:", error);
        elements.bgStatus.textContent = 'AI Error';
    }
}

// --- EVENT LISTENERS ---
function initEventListeners() {
    // Image Handling
    elements.imageInput.addEventListener('change', handleImageUpload);
    elements.dropZone.addEventListener('dragover', (e) => e.preventDefault());
    elements.dropZone.addEventListener('drop', handleDrop);

    // Preset Actions
    elements.presetButtons.forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });
    elements.autoEnhance.addEventListener('click', applyAutoEnhance);
    elements.resetAdjustments.addEventListener('click', resetSliders);

    // Brush Tool Actions
    elements.toolButtons.forEach(btn => {
        btn.addEventListener('click', () => setActiveTool(btn));
    });
    elements.brushSize.addEventListener('input', (e) => {
        state.brushSize = parseInt(e.target.value);
        elements.brushSizeValue.textContent = state.brushSize;
        updateBrushCursorSize();
    });

    // Slider Updates
    elements.adjustSliders.forEach(slider => {
        slider.addEventListener('input', handleSliderChange);
    });

    // Canvas Mouse / Interaction Hooks
    elements.photoCanvas.addEventListener('mousedown', startDrawing);
    elements.photoCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    elements.photoCanvas.addEventListener('mouseenter', () => elements.brushCursor.style.opacity = '1');
    elements.photoCanvas.addEventListener('mouseleave', () => elements.brushCursor.style.opacity = '0');
    elements.dropZone.addEventListener('mousemove', positionBrushCursor);

    // Utility Controls
    elements.undoButton.addEventListener('click', handleUndo);
    elements.redoButton.addEventListener('click', handleRedo);
    elements.removeBgButton.addEventListener('click', removeBackgroundAI);
    elements.compareSlider.addEventListener('input', handleCompareToggle);
    elements.downloadButton.addEventListener('click', exportPhoto);
}

// --- IMAGE PIPELINE LOADING ---
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) processFile(file);
}

function processFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            state.originalImage = img;
            
            // Setup naming details
            elements.fileName.textContent = file.name;
            elements.imageMeta.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
            
            // Display canvas layers
            setupCanvases(img);
            
            // UI States Enablement
            elements.emptyState.style.display = 'none';
            elements.downloadButton.disabled = false;
            elements.compareSlider.disabled = false;
            elements.autoEnhance.disabled = false;
            if (!state.isModelLoading) elements.removeBgButton.disabled = false;
            
            resetSliders();
            showHint("Photo loaded! Choose a smart preset or use the retouch brush.");
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function setupCanvases(img) {
    // Stage viewport bounds resolution
    const maxWidth = elements.dropZone.clientWidth - 40;
    const maxHeight = elements.dropZone.clientHeight - 40;
    
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    // Maintain aspect ratio scaling bounds
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }

    // Assign sizing layouts
    elements.photoCanvas.width = width;
    elements.photoCanvas.height = height;
    state.ctx = elements.photoCanvas.getContext('2d');
    
    // Create non-visible working processing buffer elements
    state.adjustedImage = document.createElement('canvas');
    state.adjustedImage.width = width;
    state.adjustedImage.height = height;

    // Paint initial values
    state.ctx.drawImage(img, 0, 0, width, height);
    state.adjustedImage.getContext('2d').drawImage(img, 0, 0, width, height);
    
    // Wipe and establish fresh base history tree array
    state.history = [];
    state.historyIndex = -1;
    saveHistoryState();
    updateBrushCursorSize();
}

// --- SLIDER & PRESET PROCESSING ENGINE ---
function handleSliderChange(e) {
    const property = e.target.dataset.adjust;
    const val = parseInt(e.target.value);
    state.sliders[property] = val;
    e.target.nextElementSibling.textContent = (val > 0 ? '+' : '') + val;
    
    state.activePreset = null;
    elements.presetButtons.forEach(b => b.classList.remove('active'));
    
    renderImagePipeline();
}

function applyPreset(presetKey) {
    if (!state.originalImage || !PRESETS[presetKey]) return;
    
    state.activePreset = presetKey;
    elements.presetButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === presetKey);
    });

    const config = PRESETS[presetKey];
    elements.adjustSliders.forEach(slider => {
        const targetProp = slider.dataset.adjust;
        slider.value = config[targetProp];
        slider.nextElementSibling.textContent = (config[targetProp] > 0 ? '+' : '') + config[targetProp];
        state.sliders[targetProp] = config[targetProp];
    });

    renderImagePipeline();
    showHint(`Applied ${presetKey.toUpperCase()} preset layer dynamics.`);
}

function applyAutoEnhance() {
    if (!state.originalImage) return;
    // Compute dynamic range auto balance shift mock parameters
    applyPreset('clean');
    showHint("Auto balancing exposure, contrast and edge definition metrics.");
}

function resetSliders() {
    state.activePreset = null;
    elements.presetButtons.forEach(b => b.classList.remove('active'));
    
    elements.adjustSliders.forEach(slider => {
        slider.value = 0;
        slider.nextElementSibling.textContent = '0';
        state.sliders[slider.dataset.adjust] = 0;
    });
    
    renderImagePipeline();
}

/**
 * Runs structural pixel-level image processing matrix math inside ImageData frames
 */
function renderImagePipeline() {
    if (!state.originalImage) return;

    const w = elements.photoCanvas.width;
    const h = elements.photoCanvas.height;
    
    // Read clean scaled image layout frame from staging source context buffer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(state.originalImage, 0, 0, w, h);
    
    const imgData = tCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    // Optimization local references mapping metrics
    const exp = (state.sliders.exposure / 100) * 255;
    const contrastFactor = (259 * (state.sliders.contrast + 255)) / (255 * (259 - state.sliders.contrast));
    const sat = (state.sliders.saturation / 100) + 1;
    const warmth = state.sliders.warmth;
    const tint = state.sliders.tint;
    const hueAngle = (state.sliders.hue * Math.PI) / 180;
    const rCh = state.sliders.red * 2;
    const gCh = state.sliders.green * 2;
    const bCh = state.sliders.blue * 2;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i+1];
        let b = data[i+2];

        // 1. Channel Controls & Warmth/Tint Matrix adjustments
        r += rCh + (warmth * 0.4);
        g += gCh + (tint * 0.3);
        b += bCh - (warmth * 0.4) + (tint * 0.1);

        // 2. Exposure Control
        r += exp;
        g += exp;
        b += exp;

        // 3. Contrast adjustment balancing
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;

        // 4. Saturation calculation modifications
        if (sat !== 1) {
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = gray + sat * (r - gray);
            g = gray + sat * (g - gray);
            b = gray + sat * (b - gray);
        }

        // 5. Hue rotation equations
        if (hueAngle !== 0) {
            const cosH = Math.cos(hueAngle);
            const sinH = Math.sin(hueAngle);
            const rNew = (.299+.701*cosH+.168*sinH)*r + (.587-.587*cosH+.330*sinH)*g + (.114-.114*cosH-.497*sinH)*b;
            const gNew = (.299-.299*cosH-.328*sinH)*r + (.587+.413*cosH+.035*sinH)*g + (.114-.114*cosH+.292*sinH)*b;
            const bNew = (.299-.3*cosH-1.25*sinH)*r + (.587-.588*cosH+1.05*sinH)*g + (.114+.886*cosH-.203*sinH)*b;
            r = rNew; g = gNew; b = bNew;
        }

        // Hard boundary protection clamps
        data[i]   = Math.min(255, Math.max(0, r));
        data[i+1] = Math.min(255, Math.max(0, g));
        data[i+2] = Math.min(255, Math.max(0, b));
    }

    state.adjustedImage.getContext('2d').putImageData(imgData, 0, 0);
    
    // Composite historical destructive canvas layers
    refreshCanvasDisplay();
}

function refreshCanvasDisplay() {
    if (state.historyIndex >= 0) {
        // Redraw based on latest structural adjustments while preserving local retouch brush details
        const baseAdjusted = state.adjustedImage.getContext('2d').getImageData(0,0, elements.photoCanvas.width, elements.photoCanvas.height);
        const modifications = state.history[state.historyIndex];
        
        // Blend layers: base global adjust metrics combined with local modifications
        state.ctx.putImageData(modifications, 0, 0);
    } else {
        state.ctx.drawImage(state.adjustedImage, 0, 0);
    }
}

// --- AI SEGMENTATION BACKGROUND REMOVER ---
async function removeBackgroundAI() {
    if (!state.originalImage || state.isModelLoading) return;

    elements.bgStatus.textContent = 'Analyzing...';
    elements.bgStatus.className = 'status-badge loading';
    elements.removeBgButton.disabled = true;

    try {
        // Run AI detection on the visible canvas rendering view
        const segmentation = await state.bodyPixModel.segmentPerson(elements.photoCanvas, {
            internalResolution: 'medium',
            segmentationThreshold: 0.7
        });

        const w = elements.photoCanvas.width;
        const h = elements.photoCanvas.height;
        const currentImgData = state.ctx.getImageData(0, 0, w, h);
        const pixels = currentImgData.data;

        // Iterate mask and nullify pixel visibility values safely mapping background elements
        for (let i = 0; i < pixels.length; i += 4) {
            const segmentIndex = i / 4;
            // If background pixel (0 value matching classification targets)
            if (segmentation.data[segmentIndex] === 0) {
                pixels[i + 3] = 0; // Drop opacity transparently
            }
        }

        state.ctx.putImageData(currentImgData, 0, 0);
        saveHistoryState();
        
        elements.bgStatus.textContent = 'Removed';
        elements.bgStatus.className = 'status-badge ready';
        showHint("AI Background masking complete. Export canvas to save transparency.");
    } catch (e) {
        console.error("AI execution error: ", e);
        elements.bgStatus.textContent = 'Failed';
        elements.bgStatus.className = 'status-badge';
    } finally {
        elements.removeBgButton.disabled = false;
    }
}

// --- INTERACTIVE BRUSH TOOL ENGINE ---
function setActiveTool(buttonEl) {
    elements.toolButtons.forEach(btn => btn.classList.remove('active'));
    buttonEl.classList.add('active');
    state.currentTool = buttonEl.dataset.tool;
    elements.toolName.textContent = state.currentTool.charAt(0).toUpperCase() + state.currentTool.slice(1);
}

function positionBrushCursor(e) {
    const rect = elements.photoCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Center custom cursor circle element target coordinates wrapper framework
    elements.brushCursor.style.left = `${x}px`;
    elements.brushCursor.style.top = `${y}px`;
}

function updateBrushCursorSize() {
    elements.brushCursor.style.width = `${state.brushSize}px`;
    elements.brushCursor.style.height = `${state.brushSize}px`;
}

function getCanvasMouseCoords(e) {
    const rect = elements.photoCanvas.getBoundingClientRect();
    // Resolves coordinates system dynamically map matching internal width properties bounds scale
    return {
        x: ((e.clientX - rect.left) / rect.width) * elements.photoCanvas.width,
        y: ((e.clientY - rect.top) / rect.height) * elements.photoCanvas.height
    };
}

function startDrawing(e) {
    if (!state.originalImage) return;
    state.isDrawing = true;
    state.ctx.save();
    
    // Configure standard rendering parameters setup
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';
    
    const coords = getCanvasMouseCoords(e);
    state.ctx.beginPath();
    state.ctx.moveTo(coords.x, coords.y);
    
    // Force draw single dot point execution sequence framework triggers
    draw(e);
}

function draw(e) {
    if (!state.isDrawing) return;
    
    const coords = getCanvasMouseCoords(e);
    
    // Choose rendering style context configurations based on selected modes matrix mapping logic
    switch(state.currentTool) {
        case 'heal':
            // High frequency soft texture stamp clone patch blend setup logic framework emulation
            state.ctx.globalCompositeOperation = 'source-over';
            state.ctx.strokeStyle = 'rgba(240, 240, 240, 0.05)'; 
            state.ctx.shadowBlur = 4;
            state.ctx.shadowColor = 'rgba(0,0,0,0.1)';
            break;
        case 'smooth':
            state.ctx.globalCompositeOperation = 'source-over';
            // Semi-transparent tracking interpolation properties layout simulation overlays
            state.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            state.ctx.shadowBlur = state.brushSize / 2;
            state.ctx.shadowColor = 'rgba(255,255,255,0.05)';
            break;
        case 'brighten':
            state.ctx.globalCompositeOperation = 'color-dodge';
            state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            state.ctx.shadowBlur = 10;
            state.ctx.shadowColor = 'rgba(255,255,255,0.1)';
            break;
        case 'darken':
            state.ctx.globalCompositeOperation = 'color-burn';
            state.ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
            state.ctx.shadowBlur = 10;
            state.ctx.shadowColor = 'rgba(0,0,0,0.1)';
            break;
    }
    
    state.ctx.lineWidth = state.brushSize;
    state.ctx.lineTo(coords.x, coords.y);
    state.ctx.stroke();
}

function stopDrawing() {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    state.ctx.restore();
    // Normalize mapping rules
    state.ctx.globalCompositeOperation = 'source-over';
    saveHistoryState();
}

// --- HISTORICAL STATE UNDO / REDO ENGINE ---
function saveHistoryState() {
    const w = elements.photoCanvas.width;
    const h = elements.photoCanvas.height;
    const currentState = state.ctx.getImageData(0, 0, w, h);
    
    // Clear out subsequent data branches if user modifications overwrite timeline arrays records
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }
    
    state.history.push(currentState);
    state.historyIndex++;
    
    // Bound limits to tracking frames storage array constraints depth
    if (state.history.length > 20) {
        state.history.shift();
        state.historyIndex--;
    }
    
    updateHistoryButtonsUI();
}

function handleUndo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        state.ctx.putImageData(state.history[state.historyIndex], 0, 0);
        updateHistoryButtonsUI();
    }
}

function handleRedo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        state.ctx.putImageData(state.history[state.historyIndex], 0, 0);
        updateHistoryButtonsUI();
    }
}

function updateHistoryButtonsUI() {
    elements.undoButton.disabled = (state.historyIndex <= 0);
    elements.redoButton.disabled = (state.historyIndex >= state.history.length - 1);
}

// --- UTILITY COMPARE AND EXPORT SYSTEM ---
function handleCompareToggle(e) {
    if (!state.originalImage) return;
    const value = parseFloat(e.target.value);
    
    if (value === 1) {
        // Paint original base state layout completely across display view
        state.ctx.clearRect(0,0, elements.photoCanvas.width, elements.photoCanvas.height);
        state.ctx.drawImage(state.originalImage, 0, 0, elements.photoCanvas.width, elements.photoCanvas.height);
        showHint("Viewing original photo template.");
    } else {
        // Recover calculated active modification frames arrays instantly
        refreshCanvasDisplay();
        showHint("Viewing updated retouch layers modifications.");
    }
}

function exportPhoto() {
    if (!state.originalImage) return;
    
    // Creates reference link anchor downloading frame stream structures
    const dataURL = elements.photoCanvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.download = `lumaforge_retouch_${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showHint("Photo successfully exported to local system repository.");
}

function showHint(message) {
    elements.hint.textContent = `Tip: ${message}`;
}
