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
        // Add connect button to sidebar
        this.addConnectButtonToSidebar();
        
        // Create activities modal
        this.createActivitiesModal();
    }

    addConnectButtonToSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const stravaConnectDiv = document.createElement('div');
        stravaConnectDiv.className = 'strava-connect-section';
        stravaConnectDiv.innerHTML = `
            <div id="strava-auth" class="strava-auth">
                <svg id="strava-login-btn" class="strava-connect-btn" width="237" height="48" viewBox="0 0 237 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="236.867" height="48" rx="6" fill="#FC5200"/>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M180.749 31.8195L180.748 31.8188H185.357L188.188 26.1268L191.019 31.8188H196.618L188.187 15.5403L180.184 30.9945L177.111 26.5078C179.008 25.5928 180.191 24.0081 180.191 21.7318V21.687C180.191 20.0803 179.7 18.9197 178.763 17.9822C177.669 16.8887 175.906 16.1968 173.139 16.1968H165.506V31.8195H170.728V27.3558H171.844L174.79 31.8195H180.749ZM212.954 15.5403L204.524 31.8188H210.124L212.955 26.1268L215.786 31.8188H221.385L212.954 15.5403ZM200.576 32.4593L209.006 16.1808H203.406L200.575 21.8729L197.744 16.1808H192.144L200.576 32.4593ZM172.982 23.6287C174.232 23.6287 174.991 23.0708 174.991 22.1112V22.0663C174.991 21.0621 174.21 20.5711 173.005 20.5711H170.728V23.6287H172.982ZM154.337 20.6158H149.74V16.1968H164.157V20.6158H159.56V31.8195H154.337V20.6158ZM137.015 26.1507L134.225 29.4761C136.211 31.2172 139.068 32.1097 142.237 32.1097C146.433 32.1097 149.133 30.101 149.133 26.82V26.7756C149.133 23.6287 146.455 22.468 142.46 21.7318C140.808 21.419 140.384 21.1515 140.384 20.7273V20.6827C140.384 20.3033 140.742 20.0355 141.523 20.0355C142.973 20.0355 144.737 20.5042 146.209 21.5754L148.754 18.0493C146.946 16.6209 144.714 15.9065 141.701 15.9065C137.394 15.9065 135.073 18.2055 135.073 21.1737V21.2185C135.073 24.5214 138.153 25.526 141.656 26.2398C143.33 26.5747 143.821 26.82 143.821 27.2665V27.3113C143.821 27.7352 143.42 27.9805 142.482 27.9805C140.652 27.9805 138.711 27.4452 137.015 26.1507Z" fill="white"/>
                    <path d="M117.92 31.6812V21.9622H119.919V25.7533H124.137V21.9622H126.136V31.6812H124.137V27.5179H119.919V31.6812H117.92Z" fill="white"/>
                    <path d="M110.959 31.6812V23.713H107.844V21.9622H116.088V23.713H112.958V31.6812H110.959Z" fill="white"/>
                    <path d="M104.02 31.6812V21.9622H106.018V31.6812H104.02Z" fill="white"/>
                    <path d="M92.1013 31.6812L89.5371 21.9622H91.6464L92.7492 27.2008C92.8871 27.9039 93.0112 28.4691 93.1352 29.3376H93.1904C93.3282 28.607 93.4109 28.152 93.6315 27.187L94.8723 21.9622H96.9677L98.2084 27.187C98.429 28.152 98.5117 28.607 98.6496 29.3376H98.7047C98.8288 28.4691 98.9529 27.9039 99.0907 27.2008L100.207 21.9622H102.303L99.7387 31.6812H97.657L96.4301 26.4977C96.2646 25.7671 96.1543 25.2846 95.9476 24.2782H95.8924C95.6856 25.2846 95.5753 25.7671 95.4099 26.4977L94.183 31.6812H92.1013Z" fill="white"/>
                    <path d="M79.9965 31.6812V23.713H76.8809V21.9622H85.1248V23.713H81.9954V31.6812H79.9965Z" fill="white"/>
                    <path d="M71.524 31.888C68.7806 31.888 66.9746 29.8753 66.9746 26.8148C66.9746 23.7681 68.7806 21.7554 71.524 21.7554C73.6883 21.7554 75.3151 23.0237 75.577 24.8434L73.5781 25.3121C73.3575 24.1955 72.5855 23.5338 71.4964 23.5338C69.9799 23.5338 69.0287 24.7883 69.0287 26.8148C69.0287 28.8413 69.9799 30.1096 71.4964 30.1096C72.5855 30.1096 73.3575 29.4479 73.5781 28.345L75.577 28.8138C75.3151 30.6335 73.6883 31.888 71.524 31.888Z" fill="white"/>
                    <path d="M58.459 31.6812V21.9622H65.2003V23.6578H60.4579V25.8636H64.8556V27.5041H60.4579V29.9856H65.2003V31.6812H58.459Z" fill="white"/>
                    <path d="M47.7656 31.6812V21.9622H49.9576L52.9216 26.9113C53.3765 27.6557 53.6798 28.2899 54.0106 28.993H54.0796L54.0382 26.5115V21.9622H55.9407V31.6812H53.7487L50.771 26.7321C50.3298 25.9876 50.0265 25.3673 49.6819 24.6504H49.6267L49.6681 27.1319V31.6812H47.7656Z" fill="white"/>
                    <path d="M37.0742 31.6812V21.9622H39.2662L42.2301 26.9113C42.6851 27.6557 42.9884 28.2899 43.3192 28.993H43.3882L43.3468 26.5115V21.9622H45.2493V31.6812H43.0573L40.0795 26.7321C39.6384 25.9876 39.3351 25.3673 38.9905 24.6504H38.9353L38.9767 27.1319V31.6812H37.0742Z" fill="white"/>
                    <path d="M30.2903 31.888C27.4642 31.888 25.6582 29.8201 25.6582 26.8148C25.6582 23.8233 27.4642 21.7554 30.2903 21.7554C33.1164 21.7554 34.9223 23.8233 34.9223 26.8148C34.9223 29.8201 33.1164 31.888 30.2903 31.888ZM30.2903 30.1096C31.8481 30.1096 32.8682 28.9378 32.8682 26.8148C32.8682 24.6918 31.8481 23.5338 30.2903 23.5338C28.7325 23.5338 27.7123 24.6918 27.7123 26.8148C27.7123 28.9378 28.7325 30.1096 30.2903 30.1096Z" fill="white"/>
                    <path d="M19.9868 31.888C17.2435 31.888 15.4375 29.8753 15.4375 26.8148C15.4375 23.7681 17.2435 21.7554 19.9868 21.7554C22.1512 21.7554 23.778 23.0237 24.0399 24.8434L22.0409 25.3121C21.8204 24.1955 21.0484 23.5338 19.9593 23.5338C18.4428 23.5338 17.4916 24.7883 17.4916 26.8148C17.4916 28.8413 18.4428 30.1096 19.9593 30.1096C21.0484 30.1096 21.8204 29.4479 22.0409 28.345L24.0399 28.8138C23.778 30.6335 22.1512 31.888 19.9868 31.888Z" fill="white"/>
                </svg>
                <div id="strava-user" class="strava-user hidden">
                    <div class="user-info">
                        <img id="user-avatar" class="user-avatar" src="" alt="">
                        <span id="user-name"></span>
                    </div>
                    <div class="strava-buttons">
                        <button id="browse-activities-btn" class="browse-btn">Activities</button>
                        <button id="strava-logout-btn" class="logout-btn">Logout</button>
                    </div>
                </div>
            </div>
        `;

        // Insert at the beginning of sidebar
        sidebar.insertBefore(stravaConnectDiv, sidebar.firstChild);
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
                    <div id="activities-list" class="activities-list">
                        <div class="loading">Loading activities...</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'strava-login-btn' || e.target.closest('#strava-login-btn')) {
                this.login();
            } else if (e.target.id === 'strava-logout-btn') {
                this.logout();
            } else if (e.target.id === 'browse-activities-btn') {
                this.showActivitiesModal();
            
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
            this.loadActivities();
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

    showAuthenticatedUI() {
        document.getElementById('strava-login-btn').style.display = 'none';
        const userElement = document.getElementById('strava-user');
        userElement.classList.remove('hidden');
        
        document.getElementById('user-avatar').src = this.user.profile || '';
        document.getElementById('user-name').textContent = 
            `${this.user.firstname} ${this.user.lastname}`;
    }

    showUnauthenticatedUI() {
        document.getElementById('strava-login-btn').style.display = 'inline-block';
        document.getElementById('strava-user').classList.add('hidden');
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
            this.activities = await this.rateLimitedFetch(`${this.baseUrl}/api/activities`);
            await this.renderActivities();
        } catch (error) {
            console.error('Error loading activities:', error);
            document.getElementById('activities-list').innerHTML = 
                '<div class="error">Failed to load activities</div>';
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
            
            // Clear photos for this activity
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
            
            window.toast.success('Activity refreshed successfully', 'Refresh Complete');
            
        } catch (error) {
            console.error('Error refreshing activity:', error);
            window.toast.error('Failed to refresh activity', 'Refresh Error');
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
                
                // Import activity stats
                this.importActivityStats(activity);
                
                // Close modal
                this.hideActivitiesModal();
                
                // Show success message
                window.toast.success(
                    `Imported ${activity.photos.length} photos from "${activity.name}"`,
                    'Activity Import Complete'
                );
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

    clearFeaturedImages() {
        // Clear existing featured images in the media generator
        if (window.mediaGenerator) {
            // Clear uploaded images array
            window.mediaGenerator.uploadedImages = [];
            
            // Update the image gallery to reflect the changes
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
            heartrate: activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : null
        };
        
        // Trigger an event that your existing app can listen to
        window.dispatchEvent(new CustomEvent('stravaActivityImported', {
            detail: { activity, statsData }
        }));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.stravaIntegration = new StravaIntegration();
}); 