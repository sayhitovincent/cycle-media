class CyclingMediaGenerator {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.backgroundImage = null;
        this.currentGradient = null;
        this.uploadedImages = [];
        this.selectedImageIndex = -1;
        
        this.initializeElements();
        this.bindEvents();
        this.updateOpacityDisplay();
    }

    initializeElements() {
        this.elements = {
            uploadArea: document.getElementById('uploadArea'),
            imageInput: document.getElementById('imageInput'),
            titleText: document.getElementById('titleText'),
            distance: document.getElementById('distance'),
            time: document.getElementById('time'),
            elevation: document.getElementById('elevation'),
            textColor: document.getElementById('textColor'),
            opacity: document.getElementById('opacity'),
            generateBtn: document.getElementById('generateBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            previewPlaceholder: document.getElementById('previewPlaceholder'),
            sampleBgs: document.querySelectorAll('.sample-bg'),
            uploadedImages: document.getElementById('uploadedImages'),
            imageGallery: document.getElementById('imageGallery')
        };
    }

    bindEvents() {
        // Upload area events
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.imageInput.click();
        });

        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.style.background = 'rgba(102, 126, 234, 0.15)';
        });

        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleMultipleImageUpload(files);
            }
        });

        this.elements.imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleMultipleImageUpload(e.target.files);
            }
        });

        // Sample background selection
        this.elements.sampleBgs.forEach(bg => {
            bg.addEventListener('click', () => {
                this.selectSampleBackground(bg);
            });
        });

        // Form input events
        const inputs = ['titleText', 'distance', 'time', 'elevation', 'textColor'];
        inputs.forEach(inputId => {
            this.elements[inputId].addEventListener('input', () => {
                this.generatePreview();
            });
        });

        // Opacity slider
        this.elements.opacity.addEventListener('input', () => {
            this.updateOpacityDisplay();
            this.generatePreview();
        });

        // Buttons
        this.elements.generateBtn.addEventListener('click', () => {
            this.generatePreview();
        });

        this.elements.downloadBtn.addEventListener('click', () => {
            this.downloadImage();
        });
    }

    handleMultipleImageUpload(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert(`${file.name} is not a valid image file.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.uploadedImages.push({
                        image: img,
                        name: file.name,
                        dataUrl: e.target.result
                    });
                    this.updateImageGallery();
                    
                    // Select the first uploaded image
                    if (this.selectedImageIndex === -1) {
                        this.selectImage(this.uploadedImages.length - 1);
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    updateImageGallery() {
        if (this.uploadedImages.length === 0) {
            this.elements.uploadedImages.style.display = 'none';
            return;
        }

        this.elements.uploadedImages.style.display = 'block';
        this.elements.imageGallery.innerHTML = '';

        this.uploadedImages.forEach((imageData, index) => {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'gallery-image';
            imageDiv.style.backgroundImage = `url(${imageData.dataUrl})`;
            imageDiv.title = imageData.name;
            
            if (index === this.selectedImageIndex) {
                imageDiv.classList.add('active');
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeImage(index);
            };

            imageDiv.appendChild(removeBtn);
            imageDiv.onclick = () => this.selectImage(index);
            
            this.elements.imageGallery.appendChild(imageDiv);
        });
    }

    selectImage(index) {
        if (index >= 0 && index < this.uploadedImages.length) {
            this.selectedImageIndex = index;
            this.backgroundImage = this.uploadedImages[index].image;
            this.currentGradient = null;
            this.clearSampleSelection();
            this.updateImageGallery();
            this.generatePreview();
        }
    }

    removeImage(index) {
        this.uploadedImages.splice(index, 1);
        
        if (this.selectedImageIndex === index) {
            this.selectedImageIndex = -1;
            this.backgroundImage = null;
        } else if (this.selectedImageIndex > index) {
            this.selectedImageIndex--;
        }
        
        this.updateImageGallery();
        
        if (this.uploadedImages.length === 0) {
            this.generatePreview();
        } else if (this.selectedImageIndex === -1 && this.uploadedImages.length > 0) {
            this.selectImage(0);
        }
    }

    selectSampleBackground(bgElement) {
        // Clear previous selection
        this.clearSampleSelection();
        this.clearImageSelection();
        
        // Mark as active
        bgElement.classList.add('active');
        
        // Get gradient type
        const gradientType = bgElement.dataset.bg;
        this.setGradientBackground(gradientType);
        this.backgroundImage = null;
        this.generatePreview();
    }

    clearImageSelection() {
        this.selectedImageIndex = -1;
        this.updateImageGallery();
    }

    clearSampleSelection() {
        this.elements.sampleBgs.forEach(bg => {
            bg.classList.remove('active');
        });
    }

    setGradientBackground(type) {
        const gradients = {
            gradient1: ['#667eea', '#764ba2'],
            gradient2: ['#f093fb', '#f5576c'],
            gradient3: ['#4facfe', '#00f2fe'],
            gradient4: ['#43e97b', '#38f9d7']
        };
        
        this.currentGradient = gradients[type];
    }

    updateOpacityDisplay() {
        const opacityValue = this.elements.opacity.value;
        document.querySelector('.range-value').textContent = `${opacityValue}%`;
    }

    generatePreview() {
        this.showCanvas();
        this.clearCanvas();
        
        if (this.backgroundImage) {
            this.drawBackgroundImage();
        } else if (this.currentGradient) {
            this.drawGradientBackground();
        } else {
            this.drawDefaultBackground();
        }
        
        this.drawOverlay();
        this.drawContent();
        
        this.elements.downloadBtn.disabled = false;
    }

    showCanvas() {
        this.canvas.style.display = 'block';
        this.elements.previewPlaceholder.style.display = 'none';
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackgroundImage() {
        const { width, height } = this.canvas;
        const imgAspect = this.backgroundImage.width / this.backgroundImage.height;
        const canvasAspect = width / height;
        
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (imgAspect > canvasAspect) {
            drawHeight = height;
            drawWidth = height * imgAspect;
            offsetX = (width - drawWidth) / 2;
        } else {
            drawWidth = width;
            drawHeight = width / imgAspect;
            offsetY = (height - drawHeight) / 2;
        }
        
        this.ctx.drawImage(this.backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
    }

    drawGradientBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, this.currentGradient[0]);
        gradient.addColorStop(1, this.currentGradient[1]);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawDefaultBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawOverlay() {
        const opacity = parseInt(this.elements.opacity.value) / 100;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawContent() {
        const textColor = this.elements.textColor.value;
        
        // Draw title and stats with proper spacing
        this.drawTitleAndStats(textColor);
    }



    drawTitleAndStats(color) {
        this.ctx.fillStyle = color;
        this.ctx.textAlign = 'left';
        
        const margin = 50;
        const canvasHeight = this.canvas.height;
        const canvasWidth = this.canvas.width;
        
        // Get field values
        const title = this.elements.titleText.value;
        const elevation = this.elements.elevation.value;
        const time = this.elements.time.value;
        const distance = this.elements.distance.value;
        
        // Calculate available stats (non-empty fields)
        const availableStats = [];
        if (elevation) availableStats.push({ label: 'Elev Gain', value: elevation });
        if (time) availableStats.push({ label: 'Time', value: time });
        if (distance) availableStats.push({ label: 'Distance', value: distance });
        
        // Draw stats at bottom with flex layout
        let statsHeight = 0;
        if (availableStats.length > 0) {
            const statsBottomY = canvasHeight - margin;
            statsHeight = this.drawBottomLeftStats(availableStats, statsBottomY, margin, canvasWidth - (margin * 2));
        }
        
        // Draw title 60px above stats, bottom-left aligned
        if (title) {
            const titleBottomY = canvasHeight - margin - statsHeight - 60;
            this.drawBottomLeftTitle(title, titleBottomY, margin, canvasWidth - (margin * 2));
        }
    }

    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = this.ctx.measureText(currentLine + ' ' + word).width;
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    drawBottomLeftStats(stats, bottomY, startX, maxWidth) {
        // Set base font sizes
        const labelFontSize = 18;
        const valueFontSize = 36;
        const horizontalGap = 40;
        const verticalGap = 40;
        const labelValueGap = 12;
        
        // Calculate stat dimensions and create flex layout
        let currentY = bottomY;
        let currentX = startX;
        let maxHeightUsed = 0;
        let currentLineHeight = 0;
        let currentLineWidth = 0;
        
        for (let i = 0; i < stats.length; i++) {
            const stat = stats[i];
            
            // Calculate stat dimensions
            this.ctx.font = `${labelFontSize}px Inter, sans-serif`;
            const labelWidth = this.ctx.measureText(stat.label).width;
            
            this.ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
            const valueWidth = this.ctx.measureText(stat.value).width;
            
            const statWidth = Math.max(labelWidth, valueWidth);
            const statHeight = labelFontSize + labelValueGap + valueFontSize;
            
            // Check if stat fits on current line
            const gapWidth = currentLineWidth > 0 ? horizontalGap : 0;
            
            if (currentLineWidth + gapWidth + statWidth > maxWidth && currentLineWidth > 0) {
                // Move to next line
                currentY -= (currentLineHeight + verticalGap);
                maxHeightUsed += (currentLineHeight + verticalGap);
                currentX = startX;
                currentLineWidth = 0;
                currentLineHeight = 0;
            }
            
            // Draw stat at current position
            // Draw label
            this.ctx.font = `${labelFontSize}px Inter, sans-serif`;
            this.ctx.fillText(stat.label, currentX, currentY - valueFontSize - labelValueGap);
            
            // Draw value
            this.ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
            this.ctx.fillText(stat.value, currentX, currentY);
            
            // Update position for next stat
            currentX += statWidth + horizontalGap;
            currentLineWidth += (currentLineWidth > 0 ? horizontalGap : 0) + statWidth;
            currentLineHeight = Math.max(currentLineHeight, statHeight);
        }
        
        // Add the height of the last line
        maxHeightUsed += currentLineHeight;
        
        return maxHeightUsed;
    }

    drawBottomLeftTitle(title, bottomY, startX, maxWidth) {
        // Adaptive font sizing for title
        let fontSize = 48;
        let lines = [];
        
        do {
            this.ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            lines = this.wrapText(title, maxWidth);
            fontSize -= 2;
        } while (lines.length > 3 && fontSize > 20); // Max 3 lines, min 20px
        
        // Draw title lines from bottom up
        const lineHeight = fontSize + 8;
        lines.forEach((line, index) => {
            const y = bottomY - ((lines.length - 1 - index) * lineHeight);
            this.ctx.fillText(line, startX, y);
        });
    }

    downloadImage() {
        const link = document.createElement('a');
        link.download = `cycling-post-${Date.now()}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CyclingMediaGenerator();
}); 