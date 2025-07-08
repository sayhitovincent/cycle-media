// Toast Notification System
class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        this.container = document.querySelector('.toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', title = null, duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSymbols = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };

        const defaultTitles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };

        const toastTitle = title || defaultTitles[type];
        const iconSymbol = iconSymbols[type] || 'i';

        toast.innerHTML = `
            <div class="toast-icon">${iconSymbol}</div>
            <div class="toast-content">
                <div class="toast-title">${toastTitle}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.hide(toast));

        // Add to container
        this.container.appendChild(toast);

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => this.hide(toast), duration);
        }

        return toast;
    }

    hide(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    success(message, title = null, duration = 4000) {
        return this.show(message, 'success', title, duration);
    }

    error(message, title = null, duration = 6000) {
        return this.show(message, 'error', title, duration);
    }

    warning(message, title = null, duration = 5000) {
        return this.show(message, 'warning', title, duration);
    }

    info(message, title = null, duration = 4000) {
        return this.show(message, 'info', title, duration);
    }
}

// Create global toast instance
window.toast = new ToastManager();

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
        this.draggedIndex = null;
        this.squareSliderIndex = 0;
        
        // Individual image positioning for each format
        this.imagePositions = {
            square: [], // Array of positions for each image in square slider
            portrait: { offsetX: 0, offsetY: 0, scale: 1 },
            landscape: { offsetX: 0, offsetY: 0, scale: 1 },
            story: { offsetX: 0, offsetY: 0, scale: 1 },
            reel: { offsetX: 0, offsetY: 0, scale: 1 }
        };
        
        this.initializeElements();
        this.initializeCanvases();
        this.bindEvents();
        this.updatePositionControls();
        this.updateSquareSlider();
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
                this.resetImagePositions();
                this.updateImageGallery();
                this.updatePositionControls();
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

        // Image position controls (using event delegation)
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('position-control')) {
                const format = e.target.dataset.format;
                const controlType = e.target.dataset.control;
                if (format && controlType) {
                    this.updateImagePosition(format, controlType, parseFloat(e.target.value));
                }
            }
        });

        // Instagram slider controls
        document.addEventListener('click', (e) => {
            if (e.target.id === 'square-slider-prev' || e.target.closest('#square-slider-prev')) {
                this.prevSquareSlide();
            } else if (e.target.id === 'square-slider-next' || e.target.closest('#square-slider-next')) {
                this.nextSquareSlide();
            } else if (e.target.classList.contains('slider-dot')) {
                const dotIndex = parseInt(e.target.dataset.index);
                this.goToSquareSlide(dotIndex);
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
            const itemContainer = document.createElement('div');
            itemContainer.classList.add('image-gallery-item');
            itemContainer.draggable = true;
            itemContainer.dataset.index = index;
            
            const imgElement = document.createElement('img');
            imgElement.src = img.src;
            imgElement.classList.add('gallery-image');
            if (index === this.selectedImageIndex) {
                imgElement.classList.add('selected');
            }
            imgElement.addEventListener('click', () => this.selectImage(index));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('image-delete-btn');
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete image';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteImage(index);
            });
            
            const dragHandle = document.createElement('div');
            dragHandle.classList.add('drag-handle');
            dragHandle.innerHTML = '⋮⋮';
            dragHandle.title = 'Drag to reorder';
            
            itemContainer.appendChild(imgElement);
            itemContainer.appendChild(deleteBtn);
            itemContainer.appendChild(dragHandle);
            
            // Add drag and drop event listeners
            itemContainer.addEventListener('dragstart', (e) => this.handleDragStart(e));
            itemContainer.addEventListener('dragover', (e) => this.handleDragOver(e));
            itemContainer.addEventListener('drop', (e) => this.handleDrop(e));
            itemContainer.addEventListener('dragend', (e) => this.handleDragEnd(e));
            
            gallery.appendChild(itemContainer);
        });
    }

    selectImage(index) {
        this.selectedImageIndex = index;
        this.selectedBackground = null;
        document.querySelectorAll('.sample-bg').forEach(bg => bg.classList.remove('selected'));
        this.resetImagePositions();
        this.updateImageGallery();
        this.updatePositionControls();
        this.updateSquareSlider();
        this.generateAllPreviews();
    }

    deleteImage(index) {
        if (index >= 0 && index < this.uploadedImages.length) {
            this.uploadedImages.splice(index, 1);
            
            // Remove corresponding position settings for square format
            if (this.imagePositions.square.length > index) {
                this.imagePositions.square.splice(index, 1);
            }
            
            // Update selected index if necessary
            if (this.selectedImageIndex === index) {
                this.selectedImageIndex = -1;
                this.selectedBackground = 'gradient-1'; // Default to first gradient
                document.querySelectorAll('.sample-bg')[0].classList.add('selected');
            } else if (this.selectedImageIndex > index) {
                this.selectedImageIndex--;
            }
            
            // Update square slider index if necessary
            if (this.squareSliderIndex >= this.uploadedImages.length) {
                this.squareSliderIndex = Math.max(0, this.uploadedImages.length - 1);
            }
            
            this.resetImagePositions();
            this.updateImageGallery();
            this.updatePositionControls();
            this.updateSquareSlider();
            this.generateAllPreviews();
            
            window.toast.success('Image deleted successfully');
        }
    }

    handleDragStart(e) {
        this.draggedIndex = parseInt(e.target.dataset.index);
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e) {
        e.preventDefault();
        const targetIndex = parseInt(e.target.closest('.image-gallery-item').dataset.index);
        
        if (this.draggedIndex !== targetIndex) {
            this.reorderImages(this.draggedIndex, targetIndex);
        }
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedIndex = null;
    }

    reorderImages(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        // Move the image in the array
        const movedImage = this.uploadedImages.splice(fromIndex, 1)[0];
        this.uploadedImages.splice(toIndex, 0, movedImage);
        
        // Move the corresponding position settings for square format
        if (this.imagePositions.square.length > fromIndex) {
            const movedPosition = this.imagePositions.square.splice(fromIndex, 1)[0];
            this.imagePositions.square.splice(toIndex, 0, movedPosition);
        }
        
        // Update selected index if necessary
        if (this.selectedImageIndex === fromIndex) {
            this.selectedImageIndex = toIndex;
        } else if (this.selectedImageIndex > fromIndex && this.selectedImageIndex <= toIndex) {
            this.selectedImageIndex--;
        } else if (this.selectedImageIndex < fromIndex && this.selectedImageIndex >= toIndex) {
            this.selectedImageIndex++;
        }
        
        // Update square slider index if necessary
        if (this.squareSliderIndex === fromIndex) {
            this.squareSliderIndex = toIndex;
        } else if (this.squareSliderIndex > fromIndex && this.squareSliderIndex <= toIndex) {
            this.squareSliderIndex--;
        } else if (this.squareSliderIndex < fromIndex && this.squareSliderIndex >= toIndex) {
            this.squareSliderIndex++;
        }
        
        this.updateImageGallery();
        this.updateSquareSlider();
        this.updatePositionControls(); // Update position controls for potentially new current image
        this.generateAllPreviews();
        
        window.toast.success('Images reordered successfully');
    }

    // Instagram Slider functionality for Square format
    updateSquareSlider() {
        const sliderControls = document.getElementById('square-slider-controls');
        const dotsContainer = document.getElementById('square-slider-dots');
        
        if (this.uploadedImages.length <= 1) {
            sliderControls.classList.add('hidden');
            return;
        }
        
        sliderControls.classList.remove('hidden');
        
        // Ensure we have position settings for all images
        while (this.imagePositions.square.length < this.uploadedImages.length) {
            this.imagePositions.square.push({ offsetX: 0, offsetY: 0, scale: 1 });
        }
        
        // Remove excess position settings if images were deleted
        if (this.imagePositions.square.length > this.uploadedImages.length) {
            this.imagePositions.square = this.imagePositions.square.slice(0, this.uploadedImages.length);
        }
        
        // Update dots
        dotsContainer.innerHTML = '';
        this.uploadedImages.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.classList.add('slider-dot');
            dot.dataset.index = index;
            if (index === this.squareSliderIndex) {
                dot.classList.add('active');
            }
            dotsContainer.appendChild(dot);
        });
        
        // Ensure slider index is within bounds
        if (this.squareSliderIndex >= this.uploadedImages.length) {
            this.squareSliderIndex = this.uploadedImages.length - 1;
        }
        if (this.squareSliderIndex < 0) {
            this.squareSliderIndex = 0;
        }
    }

    prevSquareSlide() {
        if (this.uploadedImages.length <= 1) return;
        
        this.squareSliderIndex = this.squareSliderIndex > 0 
            ? this.squareSliderIndex - 1 
            : this.uploadedImages.length - 1;
        
        this.updateSquareSlider();
        this.updatePositionControls(); // Update position controls for new image
        this.generatePreview('square');
    }

    nextSquareSlide() {
        if (this.uploadedImages.length <= 1) return;
        
        this.squareSliderIndex = this.squareSliderIndex < this.uploadedImages.length - 1 
            ? this.squareSliderIndex + 1 
            : 0;
        
        this.updateSquareSlider();
        this.updatePositionControls(); // Update position controls for new image
        this.generatePreview('square');
    }

    goToSquareSlide(index) {
        if (index >= 0 && index < this.uploadedImages.length) {
            this.squareSliderIndex = index;
            this.updateSquareSlider();
            this.updatePositionControls(); // Update position controls for new image
            this.generatePreview('square');
        }
    }

    updateImagePosition(format, controlType, value) {
        if (format === 'square') {
            // For square format, update the current slider image's position
            if (this.imagePositions.square[this.squareSliderIndex]) {
                this.imagePositions.square[this.squareSliderIndex][controlType] = value;
                this.generatePreview(format);
            }
        } else if (this.imagePositions[format]) {
            this.imagePositions[format][controlType] = value;
            this.generatePreview(format);
        }
    }

    resetImagePositions() {
        // Reset all image positions to default values
        Object.keys(this.imagePositions).forEach(format => {
            if (format === 'square') {
                // For square, reset all image positions in the array
                this.imagePositions.square = this.uploadedImages.map(() => ({ offsetX: 0, offsetY: 0, scale: 1 }));
            } else {
                this.imagePositions[format] = { offsetX: 0, offsetY: 0, scale: 1 };
            }
        });
    }

    updatePositionControls() {
        const hasImage = this.selectedImageIndex >= 0 || this.uploadedImages.length > 0;
        document.querySelectorAll('.position-controls').forEach(controls => {
            controls.style.display = hasImage ? 'flex' : 'none';
        });
        
        // Reset all position controls to current values
        if (hasImage) {
            Object.keys(this.imagePositions).forEach(format => {
                let position;
                
                if (format === 'square') {
                    // For square format, use the current slider image's position
                    position = this.imagePositions.square[this.squareSliderIndex] || { offsetX: 0, offsetY: 0, scale: 1 };
                } else {
                    position = this.imagePositions[format];
                }
                
                const offsetXControl = document.querySelector(`[data-format="${format}"][data-control="offsetX"]`);
                const offsetYControl = document.querySelector(`[data-format="${format}"][data-control="offsetY"]`);
                const scaleControl = document.querySelector(`[data-format="${format}"][data-control="scale"]`);
                
                if (offsetXControl) offsetXControl.value = position.offsetX;
                if (offsetYControl) offsetYControl.value = position.offsetY;
                if (scaleControl) scaleControl.value = position.scale;
            });
        }
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
        this.drawBackground(ctx, canvas.width, canvas.height, formatKey);
        
        // Draw overlay (only on first image for square format)
        if (formatKey !== 'square' || this.squareSliderIndex === 0) {
            this.drawOverlay(ctx, canvas.width, canvas.height);
        }
        
        // Draw content
        this.drawContent(ctx, canvas.width, canvas.height, formatKey);
    }

    drawBackground(ctx, width, height, formatKey) {
        // Use slider index for square format, selectedImageIndex for others
        let imageIndex = formatKey === 'square' ? this.squareSliderIndex : this.selectedImageIndex;
        
        if (imageIndex >= 0 && this.uploadedImages[imageIndex]) {
            this.drawImageBackground(ctx, width, height, this.uploadedImages[imageIndex], formatKey);
        } else if (this.selectedBackground) {
            this.drawGradientBackground(ctx, width, height, this.selectedBackground);
        } else {
            this.drawDefaultBackground(ctx, width, height);
        }
    }

    drawImageBackground(ctx, width, height, img, formatKey) {
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        
        let position;
        if (formatKey === 'square') {
            // For square format, use the current slider image's position
            position = this.imagePositions.square[this.squareSliderIndex] || { offsetX: 0, offsetY: 0, scale: 1 };
        } else {
            position = this.imagePositions[formatKey];
        }
        
        let baseDrawWidth, baseDrawHeight;
        
        // Calculate base dimensions to cover the canvas
        if (imgAspect > canvasAspect) {
            baseDrawHeight = height;
            baseDrawWidth = height * imgAspect;
        } else {
            baseDrawWidth = width;
            baseDrawHeight = width / imgAspect;
        }
        
        // Apply scale
        const drawWidth = baseDrawWidth * position.scale;
        const drawHeight = baseDrawHeight * position.scale;
        
        // Calculate base centering offset
        const baseCenterX = (width - drawWidth) / 2;
        const baseCenterY = (height - drawHeight) / 2;
        
        // Apply user offset (convert from percentage to pixels)
        const offsetX = baseCenterX + (position.offsetX / 100) * width;
        const offsetY = baseCenterY + (position.offsetY / 100) * height;
        
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
        // For square format, only draw title/stats on the first image (index 0)
        if (formatKey === 'square' && this.squareSliderIndex !== 0) {
            return; // Skip drawing content for non-first images in square slideshow
        }
        
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
        
        // Draw title above stats, bottom-left aligned - scale gap for non-square formats
        if (title) {
            let titleGap;
            if (formatKey === 'square') {
                titleGap = Math.max(66, height * 0.033); // increased by 10%
            } else if (formatKey === 'landscape') {
                titleGap = Math.max(91, height * 0.046); // increased by 30%
            } else {
                titleGap = Math.max(104, height * 0.052); // increased by 30% for portrait, story, reel
            }
            
            const titleBottomY = height - margin - statsHeight - titleGap;
            this.drawBottomLeftTitle(ctx, title, titleBottomY, margin, width - (margin * 2), formatKey);
        }
    }

    drawBottomLeftStats(ctx, stats, bottomY, startX, maxWidth, formatKey) {
        // Scale font sizes based on format - increase sizes for all except square
        let baseScale;
        if (formatKey === 'square') {
            baseScale = 1.1; // increased by 10%
        } else if (formatKey === 'landscape') {
            baseScale = 1.859; // 1.43 * 1.3 = increased by another 30%
        } else {
            baseScale = 2.197; // 1.69 * 1.3 = increased by another 30% (portrait, story, reel)
        }
        
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
        // Scale font size based on format - increase sizes for all except square
        let baseScale;
        if (formatKey === 'square') {
            baseScale = 1.1; // increased by 10%
        } else if (formatKey === 'landscape') {
            baseScale = 1.43; // 1.1 * 1.3 = increased by 30%
        } else {
            baseScale = 1.69; // 1.3 * 1.3 = increased by 30% (portrait, story, reel)
        }
        
        let fontSize = Math.floor(48 * baseScale);
        let lines = [];
        
        do {
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            lines = this.wrapText(ctx, title, maxWidth);
            fontSize -= 2;
        } while (lines.length > 3 && fontSize > 20);
        
        // Draw title lines from bottom up - scale line height for better spacing
        const lineHeightGap = formatKey === 'square' ? 8 : Math.floor(12 * baseScale);
        const lineHeight = fontSize + lineHeightGap;
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
    window.mediaGenerator = new InstagramMediaGenerator();
});

// Add Strava integration event listeners
window.addEventListener('stravaActivityImported', (event) => {
    const { activity, statsData } = event.detail;
    
    console.log('Activity imported:', activity);
    console.log('Stats data:', statsData);
    
    // Update form fields with activity data
    if (window.mediaGenerator) {
        window.mediaGenerator.elements.titleText.value = statsData.title;
        window.mediaGenerator.elements.distance.value = statsData.distance;
        window.mediaGenerator.elements.time.value = statsData.time;
        window.mediaGenerator.elements.elevation.value = statsData.elevation;
        
        // Regenerate previews with new data
        window.mediaGenerator.generateAllPreviews();
    }
});

window.addEventListener('stravaPhotoAddedToList', (event) => {
    const { file, url, setAsBackground } = event.detail;
    
    console.log('Photo added to list:', { file, url, setAsBackground });
    
    // Add the imported photo to the existing media generator
    if (window.mediaGenerator) {
        // Convert file to image and add to uploaded images
        const img = new Image();
        img.onload = () => {
            window.mediaGenerator.uploadedImages.push(img);
            window.mediaGenerator.updateImageGallery();
            window.mediaGenerator.updateSquareSlider();
            
            // If this should be set as background, select it
            if (setAsBackground) {
                window.mediaGenerator.selectImage(window.mediaGenerator.uploadedImages.length - 1);
            }
        };
        img.src = URL.createObjectURL(file);
    }
});

window.addEventListener('stravaPhotoImported', (event) => {
    const { file, url } = event.detail;
    
    console.log('Photo imported:', { file, url });
    
         // Add the imported photo to the existing media generator
     if (window.mediaGenerator) {
         // Convert file to image and add to uploaded images
         const img = new Image();
         img.onload = () => {
             window.mediaGenerator.uploadedImages.push(img);
             window.mediaGenerator.updateImageGallery();
             window.mediaGenerator.updateSquareSlider();
             // Auto-select the imported image
             window.mediaGenerator.selectImage(window.mediaGenerator.uploadedImages.length - 1);
         };
         img.src = URL.createObjectURL(file);
     } else {
         // Fallback: trigger file input change event
         const fileInput = document.querySelector('#bg-upload');
         if (fileInput) {
             // Create a new FileList with the imported file
             const dataTransfer = new DataTransfer();
             dataTransfer.items.add(file);
             fileInput.files = dataTransfer.files;
             
             // Trigger change event
             const changeEvent = new Event('change', { bubbles: true });
             fileInput.dispatchEvent(changeEvent);
         }
     }
}); 