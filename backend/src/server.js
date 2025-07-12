const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');

// Import our custom modules
const config = require('./config');
const { 
    getImageCacheStatus, 
    clearImageCache, 
    getApiCacheStatus, 
    clearApiCache 
} = require('./cache');
const { router: stravaRouter } = require('./strava');

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            config.urls.frontend,
            // Support network access patterns
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
            /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/
        ];
        
        const isAllowed = allowedOrigins.some(pattern => {
            if (typeof pattern === 'string') {
                return origin === pattern;
            } else if (pattern instanceof RegExp) {
                return pattern.test(origin);
            }
            return false;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const origin = req.get('Origin') || 'No Origin';
    
    console.log(`[${timestamp}] ${method} ${url} - Origin: ${origin} - UA: ${userAgent.substring(0, 50)}`);
    
    // Log response when it finishes
    const originalSend = res.send;
    res.send = function(data) {
        const endTime = new Date().toISOString();
        console.log(`[${endTime}] ${method} ${url} - Status: ${res.statusCode} - Size: ${data ? data.length : 0} bytes`);
        originalSend.call(this, data);
    };
    
    next();
});

app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: config.server.sessionSecret,
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

// Error handling middleware
app.use((error, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR on ${req.method} ${req.url}:`, error.message);
    console.error('Error stack:', error.stack);
    
    // Don't leak error details in production
    const isDevelopment = config.server.nodeEnv === 'development';
    
    res.status(error.status || 500).json({
        error: isDevelopment ? error.message : 'Internal server error',
        ...(isDevelopment && { stack: error.stack })
    });
});

// 404 handler
app.use((req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 404 - ${req.method} ${req.url} not found`);
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Cycling Media Backend running on port ${PORT}`);
    console.log(`🔑 Strava OAuth available`);
    console.log(`🌐 Frontend URL: ${config.urls.frontend}`);
    console.log(`🌐 Backend URL: ${config.urls.backend}`);
    console.log(`📁 Cache directory: /tmp/strava-images`);
    console.log(`⏱️  API Cache TTL: 48 hours`);
    console.log(`\n📋 Available API Endpoints:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /api/config - Configuration`);
    console.log(`   GET  /api/user - User profile`);
    console.log(`   GET  /api/activities - Activities list`);
    console.log(`   GET  /api/activities/:id - Activity details`);
    console.log(`   GET  /api/activities/:id/streams - GPS streams`);
    console.log(`   GET  /api/proxy-image - Image proxy`);
    console.log(`   GET  /auth/strava - OAuth login`);
    console.log(`   GET  /auth/strava/callback - OAuth callback`);
    console.log(`   POST /api/logout - Logout`);
    console.log(`   GET  /api/cache/status - Cache status`);
    console.log(`   DELETE /api/cache/clear - Clear cache`);
    console.log(`\n🔥 Request logging enabled`);
    console.log(`📊 Error tracking enabled`);
}); 