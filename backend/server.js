const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8567',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Store user tokens (in production, use a database)
const userTokens = {};

// Strava API configuration
const STRAVA_CONFIG = {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    redirectUri: process.env.STRAVA_REDIRECT_URI,
    authUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    apiUrl: 'https://www.strava.com/api/v3'
};

// Cache configuration
const CACHE_CONFIG = {
    baseDir: '/tmp/strava-images',
    // No expiration - Strava URLs are unique so we can cache indefinitely
};

// Cache utility functions
async function ensureCacheDir(userId) {
    const userCacheDir = path.join(CACHE_CONFIG.baseDir, userId.toString());
    try {
        await fs.mkdir(userCacheDir, { recursive: true });
        return userCacheDir;
    } catch (error) {
        console.error('Failed to create cache directory:', error);
        throw error;
    }
}

function getCacheKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

async function getCachedImage(userId, url) {
    try {
        const userCacheDir = await ensureCacheDir(userId);
        const cacheKey = getCacheKey(url);
        const cachePath = path.join(userCacheDir, `${cacheKey}.jpg`);
        const metaPath = path.join(userCacheDir, `${cacheKey}.meta`);
        
        // Check if cache file exists
        const [imageStats, metaStats] = await Promise.all([
            fs.stat(cachePath).catch(() => null),
            fs.stat(metaPath).catch(() => null)
        ]);
        
        if (!imageStats || !metaStats) {
            return null; // Cache miss
        }
        
        // Since Strava URLs are unique, we cache indefinitely
        // Read metadata
        const metaData = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        
        return {
            path: cachePath,
            contentType: metaData.contentType || 'image/jpeg',
            originalUrl: metaData.originalUrl,
            cachedAt: metaData.cachedAt
        };
    } catch (error) {
        console.error('Cache read error:', error);
        return null;
    }
}

async function setCachedImage(userId, url, imageBuffer, contentType) {
    try {
        const userCacheDir = await ensureCacheDir(userId);
        const cacheKey = getCacheKey(url);
        const cachePath = path.join(userCacheDir, `${cacheKey}.jpg`);
        const metaPath = path.join(userCacheDir, `${cacheKey}.meta`);
        
        // Save image and metadata
        const metaData = {
            originalUrl: url,
            contentType: contentType || 'image/jpeg',
            cachedAt: new Date().toISOString()
        };
        
        await Promise.all([
            fs.writeFile(cachePath, imageBuffer),
            fs.writeFile(metaPath, JSON.stringify(metaData, null, 2))
        ]);
        
        return cachePath;
    } catch (error) {
        console.error('Cache write error:', error);
        throw error;
    }
}

// OAuth Routes
app.get('/auth/strava', (req, res) => {
    const authUrl = `${STRAVA_CONFIG.authUrl}?client_id=${STRAVA_CONFIG.clientId}&response_type=code&redirect_uri=${STRAVA_CONFIG.redirectUri}&approval_prompt=force&scope=read,activity:read_all`;
    res.redirect(authUrl);
});

app.get('/auth/strava/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    try {
        const tokenResponse = await axios.post(STRAVA_CONFIG.tokenUrl, {
            client_id: STRAVA_CONFIG.clientId,
            client_secret: STRAVA_CONFIG.clientSecret,
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

        res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);
        res.redirect(`${process.env.FRONTEND_URL}?error=oauth_failed`);
    }
});

// API Routes
app.get('/api/user', (req, res) => {
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

app.get('/api/activities', async (req, res) => {
    if (!req.session.userId || !userTokens[req.session.userId]) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = userTokens[req.session.userId];
        const response = await axios.get(`${STRAVA_CONFIG.apiUrl}/athlete/activities`, {
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
        
        res.json(activitiesWithPhotos.map(activity => ({
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
        })));
    } catch (error) {
        console.error('Activities fetch error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

app.get('/api/activities/:id', async (req, res) => {
    if (!req.session.userId || !userTokens[req.session.userId]) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = userTokens[req.session.userId];
        const activityId = req.params.id;
        
        // Fetch detailed activity data
        const [activityResponse, photosResponse] = await Promise.all([
            axios.get(`${STRAVA_CONFIG.apiUrl}/activities/${activityId}`, {
                headers: { 'Authorization': `Bearer ${user.accessToken}` }
            }),
            axios.get(`${STRAVA_CONFIG.apiUrl}/activities/${activityId}/photos`, {
                headers: { 'Authorization': `Bearer ${user.accessToken}` },
                params: { size: 2048 } // Highest resolution
            })
        ]);

        const activity = activityResponse.data;
        const photos = photosResponse.data;

        res.json({
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
        });
    } catch (error) {
        console.error('Activity detail fetch error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Failed to fetch activity details' });
    }
});

// Image proxy with caching to handle CORS and reduce API calls
app.get('/api/proxy-image', async (req, res) => {
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
                'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:8567',
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
            'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:8567',
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

app.post('/api/logout', (req, res) => {
    if (req.session.userId) {
        delete userTokens[req.session.userId];
        req.session.destroy();
    }
    res.json({ success: true });
});

// Cache management endpoints
app.get('/api/cache/status', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const userCacheDir = path.join(CACHE_CONFIG.baseDir, userId.toString());
        
        try {
            const files = await fs.readdir(userCacheDir);
            const imageFiles = files.filter(file => file.endsWith('.jpg'));
            const metaFiles = files.filter(file => file.endsWith('.meta'));
            
            // Get total cache size
            let totalSize = 0;
            for (const file of files) {
                const filePath = path.join(userCacheDir, file);
                const stats = await fs.stat(filePath).catch(() => null);
                if (stats) totalSize += stats.size;
            }
            
            res.json({
                userId: userId,
                cachedImages: imageFiles.length,
                metaFiles: metaFiles.length,
                totalSizeBytes: totalSize,
                totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                cacheDir: userCacheDir,
                cachePolicy: 'indefinite - URLs are unique'
            });
        } catch (error) {
            // Cache directory doesn't exist yet
            res.json({
                userId: userId,
                cachedImages: 0,
                metaFiles: 0,
                totalSizeBytes: 0,
                totalSizeMB: 0,
                cacheDir: userCacheDir,
                cachePolicy: 'indefinite - URLs are unique'
            });
        }
    } catch (error) {
        console.error('Cache status error:', error);
        res.status(500).json({ error: 'Failed to get cache status' });
    }
});

app.delete('/api/cache/clear', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const userCacheDir = path.join(CACHE_CONFIG.baseDir, userId.toString());
        
        try {
            const files = await fs.readdir(userCacheDir);
            let deletedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(userCacheDir, file);
                await fs.unlink(filePath);
                deletedCount++;
            }
            
            res.json({ 
                message: 'Cache cleared successfully',
                deletedFiles: deletedCount,
                userId: userId
            });
        } catch (error) {
            // Cache directory doesn't exist
            res.json({ 
                message: 'No cache to clear',
                deletedFiles: 0,
                userId: userId
            });
        }
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Strava branding requirements endpoint
app.get('/api/strava-branding', (req, res) => {
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

app.listen(PORT, () => {
    console.log(`🚀 Cycling Media Backend running on port ${PORT}`);
    console.log(`🔑 Strava OAuth: ${STRAVA_CONFIG.authUrl}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8567'}`);
}); 