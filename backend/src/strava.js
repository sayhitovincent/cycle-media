const express = require('express');
const axios = require('axios');
const config = require('./config');
const {
    getApiCacheKey,
    getApiCachedResponse,
    setApiCachedResponse,
    getCachedImage,
    setCachedImage,
    clearApiCache,
    clearImageCache,
    getApiCacheStatus,
    getImageCacheStatus
} = require('./cache');

const router = express.Router();

// Store user tokens (in production, use a database)
const userTokens = {};

// Configuration endpoint
router.get('/api/config', (req, res) => {
    const clientConfig = {
        backend: {
            url: config.urls.backend
        },
        strava: {
            clientId: config.strava.clientId,
            redirectUri: config.strava.redirectUri
        },
        environment: config.server.nodeEnv
    };
    
    res.json(clientConfig);
});

// OAuth Routes
router.get('/auth/strava', (req, res) => {
    const authUrl = `${config.strava.authUrl}?client_id=${config.strava.clientId}&response_type=code&redirect_uri=${config.strava.redirectUri}&approval_prompt=force&scope=read,activity:read_all`;
    res.redirect(authUrl);
});

router.get('/auth/strava/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect(`${config.urls.frontend}?error=no_code`);
    }

    try {
        const tokenResponse = await axios.post(config.strava.tokenUrl, {
            client_id: config.strava.clientId,
            client_secret: config.strava.clientSecret,
            code: code,
            grant_type: 'authorization_code'
        });

        const { access_token, refresh_token, athlete } = tokenResponse.data;
        
        // Store tokens (in production, use secure database)
        req.session.userId = athlete.id;
        userTokens[athlete.id] = {
            accessToken: access_token,
            refreshToken: refresh_token,
            athlete: athlete
        };

        res.redirect(`${config.urls.frontend}?auth=success`);
    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);
        res.redirect(`${config.urls.frontend}?error=oauth_failed`);
    }
});

// API Routes
router.get('/api/user', (req, res) => {
    if (!req.session.userId || !userTokens[req.session.userId]) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = userTokens[req.session.userId];
    res.json({
        id: user.athlete.id,
        username: user.athlete.username,
        firstname: user.athlete.firstname,
        lastname: user.athlete.lastname,
        profile: user.athlete.profile,
        authenticated: true
    });
});

router.get('/api/activities', async (req, res) => {
    if (!req.session.userId || !userTokens[req.session.userId]) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userId;
    const cacheKey = getApiCacheKey(userId, 'activities', { per_page: 30, page: 1 });
    
    // Check cache first
    const cachedResponse = getApiCachedResponse(cacheKey);
    if (cachedResponse) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
    }

    try {
        const user = userTokens[req.session.userId];
        const response = await axios.get(`${config.strava.apiUrl}/athlete/activities`, {
            headers: {
                'Authorization': `Bearer ${user.accessToken}`
            },
            params: {
                per_page: 30,
                page: 1
            }
        });

        // Filter for activities with photos
        const activitiesWithPhotos = response.data.filter(activity => activity.total_photo_count > 0);
        
        const processedActivities = activitiesWithPhotos.map(activity => ({
            id: activity.id,
            name: activity.name,
            type: activity.type,
            sport_type: activity.sport_type,
            start_date: activity.start_date,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            total_elevation_gain: activity.total_elevation_gain,
            average_speed: activity.average_speed,
            max_speed: activity.max_speed,
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate,
            total_photo_count: activity.total_photo_count,
            map: activity.map
        }));
        
        // Cache the response
        setApiCachedResponse(cacheKey, processedActivities);
        
        res.set('X-Cache', 'MISS');
        res.json(processedActivities);
    } catch (error) {
        console.error('Activities fetch error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

router.get('/api/activities/:id', async (req, res) => {
    const timestamp = new Date().toISOString();
    const activityId = req.params.id;
    console.log(`[${timestamp}] 🚴 Activity detail request for ${activityId}`);
    
    if (!req.session.userId || !userTokens[req.session.userId]) {
        console.log(`[${timestamp}] ❌ Activity detail unauthorized - no session/token`);
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userId;
    const cacheKey = getApiCacheKey(userId, `activity_${activityId}`, { size: 2048 });
    
    // Check cache first
    const cachedResponse = getApiCachedResponse(cacheKey);
    if (cachedResponse) {
        console.log(`[${timestamp}] 📦 Activity detail cache HIT for ${activityId}`);
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
    }

    try {
        const user = userTokens[req.session.userId];
        
        // Fetch detailed activity data
        const [activityResponse, photosResponse] = await Promise.all([
            axios.get(`${config.strava.apiUrl}/activities/${activityId}`, {
                headers: { 'Authorization': `Bearer ${user.accessToken}` }
            }),
            axios.get(`${config.strava.apiUrl}/activities/${activityId}/photos`, {
                headers: { 'Authorization': `Bearer ${user.accessToken}` },
                params: { size: 2048 } // Highest resolution
            })
        ]);

        const activity = activityResponse.data;
        const photos = photosResponse.data;

        const processedActivity = {
            id: activity.id,
            name: activity.name,
            description: activity.description,
            type: activity.type,
            sport_type: activity.sport_type,
            start_date: activity.start_date,
            start_date_local: activity.start_date_local,
            timezone: activity.timezone,
            
            // Distance and time stats
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            
            // Elevation stats
            total_elevation_gain: activity.total_elevation_gain,
            elev_high: activity.elev_high,
            elev_low: activity.elev_low,
            
            // Speed stats
            average_speed: activity.average_speed,
            max_speed: activity.max_speed,
            
            // Heart rate stats
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate,
            
            // Power stats (if available)
            average_watts: activity.average_watts,
            max_watts: activity.max_watts,
            weighted_average_watts: activity.weighted_average_watts,
            
            // Cadence stats (if available)
            average_cadence: activity.average_cadence,
            
            // Temperature (if available)
            average_temp: activity.average_temp,
            
            // Calories and other stats
            calories: activity.calories,
            device_name: activity.device_name,
            
            // Map data
            map: activity.map,
            
            // Photos with highest resolution
            photos: photos.map(photo => ({
                id: photo.id,
                source: photo.source,
                unique_id: photo.unique_id,
                urls: photo.urls,
                caption: photo.caption,
                type: photo.type,
                uploaded_at: photo.uploaded_at,
                created_at: photo.created_at,
                // Use the highest resolution available
                url: photo.urls?.['2048'] || photo.urls?.['1024'] || photo.urls?.['600'] || photo.urls?.['300']
            }))
        };
        
        // Cache the response
        setApiCachedResponse(cacheKey, processedActivity);
        
        res.set('X-Cache', 'MISS');
        res.json(processedActivity);
    } catch (error) {
        console.error('Activity detail fetch error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Failed to fetch activity details' });
    }
});

// Activity streams endpoint for detailed GPS data with timestamps
router.get('/api/activities/:id/streams', async (req, res) => {
    const timestamp = new Date().toISOString();
    const activityId = req.params.id;
    console.log(`[${timestamp}] 🗺️  Streams request for activity ${activityId}`);
    
    if (!req.session.userId || !userTokens[req.session.userId]) {
        console.log(`[${timestamp}] ❌ Streams request unauthorized - no session/token`);
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userId;
    const cacheKey = getApiCacheKey(userId, `streams_${activityId}`, {});
    
    // Check cache first
    const cachedResponse = getApiCachedResponse(cacheKey);
    if (cachedResponse) {
        console.log(`[${timestamp}] 📦 Streams cache HIT for activity ${activityId}`);
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
    }

    try {
        const user = userTokens[req.session.userId];
        console.log(`[${timestamp}] 🌐 Fetching streams from Strava API for activity ${activityId}`);
        
        // Fetch activity streams (GPS coordinates and timestamps)
        // Request high resolution data with more parameters for better GPS tracking
        const response = await axios.get(`${config.strava.apiUrl}/activities/${activityId}/streams/latlng,time,distance,altitude`, {
            headers: { 'Authorization': `Bearer ${user.accessToken}` },
            params: {
                resolution: 'high',  // Request high resolution data points
                series_type: 'time'  // Sample based on time intervals
            }
        });

        const streams = response.data;
        let processedStreams = {};
        let coordinateCount = 0;
        let timestampCount = 0;
        let distanceCount = 0;
        let altitudeCount = 0;

        // Process streams into a more usable format
        streams.forEach(stream => {
            if (stream.type === 'latlng') {
                processedStreams.coordinates = stream.data; // Array of [lat, lng] pairs
                coordinateCount = stream.data.length;
            } else if (stream.type === 'time') {
                processedStreams.timestamps = stream.data; // Array of seconds from start
                timestampCount = stream.data.length;
            } else if (stream.type === 'distance') {
                processedStreams.distances = stream.data; // Array of cumulative distances in meters
                distanceCount = stream.data.length;
            } else if (stream.type === 'altitude') {
                processedStreams.altitudes = stream.data; // Array of altitude values in meters
                altitudeCount = stream.data.length;
            }
        });

        console.log(`[${timestamp}] ✅ Streams processed: ${coordinateCount} coordinates, ${timestampCount} timestamps, ${distanceCount} distances, ${altitudeCount} altitudes`);

        // Cache the response
        setApiCachedResponse(cacheKey, processedStreams);
        
        res.set('X-Cache', 'MISS');
        res.json(processedStreams);
    } catch (error) {
        console.error(`[${timestamp}] ❌ Activity streams fetch error for ${activityId}:`, error.response?.data || error.message);
        if (error.response?.status === 401) {
            console.log(`[${timestamp}] 🔑 Token expired for user ${userId}`);
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.response?.status === 404) {
            console.log(`[${timestamp}] 📍 No GPS data available for activity ${activityId}`);
            return res.status(404).json({ error: 'No GPS data available for this activity' });
        }
        console.error(`[${timestamp}] 💥 Unexpected error:`, error.stack);
        res.status(500).json({ error: 'Failed to fetch activity streams' });
    }
});

// Image proxy with caching to handle CORS and reduce API calls
router.get('/api/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ error: 'URL parameter required' });
        }

        // Check if user is authenticated
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const userId = req.session.userId;

        // Try to get from cache first
        const cachedImage = await getCachedImage(userId, imageUrl);
        
        if (cachedImage) {
            // Serve from cache
            res.set({
                'Content-Type': cachedImage.contentType,
                'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
                'Access-Control-Allow-Origin': config.urls.frontend,
                'Access-Control-Allow-Credentials': 'true',
                'X-Cache': 'HIT',
                'X-Cache-Date': cachedImage.cachedAt
            });
            
            const imageStream = require('fs').createReadStream(cachedImage.path);
            
            // Handle stream errors properly
            imageStream.on('error', (error) => {
                console.error('Stream error for cached image:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to serve cached image' });
                }
            });
            
            imageStream.pipe(res);
            return;
        }

        // Cache miss - fetch from original URL
        console.log(`Cache miss for user ${userId}, fetching: ${imageUrl}`);
        
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Cycling Media Generator/1.0'
            }
        });

        console.log(`Successfully fetched image: ${imageUrl}, size: ${response.data.byteLength} bytes, type: ${response.headers['content-type']}`);

        const contentType = response.headers['content-type'] || 'image/jpeg';
        const imageBuffer = Buffer.from(response.data);

        // Validate image buffer
        if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error('Empty image buffer received');
        }

        // Cache the image
        try {
            await setCachedImage(userId, imageUrl, imageBuffer, contentType);
            console.log(`Cached image for user ${userId}`);
        } catch (cacheError) {
            console.error('Failed to cache image:', cacheError);
            // Continue serving even if caching fails
        }

        // Set appropriate headers
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            'Access-Control-Allow-Origin': config.urls.frontend,
            'Access-Control-Allow-Credentials': 'true',
            'X-Cache': 'MISS'
        });

        res.send(imageBuffer);
    } catch (error) {
        console.error('Image proxy error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to fetch image' });
        }
    }
});

// Cache management endpoints
router.get('/api/cache/status', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const [apiCacheStatus, imageCacheStatus] = await Promise.all([
            getApiCacheStatus(userId),
            getImageCacheStatus(userId)
        ]);

        res.json({
            userId: userId,
            api: apiCacheStatus,
            images: imageCacheStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Cache status error:', error);
        res.status(500).json({ error: 'Failed to get cache status' });
    }
});

router.delete('/api/cache', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const [apiResult, imageResult] = await Promise.all([
            clearApiCache(userId),
            clearImageCache(userId)
        ]);

        res.json({
            message: 'All cache cleared successfully',
            api: apiResult,
            images: imageResult,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

router.delete('/api/cache/api', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const result = clearApiCache(userId);
        res.json({
            message: 'API cache cleared successfully',
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('API cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear API cache' });
    }
});

router.delete('/api/cache/api/:endpoint', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const endpoint = req.params.endpoint;
        const result = clearApiCache(userId, endpoint);
        res.json({
            message: `API cache cleared for endpoint: ${endpoint}`,
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Endpoint cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear endpoint cache' });
    }
});

router.delete('/api/cache/images', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const result = await clearImageCache(userId);
        res.json({
            message: 'Image cache cleared successfully',
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Image cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear image cache' });
    }
});

router.post('/api/logout', (req, res) => {
    if (req.session.userId) {
        delete userTokens[req.session.userId];
        req.session.destroy();
    }
    res.json({ success: true });
});

// Strava branding requirements endpoint
router.get('/api/strava-branding', (req, res) => {
    res.json({
        requirements: {
            logo: 'Must display "Powered by Strava" logo',
            colors: {
                orange: '#FC4C02',
                dark: '#2D2D2D'
            },
            attribution: 'Data provided by Strava API',
            links: {
                logo: 'https://developers.strava.com/guidelines/',
                terms: 'https://www.strava.com/terms'
            }
        }
    });
});

// Helper function to get user tokens (for use by other modules)
function getUserTokens() {
    return userTokens;
}

// Helper function to get Strava config (for use by other modules)
function getStravaConfig() {
    return config.strava;
}

module.exports = {
    router,
    getUserTokens,
    getStravaConfig
}; 