document.addEventListener("DOMContentLoaded", () => {
    // --- Elements ---
    const imageInput = document.getElementById("imageInput");
    const canvas = document.getElementById("photoCanvas");
    const ctx = canvas.getContext("2d");
    const canvasWrapper = document.querySelector(".canvas-wrapper");
    const emptyState = document.getElementById("emptyState");
    const fileNameDisplay = document.getElementById("fileName");
    const imageMetaDisplay = document.getElementById("imageMeta");
    
    // Controls
    const sliders = document.querySelectorAll('.adjustments input[type="range"]');
    const outputs = document.querySelectorAll('.adjustments output');
    const resetBtn = document.getElementById("resetAdjustments");
    const brushSizeSlider = document.getElementById("brushSize");
    const brushSizeOutput = document.getElementById("brushSizeValue");
    const brushButtons = document.querySelectorAll(".icon-button");
    const currentToolName = document.getElementById("toolName");
    const brushCursor = document.getElementById("brushCursor");
    const compareSlider = document.getElementById("compareSlider");
    const undoButton = document.getElementById("undoButton");
    const redoButton = document.getElementById("redoButton");
    const downloadButton = document.getElementById("downloadButton");
    const presetButtons = document.querySelectorAll(".preset-button");
    
    // AI Background
    const removeBgButton = document.getElementById("removeBgButton");
    const bgStatus = document.getElementById("bgStatus");
    let net = null; // BodyPix model

    // --- State Management ---
    let originalImage = new Image();
    let isImageLoaded = false;
    let baseImageData = null; // The image data containing brush edits / bg removal
    let displayImageData = null; // The final rendered image
    
    let activeTool = "heal";
    let brushSize = parseInt(brushSizeSlider.value);
    let isDrawing = false;
    
    // Undo / Redo stacks
    let history = [];
    let redoStack = [];
    
    // Adjustment State
    let adjustments = {
        exposure: 0, contrast: 0, saturation: 0, 
        warmth: 0, tint: 0, hue: 0, red: 0, green: 0, blue: 0
    };

    // --- Initialization & AI Loading ---
    async function initAI() {
        try {
            net = await bodyPix.load({
                architecture: 'MobileNetV1', outputStride: 16, multiplier: 0.75, quantBytes: 2
            });
            bgStatus.textContent = "Ready";
            bgStatus.className = "status-badge ready";
            if(isImageLoaded) removeBgButton.disabled = false;
        } catch (e) {
            bgStatus.textContent = "Error";
        }
    }
    initAI();

    // --- Image Loading ---
    imageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            originalImage.onload = () => {
                // Set canvas dimensions
                canvas.width = originalImage.width;
                canvas.height = originalImage.height;
                
                // Draw initial image and cache image data
                ctx.drawImage(originalImage, 0, 0);
                baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // UI Updates
                isImageLoaded = true;
                emptyState.style.display = "none";
                canvasWrapper.style.display = "block";
                fileNameDisplay.textContent = file.name;
                imageMetaDisplay.textContent = `${originalImage.width} × ${originalImage.height} px`;
                
                // Enable controls
                document.querySelectorAll("button").forEach(b => b.disabled = false);
                compareSlider.disabled = false;
                if(!net) removeBgButton.disabled = true;

                // Reset state
                history = [];
                redoStack = [];
                resetAdjustments();
                saveState();
                renderCanvas();
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // --- Render Pipeline ---
    // Applies filters and color shifts non-destructively to baseImageData
    function renderCanvas() {
        if (!isImageLoaded) return;

        // 1. Draw base imageData (brush strokes / BG removal) to canvas
        ctx.putImageData(baseImageData, 0, 0);
        
        // 2. We use an offscreen canvas to apply CSS filters easily
        const offCanvas = document.createElement("canvas");
        offCanvas.width = canvas.width; offCanvas.height = canvas.height;
        const offCtx = offCanvas.getContext("2d");
        offCtx.putImageData(ctx.getImageData(0,0,canvas.width,canvas.height), 0, 0);

        // Calculate filters
        const brightness = 100 + parseInt(adjustments.exposure);
        const contrast = 100 + parseInt(adjustments.contrast);
        const saturate = 100 + parseInt(adjustments.saturation);
        const hueRotate = parseInt(adjustments.hue);
        
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg)`;
        ctx.drawImage(offCanvas, 0, 0);
        ctx.filter = "none";

        // 3. Manual Pixel Adjustments (RGB Channels, Warmth, Tint)
        if (adjustments.red !== 0 || adjustments.green !== 0 || adjustments.blue !== 0 || adjustments.warmth !== 0 || adjustments.tint !== 0) {
            let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imgData.data;
            
            let rMod = parseInt(adjustments.red);
            let gMod = parseInt(adjustments.green);
            let bMod = parseInt(adjustments.blue);
            
            // Warmth: Add Red, Subtract Blue
            rMod += parseInt(adjustments.warmth);
            bMod -= parseInt(adjustments.warmth);
            
            // Tint: Add Green, Subtract Magenta(R+B)
            gMod += parseInt(adjustments.tint);
            rMod -= Math.floor(parseInt(adjustments.tint) / 2);
            bMod -= Math.floor(parseInt(adjustments.tint) / 2);

            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] === 0) continue; // skip transparent
                data[i]   = Math.min(255, Math.max(0, data[i] + rMod));     // R
                data[i+1] = Math.min(255, Math.max(0, data[i+1] + gMod)); // G
                data[i+2] = Math.min(255, Math.max(0, data[i+2] + bMod)); // B
            }
            ctx.putImageData(imgData, 0, 0);
        }

        // Save display data for compare slider logic
        displayImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    // --- Sliders & Adjustments ---
    sliders.forEach((slider, index) => {
        slider.addEventListener("input", (e) => {
            const key = e.target.dataset.adjust;
            adjustments[key] = e.target.value;
            outputs[index].textContent = e.target.value;
            
            // Re-render only if not using compare tool
            if(parseInt(compareSlider.value) === 0) {
                renderCanvas();
            }
        });
    });

    function resetAdjustments() {
        for (let key in adjustments) adjustments[key] = 0;
        sliders.forEach((slider, i) => {
            slider.value = 0;
            outputs[i].textContent = "0";
        });
        renderCanvas();
    }
    resetBtn.addEventListener("click", resetAdjustments);

    // --- History (Undo/Redo) ---
    function saveState() {
        if(!baseImageData) return;
        // Keep last 10 states to save memory
        if (history.length > 10) history.shift();
        
        // Save clone of baseImageData
        const clone = new ImageData(
            new Uint8ClampedArray(baseImageData.data),
            baseImageData.width, baseImageData.height
        );
        history.push(clone);
        redoStack = [];
        updateHistoryButtons();
    }

    function updateHistoryButtons() {
        undoButton.disabled = history.length <= 1;
        redoButton.disabled = redoStack.length === 0;
    }

    undoButton.addEventListener("click", () => {
        if (history.length > 1) {
            redoStack.push(history.pop());
            baseImageData = new ImageData(
                new Uint8ClampedArray(history[history.length - 1].data),
                canvas.width, canvas.height
            );
            updateHistoryButtons();
            renderCanvas();
        }
    });

    redoButton.addEventListener("click", () => {
        if (redoStack.length > 0) {
            const state = redoStack.pop();
            history.push(state);
            baseImageData = new ImageData(
                new Uint8ClampedArray(state.data),
                canvas.width, canvas.height
            );
            updateHistoryButtons();
            renderCanvas();
        }
    });

    // --- Brush Interactions ---
    brushButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            brushButtons.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeTool = e.target.dataset.tool;
            currentToolName.textContent = activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
        });
    });

    brushSizeSlider.addEventListener("input", (e) => {
        brushSize = parseInt(e.target.value);
        brushSizeOutput.textContent = brushSize;
        brushCursor.style.width = `${brushSize}px`;
        brushCursor.style.height = `${brushSize}px`;
    });

    // Cursor positioning
    canvas.addEventListener("mousemove", (e) => {
        if (!isImageLoaded) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);
        
        brushCursor.style.display = "block";
        brushCursor.style.left = `${x}px`;
        brushCursor.style.top = `${y}px`;

        if (isDrawing) {
            applyBrushStroke(x * scaleX, y * scaleY);
            renderCanvas();
        }
    });

    canvas.addEventListener("mouseleave", () => brushCursor.style.display = "none");
    
    canvas.addEventListener("mousedown", (e) => {
        if(!isImageLoaded || compareSlider.value == 1) return;
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        applyBrushStroke(x, y);
        renderCanvas();
    });

    window.addEventListener("mouseup", () => {
        if (isDrawing) {
            isDrawing = false;
            saveState(); // Save state after stroke completes
        }
    });

    // Localized Pixel Manipulation for Brush
    function applyBrushStroke(cx, cy) {
        const radius = brushSize / 2;
        const data = baseImageData.data;
        const w = canvas.width;
        const h = canvas.height;

        // Bounding box for optimization
        const minX = Math.max(0, Math.floor(cx - radius));
        const maxX = Math.min(w, Math.ceil(cx + radius));
        const minY = Math.max(0, Math.floor(cy - radius));
        const maxY = Math.min(h, Math.ceil(cy + radius));

        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const dx = x - cx; const dy = y - cy;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < radius) {
                    const idx = (y * w + x) * 4;
                    const falloff = 1 - (distance / radius); // Soft brush edge
                    const intensity = 0.1 * falloff; 

                    if (activeTool === "brighten") {
                        data[idx] = Math.min(255, data[idx] + 255 * intensity);
                        data[idx+1] = Math.min(255, data[idx+1] + 255 * intensity);
                        data[idx+2] = Math.min(255, data[idx+2] + 255 * intensity);
                    } else if (activeTool === "darken") {
                        data[idx] = Math.max(0, data[idx] - 255 * intensity);
                        data[idx+1] = Math.max(0, data[idx+1] - 255 * intensity);
                        data[idx+2] = Math.max(0, data[idx+2] - 255 * intensity);
                    } else if (activeTool === "smooth" || activeTool === "heal") {
                        // Very basic blur/heal approximation: blend with center pixel
                        const centerIdx = (Math.floor(cy)*w + Math.floor(cx))*4;
                        data[idx] = data[idx] * (1-intensity) + data[centerIdx] * intensity;
                        data[idx+1] = data[idx+1] * (1-intensity) + data[centerIdx+1] * intensity;
                        data[idx+2] = data[idx+2] * (1-intensity) + data[centerIdx+2] * intensity;
                    }
                }
            }
        }
    }

    // --- AI Background Removal ---
    removeBgButton.addEventListener("click", async () => {
        if (!net || !isImageLoaded) return;
        removeBgButton.disabled = true;
        removeBgButton.innerHTML = "Processing...";

        try {
            // Predict segmentation
            const segmentation = await net.segmentPerson(canvas);
            
            // Apply mask to baseImageData
            const data = baseImageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const isPerson = segmentation.data[i / 4];
                if (!isPerson) {
                    data[i + 3] = 0; // Set alpha to 0 for background
                }
            }
            
            saveState();
            renderCanvas();
        } catch (error) {
            console.error("BG Removal failed:", error);
        } finally {
            removeBgButton.disabled = false;
            removeBgButton.innerHTML = '<span class="icon">✂</span> Remove Background';
        }
    });

    // --- Presets ---
    const presets = {
        clean: { exposure: 10, contrast: 15, saturation: 5, warmth: 0, tint: 0, hue: 0, red: 0, green: 0, blue: 0 },
        portrait: { exposure: 5, contrast: 10, saturation: -5, warmth: 10, tint: 5, hue: 0, red: 5, green: 0, blue: 0 },
        cinema: { exposure: -5, contrast: 25, saturation: -15, warmth: -10, tint: 0, hue: 0, red: 0, green: 10, blue: 15 },
        vintage: { exposure: 0, contrast: -10, saturation: -30, warmth: 20, tint: 10, hue: -5, red: 10, green: 0, blue: -10 }
    };

    presetButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const p = presets[e.target.dataset.preset];
            if(p) {
                Object.keys(p).forEach(key => {
                    adjustments[key] = p[key];
                    const slider = document.querySelector(`[data-adjust="${key}"]`);
                    if(slider) {
                        slider.value = p[key];
                        slider.nextElementSibling.textContent = p[key];
                    }
                });
                renderCanvas();
            }
        });
    });

    // --- Compare Slider ---
    compareSlider.addEventListener("input", (e) => {
        if(!isImageLoaded) return;
        if(e.target.value === "1") {
            // Show Original
            ctx.drawImage(originalImage, 0, 0);
        } else {
            // Show Edited
            if(displayImageData) ctx.putImageData(displayImageData, 0, 0);
        }
    });

    // --- Export ---
    downloadButton.addEventListener("click", () => {
        if(!isImageLoaded) return;
        const link = document.createElement("a");
        link.download = `LumaForge_Edit_${fileNameDisplay.textContent}`;
        link.href = canvas.toDataURL("image/jpeg", 0.9);
        link.click();
    });
});
