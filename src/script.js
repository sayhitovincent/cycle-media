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
        this.imageHashes = []; // Track image hashes for duplicate detection
        this.selectedImageIndex = -1;
        this.draggedIndex = null;
        this.squareSliderIndex = 0;
        this.currentActivity = null; // Store current Strava activity for route overlay
        this.activityStreams = null; // Store detailed GPS data for stops detection
        this.isDrawingRoute = false; // Prevent concurrent route drawing
        
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
            routeOpacity: document.getElementById('route-opacity'),
            routeOpacityValue: document.getElementById('route-opacity-value'),
            textColor: document.getElementById('text-color'),
            routeTextColor: document.getElementById('route-text-color'),
            backgroundColor: document.getElementById('background-color'),
            routeLoadingOverlay: document.getElementById('route-loading-overlay')
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
        this.elements.backgroundColor.addEventListener('change', () => this.generateAllPreviews());
        
        // Opacity slider
        this.elements.opacity.addEventListener('input', () => {
            this.elements.opacityValue.textContent = `${this.elements.opacity.value}%`;
            this.generateAllPreviews();
        });

        // Route opacity slider
        this.elements.routeOpacity.addEventListener('input', () => {
            this.elements.routeOpacityValue.textContent = `${this.elements.routeOpacity.value}%`;
            this.generateAllPreviews();
        });

        // Route text color
        this.elements.routeTextColor.addEventListener('change', () => this.generateAllPreviews());

        // File upload
        this.elements.bgUpload.addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files);
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

    /**
     * Generate a simple hash for an image to detect duplicates
     * Uses canvas to sample pixel data and create a fingerprint
     */
    generateImageHash(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Use a small sample size for performance
        const sampleSize = 32;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        
        // Draw scaled-down image
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        
        // Get image data and create simple hash
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;
        
        let hash = 0;
        for (let i = 0; i < data.length; i += 4) {
            // Sample RGB values (skip alpha)
            const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            hash = ((hash << 5) - hash + rgb) & 0xffffffff;
        }
        
        return hash.toString(36);
    }

    /**
     * Check if an image is a duplicate based on its hash
     */
    isDuplicateImage(img) {
        const hash = this.generateImageHash(img);
        return this.imageHashes.includes(hash);
    }

    /**
     * Add an image to the collection with duplicate checking
     */
    addImageIfUnique(img, showSuccessMessage = true) {
        if (this.isDuplicateImage(img)) {
            window.toast.warning('Duplicate image skipped', 'Already Added');
            return false;
        }
        
        // Generate and store hash
        const hash = this.generateImageHash(img);
        this.imageHashes.push(hash);
        
        // Add image
        this.uploadedImages.push(img);
        this.updateImageGallery();
        
        if (this.uploadedImages.length === 1) {
            this.selectImage(0);
        }
        

        
        return true;
    }

    /**
     * Decode Google polyline format used by Strava
     * Based on Google's polyline encoding algorithm
     */
    decodePolyline(encoded) {
        const coords = [];
        let index = 0;
        let lat = 0;
        let lng = 0;

        while (index < encoded.length) {
            let b;
            let shift = 0;
            let result = 0;

            // Decode latitude
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
            lat += deltaLat;

            shift = 0;
            result = 0;

            // Decode longitude
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
            lng += deltaLng;

            coords.push([lat / 1e5, lng / 1e5]);
        }

        return coords;
    }

    /**
     * Fetch detailed GPS streams for stop detection
     */
    async fetchActivityStreams(activityId) {
        try {
            const baseUrl = window.stravaIntegration ? window.stravaIntegration.baseUrl : 'http://localhost:3001';
            const response = await fetch(`${baseUrl}/api/activities/${activityId}/streams`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.warn('No GPS streams available for this activity');
                return null;
            }
            
            const streams = await response.json();
            console.log('Fetched activity streams:', streams);
            return streams;
        } catch (error) {
            console.error('Error fetching activity streams:', error);
            return null;
        }
    }

    /**
     * Detect stops longer than 5 minutes in GPS data (limited to 9 stops maximum)
     */
    detectStops(streams, minStopDurationMinutes = 5) {
        if (!streams || !streams.coordinates || !streams.timestamps) {
            console.log('❌ No streams data available for stop detection');
            return [];
        }

        console.log(`🔍 Starting stop detection analysis:`);
        console.log(`   📊 Total GPS points: ${streams.coordinates.length}`);
        console.log(`   ⏱️  Min stop duration: ${minStopDurationMinutes} minutes`);

        const stops = [];
        const coordinates = streams.coordinates;
        const timestamps = streams.timestamps;
        const minStopDuration = minStopDurationMinutes * 60; // Convert to seconds
        const maxStopRadius = 50; // Increased back to 50m for better detection
        const minMovementThreshold = 50; // Reduced threshold to 50m

        // Skip the first and last 2% of points (less restrictive)
        const startSkip = Math.floor(coordinates.length * 0.02);
        const endSkip = Math.floor(coordinates.length * 0.98);

        console.log(`   📍 Analyzing points ${startSkip} to ${endSkip} (skipping start/end)`);

        let candidateStops = 0;
        let filteredStops = 0;

        let i = startSkip;
        while (i < endSkip) {
            let stationaryStart = i;
            let stationaryEnd = i;
            
            // Look ahead to find consecutive stationary points
            for (let j = i + 1; j < endSkip; j++) {
                const [lat1, lng1] = coordinates[i];
                const [lat2, lng2] = coordinates[j];
                const distance = this.calculateDistance(lat1, lng1, lat2, lng2);
                
                if (distance <= maxStopRadius) {
                    stationaryEnd = j;
                } else {
                    break;
                }
            }
            
            // Calculate duration of this stationary period
            const stationaryDuration = timestamps[stationaryEnd] - timestamps[stationaryStart];
            
            if (stationaryDuration >= minStopDuration) {
                candidateStops++;
                
                // Find the center point of the stationary region
                let avgLat = 0, avgLng = 0;
                const pointCount = stationaryEnd - stationaryStart + 1;
                
                for (let k = stationaryStart; k <= stationaryEnd; k++) {
                    avgLat += coordinates[k][0];
                    avgLng += coordinates[k][1];
                }
                
                avgLat /= pointCount;
                avgLng /= pointCount;
                
                console.log(`   🚩 Candidate stop: ${Math.round(stationaryDuration / 60)}min at (${avgLat.toFixed(6)}, ${avgLng.toFixed(6)})`);
                
                // Verify this is actually a meaningful stop (not just GPS noise)
                // Check if there's significant movement before and after
                const beforeDistance = stationaryStart > 10 ? 
                    this.calculateDistance(
                        coordinates[stationaryStart - 10][0], coordinates[stationaryStart - 10][1],
                        coordinates[stationaryStart][0], coordinates[stationaryStart][1]
                    ) : minMovementThreshold + 1; // Assume movement if near start
                
                const afterDistance = stationaryEnd < coordinates.length - 10 ?
                    this.calculateDistance(
                        coordinates[stationaryEnd][0], coordinates[stationaryEnd][1],
                        coordinates[stationaryEnd + 10][0], coordinates[stationaryEnd + 10][1]
                    ) : minMovementThreshold + 1; // Assume movement if near end
                
                console.log(`       📏 Movement before: ${Math.round(beforeDistance)}m, after: ${Math.round(afterDistance)}m`);
                
                // Only add if there's meaningful movement before or after
                if (beforeDistance > minMovementThreshold || afterDistance > minMovementThreshold) {
                    filteredStops++;
                    stops.push({
                        lat: avgLat,
                        lng: avgLng,
                        startTime: timestamps[stationaryStart],
                        endTime: timestamps[stationaryEnd],
                        duration: stationaryDuration,
                        durationMinutes: Math.round(stationaryDuration / 60),
                        pointCount: pointCount,
                        beforeMovement: Math.round(beforeDistance),
                        afterMovement: Math.round(afterDistance)
                    });
                    
                    console.log(`   ✅ VALID STOP: ${Math.round(stationaryDuration / 60)}min at (${avgLat.toFixed(6)}, ${avgLng.toFixed(6)}) - ${pointCount} GPS points`);
                } else {
                    console.log(`   ❌ Rejected: insufficient movement (${Math.round(beforeDistance)}m, ${Math.round(afterDistance)}m)`);
                }
            }
            
            // Move to the next region
            i = Math.max(stationaryEnd + 1, i + 1);
        }

        console.log(`🏁 Stop detection complete:`);
        console.log(`   🚩 Candidate stops found: ${candidateStops}`);
        console.log(`   ✅ Valid stops after filtering: ${filteredStops}`);
        console.log(`   📋 Final stops list:`, stops);

        // If no stops found, add a test stop for debugging (middle of route)
        if (stops.length === 0 && coordinates.length > 0) {
            const midIndex = Math.floor(coordinates.length / 2);
            const testStop = {
                lat: coordinates[midIndex][0],
                lng: coordinates[midIndex][1],
                startTime: timestamps[midIndex],
                endTime: timestamps[midIndex] + 300, // 5 min test duration
                duration: 300,
                durationMinutes: 5,
                pointCount: 1,
                beforeMovement: 100,
                afterMovement: 100,
                isTestStop: true
            };
            stops.push(testStop);
            console.log(`🧪 Added test stop for debugging at route midpoint: (${testStop.lat.toFixed(6)}, ${testStop.lng.toFixed(6)})`);
        }

        // Limit to maximum 9 stops
        const limitedStops = stops.slice(0, 9);
        
        if (stops.length > 9) {
            console.log(`🔢 Limited stops from ${stops.length} to ${limitedStops.length} (max 9)`);
        }
        
        return limitedStops;
    }

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Show route loading overlay
     */
    showRouteLoading() {
        if (this.elements.routeLoadingOverlay) {
            this.elements.routeLoadingOverlay.classList.add('visible');
        }
    }

    /**
     * Hide route loading overlay
     */
    hideRouteLoading() {
        if (this.elements.routeLoadingOverlay) {
            this.elements.routeLoadingOverlay.classList.remove('visible');
        }
    }

    /**
     * Get nearby places using OpenStreetMap Nominatim API
     */
    async getNearbyPlaces(minLat, maxLat, minLng, maxLng) {
        try {
            const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
            
            // Try multiple search strategies for better coverage
            const searchQueries = [
                'suburb',
                'locality', 
                'neighbourhood',
                'town',
                'city',
                'village'
            ];
            
            let allPlaces = [];
            
            // Try each search query
            for (const query of searchQueries) {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=20&bounded=1&viewbox=${bbox}&addressdetails=1&extratags=1&namedetails=1&accept-language=en`;
                
                console.log(`🔍 Trying search query: "${query}" - ${url}`);
                
                try {
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'CyclingMediaGenerator/1.0'
                        }
                    });
                    
                    if (response.ok) {
                        const places = await response.json();
                        console.log(`📍 "${query}" returned ${places.length} places`);
                        allPlaces.push(...places);
                    }
                } catch (error) {
                    console.warn(`Failed to fetch ${query}:`, error);
                }
                
                // Add small delay to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`🗺️ Total places from all queries: ${allPlaces.length}`);
            console.log('Raw combined places:', allPlaces);
            
            // Be more lenient with filtering - accept more place types
            const filteredPlaces = allPlaces.filter(place => {
                const type = place.type;
                const category = place.class;
                const placeTypes = ['suburb', 'neighbourhood', 'town', 'city', 'village', 'hamlet', 'residential', 'locality', 'quarter', 'district'];
                
                const isPlace = category === 'place' || category === 'boundary' || category === 'landuse' || category === 'highway';
                const hasGoodType = placeTypes.includes(type);
                const hasName = place.name && place.name.length > 0;
                
                // Also check for valid coordinates
                const hasValidCoords = place.lat && place.lon && !isNaN(parseFloat(place.lat)) && !isNaN(parseFloat(place.lon));
                
                return (isPlace || hasGoodType) && hasName && hasValidCoords;
            });
            
            console.log(`🔍 Filtered places: ${filteredPlaces.length}/${allPlaces.length}`);
            console.log('Filtered places:', filteredPlaces);
            
            // Remove duplicates by name and prioritize by importance
            const uniquePlaces = filteredPlaces
                .filter((place, index, self) => 
                    index === self.findIndex(p => p.name === place.name)
                )
                .sort((a, b) => {
                    // Prioritize by place type importance
                    const typeOrder = ['city', 'town', 'suburb', 'locality', 'neighbourhood', 'village', 'hamlet'];
                    const aIndex = typeOrder.indexOf(a.type) !== -1 ? typeOrder.indexOf(a.type) : 999;
                    const bIndex = typeOrder.indexOf(b.type) !== -1 ? typeOrder.indexOf(b.type) : 999;
                    return aIndex - bIndex;
                })
                .slice(0, 15); // Reduced to 15 for cleaner display
                
            console.log(`✅ Final unique places: ${uniquePlaces.length}`);
            console.log('Final places:', uniquePlaces.map(p => `${p.name} (${p.type})`));
            return uniquePlaces;
        } catch (error) {
            console.error('Error fetching nearby places:', error);
            return [];
        }
    }

    /**
     * Draw route overlay on canvas
     */
    async drawRouteOverlay(ctx, width, height, formatKey) {
        if (!this.currentActivity || !this.currentActivity.map || !this.currentActivity.map.summary_polyline) {
            return;
        }

        // Prevent concurrent route drawing
        if (this.isDrawingRoute) {
            return;
        }
        this.isDrawingRoute = true;

        // Show loading overlay while processing route
        this.showRouteLoading();

        const polyline = this.currentActivity.map.summary_polyline;
        if (!polyline) {
            this.hideRouteLoading();
            this.isDrawingRoute = false;
            return;
        }

        try {
            const coords = this.decodePolyline(polyline);
            if (coords.length < 2) return;

            // Fetch activity streams for stop detection if not already loaded
            if (!this.activityStreams && this.currentActivity.id) {
                this.activityStreams = await this.fetchActivityStreams(this.currentActivity.id);
            }

            // Detect stops
            const stops = this.activityStreams ? this.detectStops(this.activityStreams) : [];

            // Calculate bounding box
            let minLat = coords[0][0], maxLat = coords[0][0];
            let minLng = coords[0][1], maxLng = coords[0][1];

            coords.forEach(([lat, lng]) => {
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
            });

            // Create padding around the route for place queries
            const latRange = maxLat - minLat;
            const lngRange = maxLng - minLng;
            const queryPadding = Math.max(latRange, lngRange) * 0.3; // Larger area for places

            // Get nearby places
            const places = await this.getNearbyPlaces(
                minLat - queryPadding, 
                maxLat + queryPadding, 
                minLng - queryPadding, 
                maxLng + queryPadding
            );

            // Create visual padding around the route
            const padding = Math.max(latRange, lngRange) * 0.1;
            minLat -= padding;
            maxLat += padding;
            minLng -= padding;
            maxLng += padding;

            // Calculate scale factors
            const scaleX = width / (maxLng - minLng);
            const scaleY = height / (maxLat - minLat);
            const scale = Math.min(scaleX, scaleY);

            // Center the route
            const offsetX = (width - (maxLng - minLng) * scale) / 2;
            const offsetY = (height - (maxLat - minLat) * scale) / 2;

            // Convert coordinates to canvas pixels
            const canvasCoords = coords.map(([lat, lng]) => [
                offsetX + (lng - minLng) * scale,
                height - (offsetY + (lat - minLat) * scale) // Flip Y axis
            ]);

            ctx.save();

            // Draw place names FIRST (under the route) with 40% transparency
            console.log('Places found:', places.length, places); // Debug logging
            if (places.length > 0) {
                // Parse the route text color and make it 40% transparent (60% opacity)
                const color = this.elements.routeTextColor.value;
                let transparentColor;
                if (color.startsWith('#')) {
                    // Convert hex to rgba with 60% opacity
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);
                    transparentColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
                } else {
                    // Fallback for other color formats
                    transparentColor = 'rgba(255, 255, 255, 0.6)';
                }
                
                ctx.fillStyle = transparentColor;
                ctx.font = 'bold 20px Geist, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Add text shadow for visibility even at low opacity
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                // Track drawn text positions to prevent overlaps
                const drawnTextBoxes = [];
                
                // Sort places by priority before drawing (more important places drawn first)
                const prioritizedPlaces = places.sort((a, b) => {
                    const typePriority = {
                        'city': 1,
                        'town': 2,
                        'suburb': 3,
                        'locality': 4,
                        'neighbourhood': 5,
                        'village': 6,
                        'hamlet': 7
                    };
                    const aPriority = typePriority[a.type] || 8;
                    const bPriority = typePriority[b.type] || 8;
                    return aPriority - bPriority;
                });

                prioritizedPlaces.forEach((place, index) => {
                    const lat = parseFloat(place.lat);
                    const lng = parseFloat(place.lon);
                    
                    console.log(`Place ${index}:`, place.name, 'at', lat, lng); // Debug logging
                    
                    // More lenient bounds check
                    const expandedMinLat = minLat - padding * 0.5;
                    const expandedMaxLat = maxLat + padding * 0.5;
                    const expandedMinLng = minLng - padding * 0.5;
                    const expandedMaxLng = maxLng + padding * 0.5;
                    
                    if (lat >= expandedMinLat && lat <= expandedMaxLat && lng >= expandedMinLng && lng <= expandedMaxLng) {
                        const x = offsetX + (lng - minLng) * scale;
                        const y = height - (offsetY + (lat - minLat) * scale);
                        
                        console.log(`Drawing place at canvas coords:`, x, y); // Debug logging
                        
                        // Extract suburb name from display_name or use name
                        let placeName = place.name;
                        if (place.address) {
                            if (place.address.suburb) {
                                placeName = place.address.suburb;
                            } else if (place.address.neighbourhood) {
                                placeName = place.address.neighbourhood;
                            } else if (place.address.town) {
                                placeName = place.address.town;
                            } else if (place.address.city) {
                                placeName = place.address.city;
                            }
                        }
                        
                        if (placeName) {
                            const upperCaseName = placeName.toUpperCase();
                            
                            // Calculate text dimensions for collision detection
                            const textMetrics = ctx.measureText(upperCaseName);
                            const textWidth = textMetrics.width;
                            const textHeight = 24; // Approximate height for 20px font
                            const padding = 8; // Add padding around text for visual separation
                            
                            const textBox = {
                                x: x - (textWidth + padding) / 2,
                                y: y - (textHeight + padding) / 2,
                                width: textWidth + padding,
                                height: textHeight + padding
                            };
                            
                            // Check for overlaps with previously drawn text
                            const hasOverlap = drawnTextBoxes.some(existingBox => {
                                return !(textBox.x + textBox.width < existingBox.x || 
                                        existingBox.x + existingBox.width < textBox.x ||
                                        textBox.y + textBox.height < existingBox.y ||
                                        existingBox.y + existingBox.height < textBox.y);
                            });
                            
                            if (!hasOverlap) {
                                console.log(`✅ Drawing text: "${upperCaseName}" at (${x}, ${y})`);
                                ctx.fillText(upperCaseName, x, y);
                                drawnTextBoxes.push(textBox);
                            } else {
                                console.log(`❌ Skipping overlapping text: "${upperCaseName}" at (${x}, ${y})`);
                            }
                        }
                    } else {
                        console.log(`Place ${place.name} outside bounds`); // Debug logging
                    }
                });
            } else {
                console.log('No places found or places array empty'); // Debug logging
            }

            // Reset shadow for route elements
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Draw start and end points UNDER the route
            const startPoint = canvasCoords[0];
            const endPoint = canvasCoords[canvasCoords.length - 1];
            const stopCount = stops.length;
            const endNumber = stopCount + 2; // Start(1) + stops + end
            
            // Check if start and end points overlap by more than 60%
            const distance = Math.sqrt(
                Math.pow(endPoint[0] - startPoint[0], 2) + 
                Math.pow(endPoint[1] - startPoint[1], 2)
            );
            const circleRadius = 30;
            // For 60% overlap, distance should be less than 0.8 * diameter = 48px
            const overlapThreshold = circleRadius * 0.8; // 60% overlap threshold = 24px
            const showBothCircles = distance > overlapThreshold;
            
            console.log(`🔍 Overlap detection: distance=${distance.toFixed(1)}px, threshold=${overlapThreshold}px, showBoth=${showBothCircles}`);
            
            // Draw start point (transparent green circle - no border) - 50% larger
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; // Transparent green
            ctx.beginPath();
            ctx.arc(startPoint[0], startPoint[1], 30, 0, 2 * Math.PI);
            ctx.fill();

            // Only draw end point if circles don't overlap significantly
            if (showBothCircles) {
                // Draw end point (transparent red circle - no border) - 50% larger
                ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Transparent red
                ctx.beginPath();
                ctx.arc(endPoint[0], endPoint[1], 30, 0, 2 * Math.PI);
                ctx.fill();
            }

            // Draw route path OVER the start/end circles
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            // Draw single solid white route line
            ctx.beginPath();
            ctx.moveTo(canvasCoords[0][0], canvasCoords[0][1]);
            canvasCoords.slice(1).forEach(([x, y]) => {
                ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Reset shadow for dots
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Draw pink dots for start and end points (above route line and green/red circles, below numbers)
            // Draw end dot first, then start dot on top (only if both circles are shown)
            ctx.fillStyle = '#FF0066'; // Pink color
            
            // Only draw end pink dot if red circle is visible
            if (showBothCircles) {
                ctx.beginPath();
                ctx.arc(endPoint[0], endPoint[1], 16, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Always draw start pink dot
            ctx.beginPath();
            ctx.arc(startPoint[0], startPoint[1], 16, 0, 2 * Math.PI);
            ctx.fill();

            // Draw start number on top (with better centering) - 2px larger text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 18px Geist, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            // Measure text to center it properly
            const startMetrics = ctx.measureText('1');
            const startTextHeight = startMetrics.actualBoundingBoxAscent;
            ctx.fillText('1', startPoint[0], startPoint[1] + startTextHeight / 2);

            // Only draw end number if both circles are visible
            if (showBothCircles) {
                // Draw end number on top (with better centering) - 2px larger text
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 18px Geist, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
                const endText = endNumber.toString();
                const endMetrics = ctx.measureText(endText);
                const endTextHeight = endMetrics.actualBoundingBoxAscent;
                ctx.fillText(endText, endPoint[0], endPoint[1] + endTextHeight / 2);
            }

            // Draw stop markers (pink dots for 10+ minute stops)
            console.log(`🩷 Attempting to draw ${stops.length} stop markers`);
            if (stops.length > 0) {
                console.log(`   📍 Route bounds: lat(${minLat.toFixed(6)} to ${maxLat.toFixed(6)}), lng(${minLng.toFixed(6)} to ${maxLng.toFixed(6)})`);
                console.log(`   📐 Canvas scale: ${scale.toFixed(2)}, offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
                
                stops.forEach((stop, index) => {
                    // Convert stop coordinates to canvas pixels
                    const stopX = offsetX + (stop.lng - minLng) * scale;
                    const stopY = height - (offsetY + (stop.lat - minLat) * scale);
                    
                    const stopType = stop.isTestStop ? '🧪 TEST STOP' : '🚩 REAL STOP';
                    console.log(`   🩷 Stop ${index + 1} ${stopType}: GPS(${stop.lat.toFixed(6)}, ${stop.lng.toFixed(6)}) → Canvas(${stopX.toFixed(1)}, ${stopY.toFixed(1)}) - ${stop.durationMinutes}min`);
                    
                    // Check if the stop is within canvas bounds
                    if (stopX >= 0 && stopX <= width && stopY >= 0 && stopY <= height) {
                        console.log(`     ✅ Drawing pink dot within canvas bounds`);
                        
                        // Draw pink stop marker (#FF0066) - no border
                        ctx.fillStyle = '#FF0066'; // Exact pink color requested
                        ctx.beginPath();
                        ctx.arc(stopX, stopY, 16, 0, 2 * Math.PI); // 16px radius for consistency
                        ctx.fill();
                        
                        // Draw stop number on top (with better centering) - 2px larger text
                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = 'bold 16px Geist, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'alphabetic';
                        const stopNumber = index + 2; // Start is 1, so stops start at 2
                        const stopText = stopNumber.toString();
                        const stopMetrics = ctx.measureText(stopText);
                        const stopTextHeight = stopMetrics.actualBoundingBoxAscent;
                        ctx.fillText(stopText, stopX, stopY + stopTextHeight / 2);
                        
                        console.log(`     ✅ Pink dot #${stopNumber} drawn successfully at (${stopX.toFixed(1)}, ${stopY.toFixed(1)})`);
                    } else {
                        console.log(`     ❌ Stop outside canvas bounds - X: ${stopX.toFixed(1)} (0-${width}), Y: ${stopY.toFixed(1)} (0-${height})`);
                    }
                });
            } else {
                console.log(`   ❌ No stops detected - no pink dots to draw`);
            }

            ctx.restore();
        } catch (error) {
            console.warn('Error drawing route overlay:', error);
        } finally {
            // Hide loading overlay and reset drawing state
            this.hideRouteLoading();
            this.isDrawingRoute = false;
        }
    }

    handleImageUpload(files) {
        let addedCount = 0;
        let skippedCount = 0;
        
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        if (this.addImageIfUnique(img, false)) {
                            addedCount++;
                        } else {
                            skippedCount++;
                        }
                        
                        // Show summary message after processing all files
                        if (addedCount + skippedCount === files.length) {
                            if (skippedCount > 0) {
                                window.toast.warning('All images were duplicates and skipped');
                            }
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
        
        if (this.uploadedImages.length === 0) {
            // Show default placeholders when no images are uploaded
            gallery.innerHTML = `
                <div class="featured-loading-placeholder">
                    <div class="featured-loading-skeleton"></div>
                </div>
                <div class="featured-loading-placeholder">
                    <div class="featured-loading-skeleton"></div>
                </div>
                <div class="featured-loading-placeholder">
                    <div class="featured-loading-skeleton"></div>
                </div>
                <div class="featured-loading-placeholder">
                    <div class="featured-loading-skeleton"></div>
                </div>
                <div class="featured-loading-placeholder">
                    <div class="featured-loading-skeleton"></div>
                </div>
                <div class="featured-loading-placeholder">
                    <div class="featured-loading-skeleton"></div>
                </div>
            `;
            return;
        }
        
        // Instead of clearing completely, fade out placeholders first
        const placeholders = gallery.querySelectorAll('.featured-loading-placeholder');
        
        // If we have placeholders, fade them out first
        if (placeholders.length > 0) {
            placeholders.forEach(placeholder => {
                placeholder.style.opacity = '0';
                placeholder.style.transition = 'opacity 0.15s ease';
            });
            
            // Wait for fade out, then replace content
            setTimeout(() => {
                this.replaceWithImages(gallery);
            }, 150);
        } else {
            // No placeholders, replace immediately
            this.replaceWithImages(gallery);
        }
    }

    replaceWithImages(gallery) {
        // Clear gallery and populate with actual images
        gallery.innerHTML = '';
        
        this.uploadedImages.forEach((img, index) => {
            const itemContainer = document.createElement('div');
            itemContainer.classList.add('image-gallery-item');
            itemContainer.draggable = true;
            itemContainer.dataset.index = index;
            
            // Start with opacity 0 for fade-in effect
            itemContainer.style.opacity = '0';
            itemContainer.style.transition = 'opacity 0.15s ease';
            
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
            
            // Trigger fade-in for all images simultaneously
            setTimeout(() => {
                itemContainer.style.opacity = '1';
            }, 10); // Very quick fade-in for all images at once
        });
    }

    selectImage(index) {
        this.selectedImageIndex = index;
        this.selectedBackground = null;
        this.resetImagePositions();
        this.updateImageGallery();
        this.updatePositionControls();
        this.updateSquareSlider();
        this.generateAllPreviews();
    }

    deleteImage(index) {
        if (index >= 0 && index < this.uploadedImages.length) {
            this.uploadedImages.splice(index, 1);
            this.imageHashes.splice(index, 1); // Remove corresponding hash
            
            // Remove corresponding position settings for square format
            if (this.imagePositions.square.length > index) {
                this.imagePositions.square.splice(index, 1);
            }
            
            // Update selected index if necessary
            if (this.selectedImageIndex === index) {
                this.selectedImageIndex = -1;
                this.selectedBackground = null; // Use background color instead
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
        
        // Move the corresponding hash
        const movedHash = this.imageHashes.splice(fromIndex, 1)[0];
        this.imageHashes.splice(toIndex, 0, movedHash);
        
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
        
        // Hide loading overlay when navigating away from route slide
        this.hideRouteLoading();
        
        this.squareSliderIndex = this.squareSliderIndex > 0 
            ? this.squareSliderIndex - 1 
            : this.uploadedImages.length - 1;
        
        this.updateSquareSlider();
        this.updatePositionControls(); // Update position controls for new image
        this.generatePreview('square');
    }

    nextSquareSlide() {
        if (this.uploadedImages.length <= 1) return;
        
        // Hide loading overlay when navigating away from route slide
        this.hideRouteLoading();
        
        this.squareSliderIndex = this.squareSliderIndex < this.uploadedImages.length - 1 
            ? this.squareSliderIndex + 1 
            : 0;
        
        this.updateSquareSlider();
        this.updatePositionControls(); // Update position controls for new image
        this.generatePreview('square');
    }

    goToSquareSlide(index) {
        if (index >= 0 && index < this.uploadedImages.length) {
            // Hide loading overlay when navigating away from route slide
            this.hideRouteLoading();
            
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
            controls.style.display = 'flex'; // Always show position controls
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

    async generateAllPreviews() {
        // Generate previews sequentially to avoid overwhelming the API
        for (const formatKey of Object.keys(this.formats)) {
            await this.generatePreview(formatKey);
        }
    }

    async generatePreview(formatKey) {
        const format = this.formats[formatKey];
        const ctx = format.ctx;
        const canvas = format.canvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        this.drawBackground(ctx, canvas.width, canvas.height, formatKey);
        
        // Draw overlay (on first and second image for square format)
        if (formatKey !== 'square' || this.squareSliderIndex === 0 || (this.squareSliderIndex === 1 && this.uploadedImages.length >= 2)) {
            const useRouteSettings = formatKey === 'square' && this.squareSliderIndex === 1 && this.uploadedImages.length >= 2;
            this.drawOverlay(ctx, canvas.width, canvas.height, useRouteSettings);
        }
        
        // Draw content
        await this.drawContent(ctx, canvas.width, canvas.height, formatKey);
    }

    drawBackground(ctx, width, height, formatKey) {
        // Use slider index for square format, selectedImageIndex for others
        let imageIndex = formatKey === 'square' ? this.squareSliderIndex : this.selectedImageIndex;
        
        if (imageIndex >= 0 && this.uploadedImages[imageIndex]) {
            this.drawImageBackground(ctx, width, height, this.uploadedImages[imageIndex], formatKey);
        } else {
            this.drawSolidBackground(ctx, width, height);
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

    drawSolidBackground(ctx, width, height) {
        const backgroundColor = this.elements.backgroundColor.value;
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
    }

    drawOverlay(ctx, width, height, useRouteSettings = false) {
        const opacityElement = useRouteSettings ? this.elements.routeOpacity : this.elements.opacity;
        const opacity = parseInt(opacityElement.value) / 100;
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.fillRect(0, 0, width, height);
    }

    async drawContent(ctx, width, height, formatKey) {
        // For square format, handle different overlays based on slider index
        if (formatKey === 'square') {
            if (this.squareSliderIndex === 1 && this.uploadedImages.length >= 2) {
                // Second image: draw route overlay only (only if there are at least 2 images)
                await this.drawRouteOverlay(ctx, width, height, formatKey);
                return;
            } else if (this.squareSliderIndex === 0) {
                // First image: draw title/stats (existing behavior) 
                // Continue to standard content below
            } else {
                // Other images: no overlay
                return;
            }
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
        // Scale font sizes based on format - square now matches landscape
        let baseScale;
        if (formatKey === 'square') {
            baseScale = 1.859; // matches landscape sizing
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
            ctx.font = `${labelFontSize}px Geist, sans-serif`;
            const labelWidth = ctx.measureText(stat.label).width;
            
            ctx.font = `bold ${valueFontSize}px Geist, sans-serif`;
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
            ctx.font = `${labelFontSize}px Geist, sans-serif`;
            ctx.fillText(stat.label, currentX, currentY - valueFontSize - labelValueGap);
            
            ctx.font = `bold ${valueFontSize}px Geist, sans-serif`;
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
        // Scale font size based on format - square now matches landscape
        let baseScale;
        if (formatKey === 'square') {
            baseScale = 1.43; // matches landscape sizing
        } else if (formatKey === 'landscape') {
            baseScale = 1.43; // 1.1 * 1.3 = increased by 30%
        } else {
            baseScale = 1.69; // 1.3 * 1.3 = increased by 30% (portrait, story, reel)
        }
        
        let fontSize = Math.floor(48 * baseScale);
        let lines = [];
        
        do {
            ctx.font = `bold ${fontSize}px Geist, sans-serif`;
            lines = this.wrapText(ctx, title, maxWidth);
            fontSize -= 2;
        } while (lines.length > 3 && fontSize > 20);
        
        // Draw title lines from bottom up - scale line height for better spacing
        const lineHeightGap = Math.floor(12 * baseScale);
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
        
        // Ensure slider is reset to first image when importing new activity
        window.mediaGenerator.squareSliderIndex = 0;
        window.mediaGenerator.updateSquareSlider();
        
        // Store activity data for route overlay and clear previous streams
        window.mediaGenerator.currentActivity = activity;
        window.mediaGenerator.activityStreams = null; // Clear previous streams to fetch new ones
        
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
            if (window.mediaGenerator.addImageIfUnique(img, false)) { // Don't show success toast for Strava imports
                window.mediaGenerator.updateSquareSlider();
                
                // If this should be set as background, select it
                if (setAsBackground) {
                    window.mediaGenerator.selectImage(window.mediaGenerator.uploadedImages.length - 1);
                }
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
             if (window.mediaGenerator.addImageIfUnique(img, false)) { // Don't show success toast for Strava imports
                 window.mediaGenerator.updateSquareSlider();
                 // Auto-select the imported image
                 window.mediaGenerator.selectImage(window.mediaGenerator.uploadedImages.length - 1);
             }
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

// Mobile Tab Navigation System
class MobileTabManager {
    constructor() {
        this.currentTab = 'content';
        this.init();
    }

    init() {
        // Bind tab click events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('mobile-tab-btn') || e.target.closest('.mobile-tab-btn')) {
                const tabBtn = e.target.classList.contains('mobile-tab-btn') ? e.target : e.target.closest('.mobile-tab-btn');
                const tabName = tabBtn.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            }
        });

        // Set initial tab
        this.switchTab(this.currentTab);
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab button states
        document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeTabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTabBtn) {
            activeTabBtn.classList.add('active');
        }

        // Update layout content classes
        const layoutContent = document.querySelector('.layout-content');
        if (layoutContent) {
            // Remove all tab classes
            layoutContent.classList.remove('tab-content', 'tab-design', 'tab-publish');
            
            // Add the current tab class
            layoutContent.classList.add(`tab-${tabName}`);
        }

        // Handle special cases for integration toolbar visibility
        const integrationToolbar = document.querySelector('.integration-toolbar');
        if (integrationToolbar) {
            // Reset display
            integrationToolbar.style.display = '';
            
            // Apply mobile-specific visibility rules via CSS classes
            integrationToolbar.classList.remove('tab-content', 'tab-design', 'tab-publish');
            integrationToolbar.classList.add(`tab-${tabName}`);
        }
    }
}

// Initialize mobile tab manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 800) {
        window.mobileTabManager = new MobileTabManager();
    }
    
    // Handle window resize to initialize/destroy mobile tabs as needed
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 800 && !window.mobileTabManager) {
            window.mobileTabManager = new MobileTabManager();
        } else if (window.innerWidth > 800 && window.mobileTabManager) {
            // Clean up mobile tab classes on desktop
            const layoutContent = document.querySelector('.layout-content');
            if (layoutContent) {
                layoutContent.classList.remove('tab-content', 'tab-design', 'tab-publish');
            }
            
            const integrationToolbar = document.querySelector('.integration-toolbar');
            if (integrationToolbar) {
                integrationToolbar.classList.remove('tab-content', 'tab-design', 'tab-publish');
                integrationToolbar.style.display = '';
            }
            
            window.mobileTabManager = null;
        }
    });
});