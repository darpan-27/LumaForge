const canvas = document.getElementById("photoCanvas");
const ctx = canvas.getContext("2d");
let isImageLoaded = false;
let baseImageData = null;

// [Existing Event Listeners for image loading, brush, etc. here...]

function applyPassportBackground(color) {
    if (!isImageLoaded) return;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = (color === 'blue') ? '#4a90e2' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function cropToPassport() {
    if (!isImageLoaded) return;
    const ratio = 3.5 / 4.5;
    const newWidth = canvas.height * ratio;
    const offsetX = (canvas.width - newWidth) / 2;
    const croppedData = ctx.getImageData(offsetX, 0, newWidth, canvas.height);
    canvas.width = newWidth; canvas.height = canvas.height;
    ctx.putImageData(croppedData, 0, 0);
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function downloadPrintSheet() {
    if (!isImageLoaded) return;
    const printCanvas = document.createElement('canvas');
    printCanvas.width = 1200; printCanvas.height = 1800;
    const pCtx = printCanvas.getContext('2d');
    pCtx.fillStyle = "#ffffff"; pCtx.fillRect(0, 0, printCanvas.width, printCanvas.height);
    for(let i = 0; i < 6; i++) {
        pCtx.drawImage(canvas, (i % 2) * 600 + 50, Math.floor(i / 2) * 600 + 50, 500, 650);
    }
    const link = document.createElement("a");
    link.download = "Passport_Sheet.jpg";
    link.href = printCanvas.toDataURL("image/jpeg");
    link.click();
}
