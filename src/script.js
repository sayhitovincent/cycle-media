class InstagramMediaGenerator {
    constructor() {
        this.formats = {
            square: { width: 1080, height: 1080, canvas: null, ctx: null },
            portrait: { width: 1080, height: 1350, canvas: null, ctx: null },
            landscape: { width: 1080, height: 566, canvas: null, ctx: null },
            story: { width: 1080, height: 1920, canvas: null, ctx: null },
            reel: { width: 1080, height: 1920, canvas: null, ctx: null }
        };
        
        this.selectedBackground = null;
        this.uploadedImages = [];
        this.selectedImageIndex = -1;
        
        this.initializeElements();
        this.initializeCanvases();
        this.bindEvents();
        this.generateAllPreviews();
    }

    initializeElements() {
        this.elements = {
            titleText: document.getElementById('title-text'),
            distance: document.getElementById('distance'),
            time: document.getElementById('time'),
            elevation: document.getElementById('elevation'),
            bgUpload: document.getElementById('bg-upload'),
            imageGallery: document.getElementById('image-gallery'),
            opacity: document.getElementById('opacity'),
            opacityValue: document.getElementById('opacity-value'),
            textColor: document.getElementById('text-color')
        };
    }

    initializeCanvases() {
        Object.keys(this.formats).forEach(formatKey => {
            const format = this.formats[formatKey];
            format.canvas = document.getElementById(`${formatKey}-canvas`);
            format.ctx = format.canvas.getContext('2d');
            format.ctx.imageSmoothingEnabled = true;
            format.ctx.imageSmoothingQuality = 'high';
        });
    }

    bindEvents() {
        // Input events
        this.elements.titleText.addEventListener('input', () => this.generateAllPreviews());
        this.elements.distance.addEventListener('input', () => this.generateAllPreviews());
        this.elements.time.addEventListener('input', () => this.generateAllPreviews());
        this.elements.elevation.addEventListener('input', () => this.generateAllPreviews());
        this.elements.textColor.addEventListener('change', () => this.generateAllPreviews());
        
        // Opacity slider
        this.elements.opacity.addEventListener('input', () => {
            this.elements.opacityValue.textContent = `${this.elements.opacity.value}%`;
            this.generateAllPreviews();
        });

        // File upload
        this.elements.bgUpload.addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files);
        });

        // Sample gradient backgrounds
        document.querySelectorAll('.sample-bg').forEach(bg => {
            bg.addEventListener('click', () => {
                document.querySelectorAll('.sample-bg').forEach(b => b.classList.remove('selected'));
                bg.classList.add('selected');
                this.selectedBackground = bg.dataset.gradient;
                this.selectedImageIndex = -1;
                this.updateImageGallery();
                this.generateAllPreviews();
            });
        });

        // Download buttons (using event delegation for card-based buttons)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('download-btn')) {
                const format = e.target.dataset.format;
                if (format) {
                    this.downloadFormat(format);
                }
            }
        });
    }

    handleImageUpload(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        this.uploadedImages.push(img);
                        this.updateImageGallery();
                        if (this.uploadedImages.length === 1) {
                            this.selectImage(0);
                        }
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    updateImageGallery() {
        const gallery = this.elements.imageGallery;
        gallery.innerHTML = '';
        
        this.uploadedImages.forEach((img, index) => {
            const imgElement = document.createElement('img');
            imgElement.src = img.src;
            imgElement.classList.add('gallery-image');
            if (index === this.selectedImageIndex) {
                imgElement.classList.add('selected');
            }
            imgElement.addEventListener('click', () => this.selectImage(index));
            gallery.appendChild(imgElement);
        });
    }

    selectImage(index) {
        this.selectedImageIndex = index;
        this.selectedBackground = null;
        document.querySelectorAll('.sample-bg').forEach(bg => bg.classList.remove('selected'));
        this.updateImageGallery();
        this.generateAllPreviews();
    }

    generateAllPreviews() {
        Object.keys(this.formats).forEach(formatKey => {
            this.generatePreview(formatKey);
        });
    }

    generatePreview(formatKey) {
        const format = this.formats[formatKey];
        const ctx = format.ctx;
        const canvas = format.canvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        this.drawBackground(ctx, canvas.width, canvas.height);
        
        // Draw overlay
        this.drawOverlay(ctx, canvas.width, canvas.height);
        
        // Draw content
        this.drawContent(ctx, canvas.width, canvas.height, formatKey);
    }

    drawBackground(ctx, width, height) {
        if (this.selectedImageIndex >= 0 && this.uploadedImages[this.selectedImageIndex]) {
            this.drawImageBackground(ctx, width, height, this.uploadedImages[this.selectedImageIndex]);
        } else if (this.selectedBackground) {
            this.drawGradientBackground(ctx, width, height, this.selectedBackground);
        } else {
            this.drawDefaultBackground(ctx, width, height);
        }
    }

    drawImageBackground(ctx, width, height, img) {
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > canvasAspect) {
            drawHeight = height;
            drawWidth = height * imgAspect;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
        } else {
            drawWidth = width;
            drawHeight = width / imgAspect;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
        }
        
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }

    drawGradientBackground(ctx, width, height, gradientType) {
        let gradient;
        
        switch (gradientType) {
            case 'gradient-1':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#667eea');
                gradient.addColorStop(1, '#764ba2');
                break;
            case 'gradient-2':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#f093fb');
                gradient.addColorStop(1, '#f5576c');
                break;
            case 'gradient-3':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#4facfe');
                gradient.addColorStop(1, '#00f2fe');
                break;
            default:
                gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#667eea');
                gradient.addColorStop(1, '#764ba2');
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    drawDefaultBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    drawOverlay(ctx, width, height) {
        const opacity = parseInt(this.elements.opacity.value) / 100;
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.fillRect(0, 0, width, height);
    }

    drawContent(ctx, width, height, formatKey) {
        const textColor = this.elements.textColor.value;
        
        // Get content
        const title = this.elements.titleText.value;
        const elevation = this.elements.elevation.value;
        const time = this.elements.time.value;
        const distance = this.elements.distance.value;
        
        // Calculate available stats
        const availableStats = [];
        if (elevation) availableStats.push({ label: 'Elev Gain', value: elevation });
        if (time) availableStats.push({ label: 'Time', value: time });
        if (distance) availableStats.push({ label: 'Distance', value: distance });
        
        // Draw standard content for all formats
        this.drawStandardContent(ctx, width, height, textColor, title, availableStats, formatKey);
    }



    drawStandardContent(ctx, width, height, color, title, availableStats, formatKey) {
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        
        // Scale margins based on canvas size
        const margin = Math.max(50, width * 0.05);
        
        // Draw stats at bottom with flex layout
        let statsHeight = 0;
        if (availableStats.length > 0) {
            const statsBottomY = height - margin;
            statsHeight = this.drawBottomLeftStats(ctx, availableStats, statsBottomY, margin, width - (margin * 2), formatKey);
        }
        
        // Draw title 60px above stats, bottom-left aligned
        if (title) {
            const titleBottomY = height - margin - statsHeight - Math.max(60, height * 0.03);
            this.drawBottomLeftTitle(ctx, title, titleBottomY, margin, width - (margin * 2), formatKey);
        }
    }

    drawBottomLeftStats(ctx, stats, bottomY, startX, maxWidth, formatKey) {
        // Scale font sizes based on format
        const baseScale = formatKey === 'landscape' ? 0.8 : 1;
        const labelFontSize = Math.floor(18 * baseScale);
        const valueFontSize = Math.floor(36 * baseScale);
        const horizontalGap = Math.floor(40 * baseScale);
        const verticalGap = Math.floor(40 * baseScale);
        const labelValueGap = Math.floor(12 * baseScale);
        
        let currentY = bottomY;
        let currentX = startX;
        let maxHeightUsed = 0;
        let currentLineHeight = 0;
        let currentLineWidth = 0;
        
        for (let i = 0; i < stats.length; i++) {
            const stat = stats[i];
            
            // Calculate stat dimensions
            ctx.font = `${labelFontSize}px Inter, sans-serif`;
            const labelWidth = ctx.measureText(stat.label).width;
            
            ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
            const valueWidth = ctx.measureText(stat.value).width;
            
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
            ctx.font = `${labelFontSize}px Inter, sans-serif`;
            ctx.fillText(stat.label, currentX, currentY - valueFontSize - labelValueGap);
            
            ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
            ctx.fillText(stat.value, currentX, currentY);
            
            // Update position for next stat
            currentX += statWidth + horizontalGap;
            currentLineWidth += (currentLineWidth > 0 ? horizontalGap : 0) + statWidth;
            currentLineHeight = Math.max(currentLineHeight, statHeight);
        }
        
        maxHeightUsed += currentLineHeight;
        return maxHeightUsed;
    }

    drawBottomLeftTitle(ctx, title, bottomY, startX, maxWidth, formatKey) {
        // Scale font size based on format
        const baseScale = formatKey === 'landscape' ? 0.7 : 1;
        let fontSize = Math.floor(48 * baseScale);
        let lines = [];
        
        do {
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            lines = this.wrapText(ctx, title, maxWidth);
            fontSize -= 2;
        } while (lines.length > 3 && fontSize > 20);
        
        // Draw title lines from bottom up
        const lineHeight = fontSize + 8;
        lines.forEach((line, index) => {
            const y = bottomY - ((lines.length - 1 - index) * lineHeight);
            ctx.fillText(line, startX, y);
        });
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
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

    downloadFormat(formatKey) {
        const format = this.formats[formatKey];
        const link = document.createElement('a');
        const formatName = formatKey.charAt(0).toUpperCase() + formatKey.slice(1);
        link.download = `instagram-${formatKey}-${Date.now()}.png`;
        link.href = format.canvas.toDataURL();
        link.click();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InstagramMediaGenerator();
}); 