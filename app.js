window.onload = function() {
    console.log("LumaForge Studio - Vignette & Compare Slider Active!");

    // ==========================================================================
    // 1. DOM ELEMENTS SELECTION
    // ==========================================================================
    const imageInput = document.getElementById('imageInput');
    const photoCanvas = document.getElementById('photoCanvas');
    const emptyState = document.getElementById('emptyState');
    const dropZone = document.getElementById('dropZone');
    const fileNameDisplay = document.getElementById('fileName');
    const imageMetaDisplay = document.getElementById('imageMeta');

    const autoEnhanceBtn = document.getElementById('autoEnhance');
    const beforeAfterBtn = document.getElementById('beforeAfter');
    const downloadButton = document.getElementById('downloadButton');
    const resetAdjustmentsBtn = document.getElementById('resetAdjustments');

    const brushSize = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    const brushStrength = document.getElementById('brushStrength');
    const brushStrengthValue = document.getElementById('brushStrengthValue');
    const compareSlider = document.getElementById('compareSlider');

    const ctx = photoCanvas.getContext('2d');
    
    let originalImage = null; 
    let activeTool = 'heal';   
    let isDrawing = false;     

    // ==========================================================================
    // 2. BRUSH SLIDERS TEXT UPDATE
    // ==========================================================================
    if (brushSize && brushSizeValue) {
        brushSize.addEventListener('input', (e) => { brushSizeValue.textContent = e.target.value; });
    }
    if (brushStrength && brushStrengthValue) {
        brushStrength.addEventListener('input', (e) => { brushStrengthValue.textContent = e.target.value; });
    }

    // ==========================================================================
    // 3. IMAGE UPLOAD & CANVAS INITIALIZATION
    // ==========================================================================
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (fileNameDisplay) fileNameDisplay.textContent = file.name;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                originalImage = img;
                
                if (imageMetaDisplay) imageMetaDisplay.textContent = `${img.width} × ${img.height} px`;
                if (emptyState) emptyState.style.display = 'none';
                
                if (autoEnhanceBtn) autoEnhanceBtn.disabled = false;
                if (beforeAfterBtn) beforeAfterBtn.disabled = false;
                if (downloadButton) downloadButton.disabled = false;
                if (compareSlider) compareSlider.disabled = false;

                // પ્રારંભિક સ્લાઇડર વેલ્યુ સેટ કરવી
                if (compareSlider) compareSlider.value = 100; 

                let maxWidth = dropZone ? dropZone.clientWidth - 40 : 600;
                let maxHeight = dropZone ? dropZone.clientHeight - 40 : 400;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    let ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                photoCanvas.width = width;
                photoCanvas.height = height;
                ctx.drawImage(originalImage, 0, 0, width, height);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // ==========================================================================
    // 4. RETOUCH BRUSH MOUSE LOGIC
    // ==========================================================================
    photoCanvas.addEventListener('mousedown', startDrawing);
    photoCanvas.addEventListener('mousemove', draw);
    photoCanvas.addEventListener('mouseup', stopDrawing);
    photoCanvas.addEventListener('mouseleave', stopDrawing);

    function startDrawing(e) {
        if (!originalImage) return;
        isDrawing = true;
        draw(e);
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }

    function draw(e) {
        if (!isDrawing || !originalImage) return;

        const rect = photoCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const size = parseInt(brushSize.value);
        const strength = parseInt(brushStrength.value) / 100;

        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (activeTool === 'heal' || activeTool === 'smooth') {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalAlpha = strength * 0.2;
            ctx.filter = activeTool === 'heal' ? 'blur(4px)' : 'blur(2px)';
            ctx.drawImage(photoCanvas, 0, 0);
            ctx.restore();
        } 
        else if (activeTool === 'brighten') {
            ctx.strokeStyle = `rgba(255, 255, 255, ${strength * 0.12})`;
            ctx.globalCompositeOperation = 'overlay';
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.globalCompositeOperation = 'source-over';
        } 
        else if (activeTool === 'darken') {
            ctx.strokeStyle = `rgba(0, 0, 0, ${strength * 0.12})`;
            ctx.globalCompositeOperation = 'multiply';
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // ==========================================================================
    // 5. ADJUSTMENTS SLIDERS, CSS FILTERS & VIGNETTE
    // ==========================================================================
    const adjustmentSliders = document.querySelectorAll('.adjustments input[type="range"]');
    adjustmentSliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const output = e.target.nextElementSibling;
            if (output) output.textContent = e.target.value;
            if (originalImage) applyFilters();
        });
    });

    function applyFilters() {
        if (!originalImage) return;

        const exposure = document.querySelector('[data-adjust="exposure"]')?.value || 0;
        const contrast = document.querySelector('[data-adjust="contrast"]')?.value || 0;
        const saturation = document.querySelector('[data-adjust="saturation"]')?.value || 0;
        const warmth = document.querySelector('[data-adjust="warmth"]')?.value || 0;
        const clarity = document.querySelector('[data-adjust="clarity"]')?.value || 0;
        const vignette = document.querySelector('[data-adjust="vignette"]')?.value || 0;

        ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
        
        const brightnessValue = 100 + parseInt(exposure);
        const contrastValue = 100 + parseInt(contrast);
        const saturateValue = 100 + parseInt(saturation);
        const sepiaValue = warmth > 0 ? warmth : 0;
        const blurValue = clarity < 0 ? Math.abs(clarity) / 10 : 0;

        // ૧. ફિલ્ટર્સ લગાડો
        ctx.filter = `
            brightness(${brightnessValue}%) 
            contrast(${contrastValue}%) 
            saturate(${saturateValue}%) 
            sepia(${sepiaValue}%)
            blur(${blurValue}px)
        `;
        
        ctx.drawImage(originalImage, 0, 0, photoCanvas.width, photoCanvas.height);
        ctx.filter = 'none'; // ફિલ્ટર રીસેટ

        // ૨. અસલી વિગ્નેટ (Vignette) ઇફેક્ટ ડ્રો કરવી
        if (parseInt(vignette) > 0) {
            const cx = photoCanvas.width / 2;
            const cy = photoCanvas.height / 2;
            // ફોટોના ખૂણા સુધી વ્યાપાર કરવા રેડિયસ ગણવી
            const r = Math.sqrt(cx * cx + cy * cy); 
            
            ctx.save();
            // રેડિયલ ગ્રેડિયન્ટથી બ્લેક શેડો બનાવવો
            const gradient = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
            const maxOpacity = (parseInt(vignette) / 100) * 0.85; // મહત્તમ ડાર્કનેસ કંટ્રોલ
            
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(0, 0, 0, ${maxOpacity})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
            ctx.restore();
        }
    }

    // ==========================================================================
    // 6. ORIGINAL TO EDITED (COMPARE) SLIDER LOGIC
    // ==========================================================================
    if (compareSlider) {
        compareSlider.addEventListener('input', function() {
            if (!originalImage) return;

            const splitRatio = parseInt(compareSlider.value) / 100;
            const splitWidth = photoCanvas.width * splitRatio;

            // ૧. આખું કેનવાસ સાફ કરીને એડિટ કરેલો ફોટો બનાવો
            applyFilters();
            
            // ૨. એડિટ કરેલા ફોટામાંથી અડધો ડેટા સાચવો
            const editedData = ctx.getImageData(0, 0, photoCanvas.width, photoCanvas.height);
            
            // ૩. કેનવાસ પર ઓરિજિનલ ફોટો ડ્રો કરો
            ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
            ctx.drawImage(originalImage, 0, 0, photoCanvas.width, photoCanvas.height);
            
            // ૪. સ્લાઇડર જેટલા ભાગમાં એડિટ કરેલો ફોટો પાછો સુપર-ઈમ્પોઝ (પેસ્ટ) કરો
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, splitWidth, photoCanvas.height);
            ctx.clip();
            ctx.putImageData(editedData, 0, 0);
            ctx.restore();
        });
    }

    // ==========================================================================
    // 7. SMART PRESETS MANAGEMENT
    // ==========================================================================
    const presetButtons = document.querySelectorAll('.preset-button');
    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!originalImage) return;
            const preset = button.getAttribute('data-preset');
            resetSliders();
            
            if (preset === 'clean') {
                setSlider('contrast', 15); setSlider('saturation', 10);
            } else if (preset === 'portrait') {
                setSlider('exposure', 10); setSlider('warmth', 15);
            } else if (preset === 'cinema') {
                setSlider('contrast', 25); setSlider('saturation', -15);
            } else if (preset === 'product') {
                setSlider('exposure', 15); setSlider('contrast', 20); setSlider('saturation', 20);
            }
            if (compareSlider) compareSlider.value = 100;
            applyFilters();
        });
    });

    function setSlider(name, val) {
        const slider = document.querySelector(`[data-adjust="${name}"]`);
        if (slider) {
            slider.value = val;
            if (slider.nextElementSibling) slider.nextElementSibling.textContent = val;
        }
    }

    if (autoEnhanceBtn) {
        autoEnhanceBtn.addEventListener('click', () => {
            if (!originalImage) return;
            resetSliders();
            setSlider('exposure', 8);
            setSlider('contrast', 12);
            setSlider('saturation', 10);
            if (compareSlider) compareSlider.value = 100;
            applyFilters();
        });
    }

    // ==========================================================================
    // 8. RESET, BEFORE/AFTER & EXPORT ACTIONS
    // ==========================================================================
    if (resetAdjustmentsBtn) {
        resetAdjustmentsBtn.addEventListener('click', () => {
            resetSliders();
            if (compareSlider) compareSlider.value = 100;
            if (originalImage) {
                ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
                ctx.drawImage(originalImage, 0, 0, photoCanvas.width, photoCanvas.height);
            }
        });
    }

    function resetSliders() {
        adjustmentSliders.forEach(slider => {
            slider.value = 0;
            if (slider.nextElementSibling) slider.nextElementSibling.textContent = "0";
        });
        const vigSlider = document.querySelector('[data-adjust="vignette"]');
        if (vigSlider) {
            vigSlider.value = 0;
            if (vigSlider.nextElementSibling) vigSlider.nextElementSibling.textContent = "0";
        }
        ctx.filter = 'none';
    }

    if (beforeAfterBtn) {
        beforeAfterBtn.addEventListener('mousedown', () => {
            if (!originalImage) return;
            ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
            ctx.drawImage(originalImage, 0, 0, photoCanvas.width, photoCanvas.height);
        });
        beforeAfterBtn.addEventListener('mouseup', () => {
            if (originalImage) applyFilters();
        });
    }

    if (downloadButton) {
        downloadButton.addEventListener('click', () => {
            if (!originalImage) return;
            // ડાઉનલોડ કરતા પહેલા આખો એડિટેડ ફોટો કન્ફર્મ કરવો
            applyFilters(); 
            const link = document.createElement('a');
            link.download = 'lumaforge-retouched.jpg';
            link.href = photoCanvas.toDataURL('image/jpeg', 0.95);
            link.click();
        });
    }

    // ==========================================================================
    // 9. TOOL SELECTION INTERFACE
    // ==========================================================================
    const toolButtons = document.querySelectorAll('.tool-row .icon-button');
    const toolNameDisplay = document.getElementById('toolName');
    
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeTool = button.getAttribute('data-tool');
            if (toolNameDisplay) toolNameDisplay.textContent = activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
        });
    });

    window.addEventListener('resize', () => {
        if (originalImage) applyFilters();
    });
};
