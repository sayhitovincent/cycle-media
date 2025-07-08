const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// API response cache (in production, use Redis or similar)
const apiCache = new Map();

// Cache configuration
const CACHE_CONFIG = {
    baseDir: '/tmp/strava-images',
    // No expiration - Strava URLs are unique so we can cache indefinitely
    apiCacheTtl: 48 * 60 * 60 * 1000, // 48 hours in milliseconds
};

// API Cache utility functions
function getApiCacheKey(userId, endpoint, params = {}) {
    const paramsStr = Object.keys(params).length > 0 ? `_${JSON.stringify(params)}` : '';
    return `${userId}_${endpoint}${paramsStr}`;
}

function getApiCachedResponse(cacheKey) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.apiCacheTtl) {
        return cached.data;
    }
    if (cached && Date.now() - cached.timestamp >= CACHE_CONFIG.apiCacheTtl) {
        // Remove expired cache
        apiCache.delete(cacheKey);
    }
    return null;
}

function setApiCachedResponse(cacheKey, data) {
    apiCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
}

function invalidateApiCache(userId, endpoint = null) {
    if (endpoint) {
        // Invalidate specific endpoint
        for (const [key] of apiCache) {
            if (key.startsWith(`${userId}_${endpoint}`)) {
                apiCache.delete(key);
            }
        }
    } else {
        // Invalidate all cache for user
        for (const [key] of apiCache) {
            if (key.startsWith(`${userId}_`)) {
                apiCache.delete(key);
            }
        }
    }
}

// Image Cache utility functions
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

// Cache status and management functions
async function getImageCacheStatus(userId) {
    try {
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
            
            return {
                userId: userId,
                cachedImages: imageFiles.length,
                metaFiles: metaFiles.length,
                totalSizeBytes: totalSize,
                totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                cacheDir: userCacheDir,
                cachePolicy: 'indefinite - URLs are unique'
            };
        } catch (error) {
            // Cache directory doesn't exist yet
            return {
                userId: userId,
                cachedImages: 0,
                metaFiles: 0,
                totalSizeBytes: 0,
                totalSizeMB: 0,
                cacheDir: userCacheDir,
                cachePolicy: 'indefinite - URLs are unique'
            };
        }
    } catch (error) {
        console.error('Cache status error:', error);
        throw error;
    }
}

async function clearImageCache(userId) {
    try {
        const userCacheDir = path.join(CACHE_CONFIG.baseDir, userId.toString());
        
        try {
            const files = await fs.readdir(userCacheDir);
            let deletedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(userCacheDir, file);
                await fs.unlink(filePath);
                deletedCount++;
            }
            
            return { 
                message: 'Cache cleared successfully',
                deletedFiles: deletedCount,
                userId: userId
            };
        } catch (error) {
            // Cache directory doesn't exist
            return { 
                message: 'No cache to clear',
                deletedFiles: 0,
                userId: userId
            };
        }
    } catch (error) {
        console.error('Cache clear error:', error);
        throw error;
    }
}

function getApiCacheStatus(userId) {
    let userCacheCount = 0;
    let totalCacheSize = 0;
    
    for (const [key, value] of apiCache) {
        if (key.startsWith(`${userId}_`)) {
            userCacheCount++;
            totalCacheSize += JSON.stringify(value).length;
        }
    }
    
    return {
        userId: userId,
        cachedApiResponses: userCacheCount,
        totalCacheSize: totalCacheSize,
        totalCacheSizeKB: Math.round(totalCacheSize / 1024 * 100) / 100,
        cacheTtlHours: CACHE_CONFIG.apiCacheTtl / (60 * 60 * 1000),
        totalCacheEntries: apiCache.size
    };
}

function clearApiCache(userId, endpoint = null) {
    let deletedCount = 0;
    const keysToDelete = [];
    
    for (const [key] of apiCache) {
        if (key.startsWith(`${userId}_`)) {
            if (!endpoint || key.includes(endpoint)) {
                keysToDelete.push(key);
            }
        }
    }
    
    keysToDelete.forEach(key => {
        apiCache.delete(key);
        deletedCount++;
    });
    
    return {
        message: endpoint ? `API cache cleared for ${endpoint}` : 'All API cache cleared',
        deletedEntries: deletedCount,
        userId: userId,
        endpoint: endpoint || 'all'
    };
}

module.exports = {
    CACHE_CONFIG,
    
    // API Cache functions
    getApiCacheKey,
    getApiCachedResponse,
    setApiCachedResponse,
    invalidateApiCache,
    getApiCacheStatus,
    clearApiCache,
    
    // Image Cache functions
    getCacheKey,
    getCachedImage,
    setCachedImage,
    ensureCacheDir,
    getImageCacheStatus,
    clearImageCache
}; 