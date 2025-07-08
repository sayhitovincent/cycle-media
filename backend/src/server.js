const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import our custom modules
const { 
    getImageCacheStatus, 
    clearImageCache, 
    getApiCacheStatus, 
    clearApiCache 
} = require('./cache');
const { router: stravaRouter } = require('./strava');

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

// Use Strava routes
app.use('/', stravaRouter);

// Cache management endpoints
app.get('/api/cache/status', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const imageStatus = await getImageCacheStatus(userId);
        
        res.json(imageStatus);
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
        const result = await clearImageCache(userId);
        
        res.json(result);
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// API Cache management endpoints
app.get('/api/cache/api-status', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const apiStatus = getApiCacheStatus(userId);
        
        res.json(apiStatus);
    } catch (error) {
        console.error('API cache status error:', error);
        res.status(500).json({ error: 'Failed to get API cache status' });
    }
});

app.delete('/api/cache/api-clear', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;
        const endpoint = req.query.endpoint; // Optional: clear specific endpoint
        
        const result = clearApiCache(userId, endpoint);
        
        res.json(result);
    } catch (error) {
        console.error('API cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear API cache' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Cycling Media Backend running on port ${PORT}`);
    console.log(`🔑 Strava OAuth available`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8567'}`);
    console.log(`📁 Cache directory: /tmp/strava-images`);
    console.log(`⏱️  API Cache TTL: 48 hours`);
}); 