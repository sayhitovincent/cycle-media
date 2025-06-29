# Strava Integration Developer Guide

This document explains how the Strava integration works and how to customize it.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Strava API    │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (OAuth/REST)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Frontend Components
- `strava-integration.js` - Main integration class
- `strava-styles.css` - UI styling
- Event-based communication with existing media generator

### Backend Components
- `server.js` - Express server with OAuth and API endpoints
- Session management and token storage
- Proxy for Strava API requests

## Authentication Flow

### 1. OAuth Initiation
```javascript
// User clicks "Connect with Strava"
GET /auth/strava
```

### 2. Strava Authorization
```
Redirect to: https://www.strava.com/oauth/authorize
  ?client_id=CLIENT_ID
  &response_type=code
  &redirect_uri=REDIRECT_URI
  &scope=read,activity:read_all
```

### 3. OAuth Callback
```javascript
// Strava redirects back with authorization code
GET /auth/strava/callback?code=AUTHORIZATION_CODE

// Backend exchanges code for access token
POST https://www.strava.com/oauth/token
```

### 4. Session Management
```javascript
// Store user session and tokens
req.session.userId = athlete.id;
userTokens[athlete.id] = {
    accessToken: access_token,
    refreshToken: refresh_token,
    athlete: athlete
};
```

## API Endpoints

### Authentication Endpoints

#### `GET /auth/strava`
Initiates OAuth flow by redirecting to Strava.

#### `GET /auth/strava/callback`
Handles OAuth callback and exchanges code for tokens.

**Response:** Redirects to frontend with success/error parameters.

#### `POST /api/logout`
Logs out user and clears session.

**Response:**
```json
{ "success": true }
```

### Data Endpoints

#### `GET /api/user`
Returns authenticated user information.

**Response:**
```json
{
  "id": 12345,
  "username": "athlete_username",
  "firstname": "John",
  "lastname": "Doe",
  "profile": "https://avatar.url",
  "authenticated": true
}
```

#### `GET /api/activities`
Returns recent activities with photos (last 30).

**Query Parameters:**
- `per_page` (optional): Number of activities to return (default: 30)
- `page` (optional): Page number (default: 1)

**Response:**
```json
[
  {
    "id": 123456789,
    "name": "Morning Ride",
    "type": "Ride",
    "sport_type": "Ride",
    "start_date": "2024-01-15T08:00:00Z",
    "distance": 25000.0,
    "moving_time": 3600,
    "elapsed_time": 3900,
    "total_elevation_gain": 500.0,
    "average_speed": 6.94,
    "max_speed": 15.28,
    "average_heartrate": 140.0,
    "max_heartrate": 180.0,
    "total_photo_count": 5,
    "map": { "summary_polyline": "encoded_polyline" }
  }
]
```

#### `GET /api/activities/:id`
Returns detailed activity data including photos.

**Response:**
```json
{
  "id": 123456789,
  "name": "Morning Ride",
  "description": "Great ride through the mountains",
  "type": "Ride",
  "sport_type": "Ride",
  "start_date": "2024-01-15T08:00:00Z",
  "start_date_local": "2024-01-15T10:00:00Z",
  "timezone": "Europe/Amsterdam",
  
  // Performance data
  "distance": 25000.0,
  "moving_time": 3600,
  "elapsed_time": 3900,
  "total_elevation_gain": 500.0,
  "elev_high": 1200.0,
  "elev_low": 700.0,
  "average_speed": 6.94,
  "max_speed": 15.28,
  "average_heartrate": 140.0,
  "max_heartrate": 180.0,
  "average_watts": 250.0,
  "max_watts": 800.0,
  "weighted_average_watts": 260.0,
  "average_cadence": 85.0,
  "average_temp": 15.0,
  "calories": 1200.0,
  "device_name": "Garmin Edge 530",
  
  // Map data
  "map": {
    "id": "a123456789",
    "summary_polyline": "encoded_polyline",
    "resource_state": 2
  },
  
  // High-resolution photos
  "photos": [
    {
      "id": 987654321,
      "source": 1,
      "unique_id": "unique_photo_id",
      "urls": {
        "300": "https://photo.url/300",
        "600": "https://photo.url/600",
        "1024": "https://photo.url/1024",
        "2048": "https://photo.url/2048"
      },
      "caption": "Beautiful mountain view",
      "type": "InstagramPhoto",
      "uploaded_at": "2024-01-15T08:30:00Z",
      "created_at": "2024-01-15T08:15:00Z",
      "url": "https://photo.url/2048"  // Highest resolution
    }
  ]
}
```

## Frontend Integration

### Events System

The frontend uses a custom event system to communicate between the Strava integration and the existing media generator.

#### `stravaActivityImported` Event

Triggered when user imports activity data.

```javascript
window.addEventListener('stravaActivityImported', (event) => {
    const { activity, statsData } = event.detail;
    
    // activity: Full Strava activity object
    // statsData: Formatted statistics for display
    console.log('Activity imported:', activity);
    console.log('Formatted stats:', statsData);
});
```

**Event Detail Structure:**
```javascript
{
  activity: {
    // Full Strava activity object (see API response above)
  },
  statsData: {
    title: "Morning Ride",
    distance: "25.0 km",
    time: "1:00",
    elevation: "500m",
    speed: "25.0 km/h",     // nullable
    heartrate: "140 bpm"    // nullable
  }
}
```

#### `stravaPhotoImported` Event

Triggered when user imports a photo.

```javascript
window.addEventListener('stravaPhotoImported', (event) => {
    const { file, url } = event.detail;
    
    // file: File object ready for upload
    // url: Original Strava photo URL
    console.log('Photo imported:', { file, url });
});
```

### Customizing Data Import

#### Adding New Statistics

Edit the `importActivityStats` method in `strava-integration.js`:

```javascript
importActivityStats(activity) {
    const statsData = {
        title: activity.name,
        distance: `${(activity.distance / 1000).toFixed(1)} km`,
        time: formatTime(activity.moving_time),
        elevation: `${Math.round(activity.total_elevation_gain)}m`,
        
        // Add new statistics
        power: activity.average_watts ? `${Math.round(activity.average_watts)}W` : null,
        cadence: activity.average_cadence ? `${Math.round(activity.average_cadence)} rpm` : null,
        temperature: activity.average_temp ? `${Math.round(activity.average_temp)}°C` : null
    };
    
    window.dispatchEvent(new CustomEvent('stravaActivityImported', {
        detail: { activity, statsData }
    }));
}
```

#### Customizing Photo Selection

Modify the `selectPhoto` method to add photo filtering or processing:

```javascript
selectPhoto(photoUrl) {
    // Add photo filtering logic
    if (this.shouldImportPhoto(photoUrl)) {
        this.selectedPhotoUrl = photoUrl;
    }
}

shouldImportPhoto(photoUrl) {
    // Custom logic to filter photos
    // e.g., check image dimensions, file size, etc.
    return true;
}
```

### UI Customization

#### Modifying Activity Cards

Edit the `renderActivities` method in `strava-integration.js`:

```javascript
renderActivities() {
    const container = document.getElementById('activities-list');
    
    container.innerHTML = this.activities.map(activity => `
        <div class="activity-card" data-activity-id="${activity.id}">
            <!-- Add custom content -->
            <div class="activity-thumbnail">
                ${activity.map?.summary_polyline ? 
                  `<img src="https://maps.googleapis.com/maps/api/staticmap?...">` : 
                  ''
                }
            </div>
            <div class="activity-info">
                <h4>${activity.name}</h4>
                <!-- Add more custom fields -->
            </div>
        </div>
    `).join('');
}
```

#### Styling Changes

Modify `strava-styles.css` to change the appearance:

```css
/* Change Strava brand colors */
.strava-btn {
    background: #your-custom-color;
}

/* Modify activity card layout */
.activity-card {
    /* Your custom styles */
}
```

## Backend Customization

### Adding New Endpoints

Add custom endpoints to `server.js`:

```javascript
// Get activity streams (power, heartrate, etc.)
app.get('/api/activities/:id/streams', async (req, res) => {
    if (!req.session.userId || !userTokens[req.session.userId]) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = userTokens[req.session.userId];
        const activityId = req.params.id;
        
        const response = await axios.get(
            `${STRAVA_CONFIG.apiUrl}/activities/${activityId}/streams`,
            {
                headers: { 'Authorization': `Bearer ${user.accessToken}` },
                params: {
                    keys: 'time,distance,latlng,altitude,heartrate,cadence,watts,temp',
                    key_by_type: true
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Streams fetch error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch activity streams' });
    }
});
```

### Token Refresh

Implement automatic token refresh:

```javascript
async function refreshToken(userId) {
    const user = userTokens[userId];
    if (!user?.refreshToken) return false;

    try {
        const response = await axios.post(STRAVA_CONFIG.tokenUrl, {
            client_id: STRAVA_CONFIG.clientId,
            client_secret: STRAVA_CONFIG.clientSecret,
            refresh_token: user.refreshToken,
            grant_type: 'refresh_token'
        });

        const { access_token, refresh_token } = response.data;
        
        userTokens[userId].accessToken = access_token;
        userTokens[userId].refreshToken = refresh_token;
        
        return true;
    } catch (error) {
        console.error('Token refresh error:', error);
        return false;
    }
}
```

### Database Integration

For production, replace in-memory token storage with a database:

```javascript
// Example with MongoDB/Mongoose
const UserToken = require('./models/UserToken');

// Store tokens
await UserToken.findOneAndUpdate(
    { athleteId: athlete.id },
    {
        athleteId: athlete.id,
        accessToken: access_token,
        refreshToken: refresh_token,
        athlete: athlete,
        updatedAt: new Date()
    },
    { upsert: true }
);

// Retrieve tokens
const userToken = await UserToken.findOne({ athleteId: req.session.userId });
```

## Rate Limiting

Strava API has rate limits:
- **200 requests per 15 minutes**
- **2,000 requests per day**

Implement rate limiting in your backend:

```javascript
const rateLimit = require('express-rate-limit');

const stravaApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 180, // Leave buffer for other requests
    message: 'Too many Strava API requests, please try again later'
});

app.use('/api/activities', stravaApiLimiter);
```

## Error Handling

### Common Errors

1. **401 Unauthorized**: Token expired or invalid
2. **403 Forbidden**: Rate limit exceeded
3. **404 Not Found**: Activity not found or private
4. **429 Too Many Requests**: Rate limit exceeded

### Error Response Format

```javascript
{
  "error": "Token expired",
  "code": "UNAUTHORIZED",
  "details": "Please re-authenticate with Strava"
}
```

## Security Considerations

### Production Checklist

- [ ] Use HTTPS for all URLs
- [ ] Implement CSRF protection
- [ ] Use secure session configuration
- [ ] Store tokens encrypted in database
- [ ] Implement proper token refresh
- [ ] Add request validation
- [ ] Use environment variables for secrets
- [ ] Implement proper logging
- [ ] Add monitoring and alerting

### Environment Variables

```env
# Required
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://yourdomain.com/auth/strava/callback

# Security
SESSION_SECRET=strong_random_secret
NODE_ENV=production

# Optional
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

## Testing

### Unit Tests

Test the API endpoints:

```javascript
// Example with Jest/Supertest
describe('Strava API Integration', () => {
    test('GET /api/activities returns activities', async () => {
        const response = await request(app)
            .get('/api/activities')
            .set('Cookie', authenticatedCookie)
            .expect(200);
            
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body[0]).toHaveProperty('id');
    });
});
```

### Integration Tests

Test the OAuth flow:

```javascript
describe('OAuth Flow', () => {
    test('OAuth callback handles valid code', async () => {
        const response = await request(app)
            .get('/auth/strava/callback?code=valid_code')
            .expect(302);
            
        expect(response.headers.location).toContain('auth=success');
    });
});
```

## Deployment

### Docker Production

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && adduser -S backend -u 1001
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY backend/ ./
USER backend
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Configuration

Use different configurations for different environments:

```javascript
const config = {
    development: {
        frontendUrl: 'http://localhost:8080',
        backendUrl: 'http://localhost:3001'
    },
    production: {
        frontendUrl: 'https://yourdomain.com',
        backendUrl: 'https://api.yourdomain.com'
    }
};

module.exports = config[process.env.NODE_ENV || 'development'];
```

This completes the comprehensive Strava integration guide! 