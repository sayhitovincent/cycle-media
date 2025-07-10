class StravaIntegration {
    constructor() {
        this.baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : '/api';
        this.user = null;
        this.activities = [];
        this.selectedActivity = null;
        
        // Rate limiting and caching
        this.apiCache = new Map();
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // 1 second between requests
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        
        this.initializeElements();
        this.bindEvents();
        this.checkAuthStatus();
    }

    // Rate limiting and caching methods
    getCacheKey(url, options = {}) {
        return `${url}_${JSON.stringify(options)}`;
    }

    getCachedResponse(cacheKey) {
        const cached = this.apiCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache
            return cached.data;
        }
        return null;
    }

    setCachedResponse(cacheKey, data) {
        this.apiCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
    }

    async rateLimitedFetch(url, options = {}) {
        const cacheKey = this.getCacheKey(url, options);
        
        // Check cache first
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
            console.log('Using cached response for:', url);
            return cached;
        }

        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, options, resolve, reject, cacheKey });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const { url, options, resolve, reject, cacheKey } = this.requestQueue.shift();
            
            try {
                // Ensure minimum interval between requests
                const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                if (timeSinceLastRequest < this.minRequestInterval) {
                    await this.delay(this.minRequestInterval - timeSinceLastRequest);
                }

                this.lastRequestTime = Date.now();
                const result = await this.fetchWithRetry(url, options, cacheKey);
                resolve(result);

            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    async fetchWithRetry(url, options, cacheKey, retryCount = 0) {
        try {
            const response = await fetch(url, {
                credentials: 'include',
                ...options
            });

            if (response.status === 429) { // Rate limit exceeded
                throw new Error('RATE_LIMIT_EXCEEDED');
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache successful responses
            this.setCachedResponse(cacheKey, data);
            
            // Reset retry attempts on success
            this.retryAttempts.delete(url);
            
            return data;

        } catch (error) {
            if (error.message === 'RATE_LIMIT_EXCEEDED' && retryCount < this.maxRetries) {
                const backoffDelay = Math.pow(2, retryCount) * 2000; // Exponential backoff: 2s, 4s, 8s
                console.log(`Rate limit hit for ${url}. Retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
                
                window.toast.warning(
                    `Rate limit reached. Retrying in ${backoffDelay/1000} seconds...`,
                    'Strava API Limit'
                );

                await this.delay(backoffDelay);
                return this.fetchWithRetry(url, options, cacheKey, retryCount + 1);
            }

            console.error('API request failed:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearCache() {
        this.apiCache.clear();
        this.retryAttempts.clear();
        window.toast.info('API cache cleared', 'Cache Management');
    }

    getCacheStats() {
        return {
            cacheSize: this.apiCache.size,
            queueSize: this.requestQueue.length,
            isProcessingQueue: this.isProcessingQueue
        };
    }

    initializeElements() {
        // Create Strava integration UI
        this.createStravaUI();
    }

    createStravaUI() {
        // Add activities button to header
        this.addActivitiesButtonToHeader();
        
        // Create activities modal
        this.createActivitiesModal();
    }

    addActivitiesButtonToHeader() {
        const headerCenter = document.querySelector('.nav-center');
        if (!headerCenter) return;

        // Check if the button already exists to prevent duplicates
        if (document.getElementById('browse-activities-btn')) {
            return;
        }

        // Create the activities button with consistent styling
        const activitiesButton = document.createElement('button');
        activitiesButton.id = 'browse-activities-btn';
        activitiesButton.className = 'activities-btn';
        activitiesButton.disabled = true;
        activitiesButton.innerHTML = 'Update Activity';

        headerCenter.appendChild(activitiesButton);
    }

    createActivitiesModal() {
        const modal = document.createElement('div');
        modal.className = 'strava-modal hidden';
        modal.id = 'strava-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Browse Strava Activities</h2>
                    <div class="modal-header-actions">
                        <button class="modal-refresh" title="Refresh activities">⟳</button>
                        <button class="modal-close">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="modal-body-content">
                        <div id="activities-list" class="activities-list">
                            <div class="loading">Loading activities...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'strava-logout-btn') {
                // Handle both disconnect and connect actions
                if (this.user) {
                    this.logout();
                } else {
                    this.login();
                }
            } else if (e.target.id === 'browse-activities-btn') {
                // Only show modal if connected and not disabled
                if (!e.target.disabled) {
                    this.showActivitiesModal();
                }
            } else if (e.target.classList.contains('modal-close')) {
                this.hideActivitiesModal();
            } else if (e.target.classList.contains('modal-refresh')) {
                this.refreshActivities();
            } else if (e.target.classList.contains('activity-photo')) {
                this.selectPhoto(e.target.dataset.photoUrl);
                this.hideActivitiesModal(); // Close modal after selecting photo
            }
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('strava-modal')) {
                this.hideActivitiesModal();
            }
        });

        // Check for OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auth') === 'success') {
            this.handleAuthSuccess();
        } else if (urlParams.get('error')) {
            this.handleAuthError(urlParams.get('error'));
        }
    }

    async checkAuthStatus() {
        try {
            const user = await this.rateLimitedFetch(`${this.baseUrl}/api/user`);
            this.user = user;
            this.showAuthenticatedUI();
            await this.loadActivities();
        } catch (error) {
            console.log('Not authenticated');
        }
    }

    login() {
        window.location.href = `${this.baseUrl}/auth/strava`;
    }

    async logout() {
        try {
            await this.rateLimitedFetch(`${this.baseUrl}/api/logout`, {
                method: 'POST'
            });
            this.user = null;
            this.showUnauthenticatedUI();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    handleAuthSuccess() {
        // Remove query parameters from URL
        const url = new URL(window.location);
        url.searchParams.delete('auth');
        window.history.replaceState({}, document.title, url);
        
        // Check auth status
        this.checkAuthStatus();
    }

    handleAuthError(error) {
        console.error('Auth error:', error);
        window.toast.error('Authentication failed. Please try again.', 'Strava Auth Error');
        
        // Remove query parameters from URL
        const url = new URL(window.location);
        url.searchParams.delete('error');
        window.history.replaceState({}, document.title, url);
    }

    updateActivitiesButtonState(state = 'normal', disabled = false) {
        const browseButton = document.getElementById('browse-activities-btn');
        if (!browseButton) return;

        browseButton.disabled = disabled;
        browseButton.classList.remove('btn-loading');

        switch (state) {
            case 'loading':
                browseButton.classList.add('btn-loading');
                browseButton.innerHTML = '<span class="loading-spinner"></span>';
                break;
            case 'normal':
            default:
                browseButton.innerHTML = `Update Activity`;
                break;
        }
    }

    showAuthenticatedUI() {
        // Update main page UI - enable the activities button
        this.updateActivitiesButtonState('normal', false);
        
        // Update integrations page UI
        this.updateIntegrationsPageUI(true);
    }

    showUnauthenticatedUI() {
        // Update main page UI - disable the activities button
        this.updateActivitiesButtonState('normal', true);
        
        // Update integrations page UI
        this.updateIntegrationsPageUI(false);
    }

    updateIntegrationsPageUI(isConnected) {
        const stravaCard = document.querySelector('.strava-card');
        if (!stravaCard) return;
        
        const statusDot = stravaCard.querySelector('.status-dot');
        const statusText = stravaCard.querySelector('.status-text');
        const logoutBtn = stravaCard.querySelector('#strava-logout-btn');
        
        if (isConnected) {
            stravaCard.classList.add('connected');
            stravaCard.classList.remove('disconnected');
            if (statusDot) statusDot.className = 'status-dot connected';
            if (statusText) statusText.textContent = 'Connected';
            if (logoutBtn) {
                logoutBtn.textContent = 'Disconnect';
                logoutBtn.style.display = 'inline-block';
            }
        } else {
            stravaCard.classList.remove('connected');
            stravaCard.classList.add('disconnected');
            if (statusDot) statusDot.className = 'status-dot disconnected';
            if (statusText) statusText.textContent = 'Not Connected';
            if (logoutBtn) {
                logoutBtn.textContent = 'Connect Strava';
                logoutBtn.style.display = 'inline-block';
            }
        }
    }

    showActivitiesModal() {
        const modal = document.getElementById('strava-modal');
        modal.classList.remove('hidden');
        // Load activities if not already loaded
        if (!this.activities) {
            this.loadActivities();
        }
    }

    hideActivitiesModal() {
        const modal = document.getElementById('strava-modal');
        modal.classList.add('hidden');
    }

    async loadActivities() {
        try {
            // Show loading state on browse button
            this.updateActivitiesButtonState('loading', true);

            this.activities = await this.rateLimitedFetch(`${this.baseUrl}/api/activities`);
            await this.renderActivities();
        } catch (error) {
            console.error('Error loading activities:', error);
            const activitiesList = document.getElementById('activities-list');
            if (activitiesList) {
                activitiesList.innerHTML = '<div class="error">Failed to load activities</div>';
            }
        } finally {
            // Reset browse button to normal state
            this.updateActivitiesButtonState('normal', false);
        }
    }

    async refreshActivities() {
        try {
            const refreshButton = document.querySelector('.modal-refresh');
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.textContent = '⟳';
                refreshButton.classList.add('spinning');
            }

            // Clear API cache for activities
            await this.clearApiCache('activities');
            
            // Clear local activities cache
            this.activities = null;
            
            // Show loading state
            document.getElementById('activities-list').innerHTML = 
                '<div class="loading">Refreshing activities...</div>';
            
            // Reload activities
            await this.loadActivities();
            
            window.toast.success('Activities refreshed successfully', 'Refresh Complete');
            
        } catch (error) {
            console.error('Error refreshing activities:', error);
            window.toast.error('Failed to refresh activities', 'Refresh Error');
        } finally {
            const refreshButton = document.querySelector('.modal-refresh');
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.textContent = '⟳';
                refreshButton.classList.remove('spinning');
            }
        }
    }

    async refreshActivity(activityId) {
        try {
            const refreshButton = document.querySelector(`[data-activity-id="${activityId}"] .refresh-activity-btn`);
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.classList.add('spinning');
            }

            // Clear API cache for this specific activity
            await this.clearApiCache(`activity_${activityId}`);
            
            // Clear photos for this activity and show loading state
            const photosContainer = document.getElementById(`photos-${activityId}`);
            if (photosContainer) {
                photosContainer.innerHTML = `
                    <div class="load-photos-placeholder">
                        <div class="loading">Loading photos...</div>
                    </div>
                `;
            }
            
            // Fetch refreshed activity data
            const refreshedActivity = await this.rateLimitedFetch(`${this.baseUrl}/api/activities/${activityId}`);
            
            // Update the activity in our local cache
            const activityIndex = this.activities.findIndex(activity => activity.id === activityId);
            if (activityIndex !== -1) {
                this.activities[activityIndex] = refreshedActivity;
                
                // Update the activity stats display
                const activitySection = document.querySelector(`[data-activity-id="${activityId}"]`);
                if (activitySection) {
                    const statsElement = activitySection.querySelector('.activity-stats');
                    if (statsElement) {
                        statsElement.innerHTML = `
                            ${(refreshedActivity.distance / 1000).toFixed(1)} km • 
                            ${Math.floor(refreshedActivity.moving_time / 60)} min • 
                            ↗ ${Math.round(refreshedActivity.total_elevation_gain)}m • 
                            📷 ${refreshedActivity.total_photo_count} photos
                        `;
                    }
                }
            }
            
            // Automatically load photos for this activity
            await this.loadActivityPhotos(activityId);
            
            window.toast.success('Activity refreshed successfully', 'Refresh Complete');
            
        } catch (error) {
            console.error('Error refreshing activity:', error);
            window.toast.error('Failed to refresh activity', 'Refresh Error');
            
            // Show error state for photos
            const photosContainer = document.getElementById(`photos-${activityId}`);
            if (photosContainer) {
                photosContainer.innerHTML = `
                    <div class="load-photos-placeholder">
                        <button class="load-photos-btn" onclick="window.stravaIntegration.loadActivityPhotos('${activityId}')">
                            Load Photos
                        </button>
                    </div>
                `;
            }
        } finally {
            const refreshButton = document.querySelector(`[data-activity-id="${activityId}"] .refresh-activity-btn`);
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.classList.remove('spinning');
            }
        }
    }

    async clearApiCache(endpoint = null) {
        try {
            const params = endpoint ? `?endpoint=${endpoint}` : '';
            await this.rateLimitedFetch(`${this.baseUrl}/api/cache/api-clear${params}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Error clearing API cache:', error);
            throw error;
        }
    }

    async renderActivities() {
        const container = document.getElementById('activities-list');
        
        if (this.activities.length === 0) {
            container.innerHTML = '<div class="no-activities">No activities with photos found</div>';
            return;
        }

        // Activities are already filtered by the backend to have photos
        container.innerHTML = this.activities.map((activity, index) => `
            <div class="activity-section" data-activity-id="${activity.id}">
                <div class="activity-header">
                    <div class="activity-title-section">
                        <h3>${activity.name}</h3>
                        <div class="activity-meta">
                            <span class="activity-type">${activity.sport_type || activity.type}</span>
                            <span class="activity-date">${new Date(activity.start_date).toLocaleDateString()}</span>
                            <span class="activity-stats">
                                ${(activity.distance / 1000).toFixed(1)} km • 
                                ${Math.floor(activity.moving_time / 60)} min • 
                                ↗ ${Math.round(activity.total_elevation_gain)}m • 
                                📷 ${activity.total_photo_count} photos
                            </span>
                        </div>
                    </div>
                    <div class="activity-actions">
                        <button class="refresh-activity-btn" onclick="window.stravaIntegration.refreshActivity('${activity.id}')" title="Refresh this activity">
                            ⟳
                        </button>
                        <button class="import-activity-btn" onclick="window.stravaIntegration.importFullActivity('${activity.id}')">
                            Import Activity
                        </button>
                    </div>
                </div>
                <div class="activity-photos">
                    <div class="photos-grid" id="photos-${activity.id}">
                        ${index >= 5 ? `
                            <div class="load-photos-placeholder">
                                <button class="load-photos-btn" onclick="window.stravaIntegration.loadActivityPhotos('${activity.id}')">
                                    Load Photos
                                </button>
                            </div>
                        ` : this.generatePhotoPlaceholders(activity.total_photo_count)}
                    </div>
                </div>
            </div>
        `).join('');

        // Load photos for only the first 5 activities (most recent)
        this.loadRecentActivityPhotos();
        
        // Auto-load the most recent activity stats and images into the form fields
        await this.loadMostRecentActivityStats();
    }

    generatePhotoPlaceholders(photoCount) {
        // Limit placeholders to a reasonable number to avoid too many DOM elements
        const maxPlaceholders = Math.min(photoCount, 12);
        
        let placeholders = '';
        for (let i = 0; i < maxPlaceholders; i++) {
            placeholders += `
                <div class="photo-item photo-placeholder" data-placeholder-index="${i}">
                    <div class="activity-photo-placeholder">
                        <div class="photo-skeleton"></div>
                    </div>
                </div>
            `;
        }
        
        // Show remaining count if there are more photos
        if (photoCount > maxPlaceholders) {
            placeholders += `
                <div class="photo-item remaining-photos-indicator">
                    <div class="remaining-photos-count">
                        +${photoCount - maxPlaceholders} more
                    </div>
                </div>
            `;
        }
        
        return placeholders;
    }

    async loadMostRecentActivityStats() {
        // Only auto-load if fields are currently empty and we have activities
        if (this.activities.length > 0) {
            const mostRecentActivity = this.activities[0]; // Activities are already sorted by date (most recent first)
            
            // Check if form fields are empty before auto-populating
            const titleField = document.getElementById('title-text');
            const distanceField = document.getElementById('distance');
            const timeField = document.getElementById('time');
            const elevationField = document.getElementById('elevation');
            
            const fieldsAreEmpty = !titleField.value.trim() && 
                                   !distanceField.value.trim() && 
                                   !timeField.value.trim() && 
                                   !elevationField.value.trim();
            
            // Check if image gallery is also empty
            const imagesAreEmpty = !window.mediaGenerator || window.mediaGenerator.uploadedImages.length === 0;
            
            if (fieldsAreEmpty && imagesAreEmpty) {
                try {
                    // Fetch detailed activity data with photos using rate-limited request
                    const activity = await this.rateLimitedFetch(`${this.baseUrl}/api/activities/${mostRecentActivity.id}`);
                    
                    if (activity.photos && activity.photos.length > 0) {
                        // Clear existing featured images first (should be empty anyway)
                        this.clearFeaturedImages();
                        
                        // Import all photos to the background image list
                        for (let i = 0; i < activity.photos.length; i++) {
                            const photo = activity.photos[i];
                            await this.importPhotoToList(photo.url, i === 0); // First photo becomes active background
                        }
                        
                        // Reset square feed post to first image
                        if (window.mediaGenerator) {
                            window.mediaGenerator.squareSliderIndex = 0;
                            window.mediaGenerator.updateSquareSlider();
                            window.mediaGenerator.generateAllPreviews();
                        }
                    }
                    
                    // Import activity stats
                    this.importActivityStats(activity);
                    
                } catch (error) {
                    console.error('Error auto-loading activity:', error);
                    // If photo import fails, still try to import just the stats
                    this.importActivityStats(mostRecentActivity);
                }
            }
        }
    }

    async importFullActivity(activityId) {
        try {
            const button = document.querySelector(`[data-activity-id="${activityId}"] .import-activity-btn`);
            const originalText = button.textContent;
            
            // Show loading state
            button.disabled = true;
            button.textContent = 'Importing...';

            // Fetch detailed activity data with photos using rate-limited request
            const activity = await this.rateLimitedFetch(`${this.baseUrl}/api/activities/${activityId}`);
            
            if (activity.photos && activity.photos.length > 0) {
                // Clear existing featured images first
                this.clearFeaturedImages();
                
                // Import all photos to the background image list
                for (let i = 0; i < activity.photos.length; i++) {
                    const photo = activity.photos[i];
                    await this.importPhotoToList(photo.url, i === 0); // First photo becomes active background
                }
                
                // Reset square feed post to first image
                if (window.mediaGenerator) {
                    window.mediaGenerator.squareSliderIndex = 0;
                    window.mediaGenerator.updateSquareSlider();
                    window.mediaGenerator.generateAllPreviews();
                }
                
                // Import activity stats
                this.importActivityStats(activity);
                
                // Close modal
                this.hideActivitiesModal();
            } else {
                window.toast.warning('No photos found in this activity', 'Import Warning');
            }
            
            // Reset button
            button.disabled = false;
            button.textContent = originalText;
            
        } catch (error) {
            console.error('Error importing activity:', error);
            window.toast.error('Failed to import activity. Please try again.', 'Import Error');
            
            // Reset button
            const button = document.querySelector(`[data-activity-id="${activityId}"] .import-activity-btn`);
            if (button) {
                button.disabled = false;
                button.textContent = 'Import Activity';
            }
        }
    }

    showFeaturedImagesLoading() {
        // This method is no longer needed since placeholders are shown by default
        // Keeping it for backwards compatibility but it doesn't do anything
    }

    clearFeaturedImages() {
        // Clear existing featured images in the media generator
        if (window.mediaGenerator) {
            // Clear uploaded images array
            window.mediaGenerator.uploadedImages = [];
            
            // Update the image gallery to reflect the changes (will show default placeholders)
            window.mediaGenerator.updateImageGallery();
            window.mediaGenerator.updateSquareSlider();
            
            // Reset any selected image
            window.mediaGenerator.selectedImageIndex = -1;
            
            // Regenerate previews to show the cleared state
            window.mediaGenerator.generateAllPreviews();
        }
    }

    async loadRecentActivityPhotos() {
        // Load photos sequentially for only the first 5 activities to avoid rate limiting
        const recentActivities = this.activities.slice(0, 5);
        
        for (const activity of recentActivities) {
            try {
                await this.loadActivityPhotos(activity.id);
                // Small delay between activities to further reduce rate limiting
                await this.delay(500);
            } catch (error) {
                console.error(`Failed to load photos for activity ${activity.id}:`, error);
                // Continue with next activity even if one fails
            }
        }
    }

    async loadActivityPhotos(activityId) {
        try {
            const photosContainer = document.getElementById(`photos-${activityId}`);
            if (!photosContainer) return;
            
            // Show loading state
            const loadButton = photosContainer.querySelector('.load-photos-btn');
            if (loadButton) {
                loadButton.textContent = 'Loading...';
                loadButton.disabled = true;
                
                // Replace the load button with placeholders temporarily
                const activityData = this.activities.find(a => a.id.toString() === activityId);
                if (activityData) {
                    photosContainer.innerHTML = this.generatePhotoPlaceholders(activityData.total_photo_count);
                }
            }
            
            // Fetch detailed activity data with photos using rate-limited request
            const activity = await this.rateLimitedFetch(`${this.baseUrl}/api/activities/${activityId}`);
            
            if (activity.photos && activity.photos.length > 0) {
                // Replace placeholders with actual photos
                const placeholders = photosContainer.querySelectorAll('.photo-placeholder');
                const remainingIndicator = photosContainer.querySelector('.remaining-photos-indicator');
                
                activity.photos.forEach((photo, index) => {
                    // Use proxy URL to avoid CORS issues and benefit from caching
                    const proxyUrl = `${this.baseUrl}/api/proxy-image?url=${encodeURIComponent(photo.url)}`;
                    
                    if (index < placeholders.length) {
                        // Replace placeholder with actual photo
                        const placeholder = placeholders[index];
                        placeholder.outerHTML = `
                            <div class="photo-item">
                                <img src="${proxyUrl}" 
                                     alt="Activity photo" 
                                     class="activity-photo"
                                     data-activity-id="${activity.id}"
                                     data-photo-url="${photo.url}">
                            </div>
                        `;
                    } else if (index === placeholders.length && remainingIndicator) {
                        // Replace the "more" indicator with the next photo and update count
                        const remainingCount = activity.photos.length - placeholders.length - 1;
                        if (remainingCount > 0) {
                            remainingIndicator.outerHTML = `
                                <div class="photo-item">
                                    <img src="${proxyUrl}" 
                                         alt="Activity photo" 
                                         class="activity-photo"
                                         data-activity-id="${activity.id}"
                                         data-photo-url="${photo.url}">
                                </div>
                                <div class="photo-item remaining-photos-indicator">
                                    <div class="remaining-photos-count">
                                        +${remainingCount} more
                                    </div>
                                </div>
                            `;
                        } else {
                            remainingIndicator.outerHTML = `
                                <div class="photo-item">
                                    <img src="${proxyUrl}" 
                                         alt="Activity photo" 
                                         class="activity-photo"
                                         data-activity-id="${activity.id}"
                                         data-photo-url="${photo.url}">
                                </div>
                            `;
                        }
                    }
                });
                
                // Remove any remaining empty placeholders
                const remainingPlaceholders = photosContainer.querySelectorAll('.photo-placeholder');
                remainingPlaceholders.forEach(placeholder => placeholder.remove());
                
            } else {
                photosContainer.innerHTML = '<div class="no-photos">No photos available</div>';
            }
            
        } catch (error) {
            console.error('Error loading activity photos:', error);
            const photosContainer = document.getElementById(`photos-${activityId}`);
            if (photosContainer) {
                // Check if this was a manual load (activity index >= 5)
                const activityIndex = this.activities.findIndex(a => a.id.toString() === activityId);
                if (activityIndex >= 5) {
                    // Restore the load button for manual loading
                    photosContainer.innerHTML = `
                        <div class="load-photos-placeholder">
                            <button class="load-photos-btn" onclick="window.stravaIntegration.loadActivityPhotos('${activityId}')">
                                Load Photos
                            </button>
                        </div>
                    `;
                } else {
                    // For auto-loading activities, show error message
                    photosContainer.innerHTML = '<div class="error">Failed to load photos</div>';
                }
            }
        }
    }

    selectPhoto(photoUrl) {
        const photoElement = event.target;
        const activityId = photoElement.dataset.activityId;
        
        // Find the activity data
        const activity = this.activities.find(a => a.id.toString() === activityId);
        
        if (activity) {
            // Import activity stats
            this.importActivityStats(activity);
        }
        
        // Import the photo
        this.importPhoto(photoUrl);
    }

    async importPhoto(photoUrl) {
        try {
            // Use proxy URL to avoid CORS issues
            const proxyUrl = `${this.baseUrl}/api/proxy-image?url=${encodeURIComponent(photoUrl)}`;
            const response = await fetch(proxyUrl, {
                credentials: 'include'
            });
            const blob = await response.blob();
            
            // Create a File object
            const file = new File([blob], 'strava-photo.jpg', { type: 'image/jpeg' });
            
            // Trigger an event that your existing app can listen to
            window.dispatchEvent(new CustomEvent('stravaPhotoImported', {
                detail: { file, url: photoUrl }
            }));
            
        } catch (error) {
            console.error('Photo import error:', error);
            throw error;
        }
    }

    async importPhotoToList(photoUrl, setAsBackground = false) {
        try {
            // Use proxy URL to avoid CORS issues
            const proxyUrl = `${this.baseUrl}/api/proxy-image?url=${encodeURIComponent(photoUrl)}`;
            const response = await fetch(proxyUrl, {
                credentials: 'include'
            });
            const blob = await response.blob();
            
            // Create a File object
            const file = new File([blob], 'strava-photo.jpg', { type: 'image/jpeg' });
            
            // Trigger event to add to background image list
            window.dispatchEvent(new CustomEvent('stravaPhotoAddedToList', {
                detail: { 
                    file, 
                    url: photoUrl,
                    setAsBackground
                }
            }));
            
        } catch (error) {
            console.error('Photo import to list error:', error);
            throw error;
        }
    }

    importActivityStats(activity) {
        // This will integrate with your existing media generator
        // You can customize how the stats are displayed
        const statsData = {
            title: activity.name,
            distance: `${(activity.distance / 1000).toFixed(1)} km`,
            time: `${Math.floor(activity.moving_time / 3600)}:${String(Math.floor((activity.moving_time % 3600) / 60)).padStart(2, '0')}`,
            elevation: `${Math.round(activity.total_elevation_gain)}m`,
            speed: activity.average_speed ? `${(activity.average_speed * 3.6).toFixed(1)} km/h` : null,
            heartrate: activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : null,
            description: activity.description || ''
        };
        
        // Update the description field
        this.updateDescription(statsData.description);
        
        // Trigger an event that your existing app can listen to
        window.dispatchEvent(new CustomEvent('stravaActivityImported', {
            detail: { activity, statsData }
        }));
    }

    updateDescription(description) {
        const descriptionField = document.getElementById('post-description');
        
        if (descriptionField) {
            descriptionField.value = description;
        }
    }

    getCurrentDescription() {
        const descriptionField = document.getElementById('post-description');
        return descriptionField ? descriptionField.value : '';
    }

    clearDescription() {
        this.updateDescription('');
    }


}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.stravaIntegration = new StravaIntegration();
}); 