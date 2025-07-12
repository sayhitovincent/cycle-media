require('dotenv').config();

// Central configuration object
const config = {
    server: {
        port: process.env.PORT || 3001,
        sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
        nodeEnv: process.env.NODE_ENV || 'development'
    },
    urls: {
        backend: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`,
        frontend: process.env.FRONTEND_URL || 'http://localhost:8567'
    },
    strava: {
        clientId: process.env.STRAVA_CLIENT_ID,
        clientSecret: process.env.STRAVA_CLIENT_SECRET,
        redirectUri: process.env.STRAVA_REDIRECT_URI,
        authUrl: 'https://www.strava.com/oauth/authorize',
        tokenUrl: 'https://www.strava.com/oauth/token',
        apiUrl: 'https://www.strava.com/api/v3'
    }
};

// Validation function
function validateConfig() {
    const required = [
        'strava.clientId',
        'strava.clientSecret', 
        'strava.redirectUri'
    ];
    
    for (const key of required) {
        const value = key.split('.').reduce((obj, k) => obj?.[k], config);
        if (!value) {
            throw new Error(`Missing required environment variable for: ${key}`);
        }
    }
}

// Validate configuration on load
validateConfig();

module.exports = config; 