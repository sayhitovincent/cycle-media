# 🚴‍♂️ Cycling Media Generator with Strava Integration

Generate pixel-perfect Instagram posts for all formats with integrated Strava activity data and photos.

## ✨ Features

### Core Media Generation
- **Multi-format support**: Square, Landscape, Portrait, Story, and Reel formats
- **Individual image positioning**: Crop and position images independently for each format
- **Custom backgrounds**: Upload images or use gradient backgrounds
- **Text overlays**: Customizable titles and cycling statistics
- **Real-time preview**: See changes instantly across all formats

### Strava Integration 🚴‍♂️
- **OAuth Authentication**: Secure login with your Strava account
- **Activity Selection**: Browse recent activities with photos
- **Automatic Data Import**: Import distance, time, elevation, speed, and heart rate data
- **High-Resolution Photos**: Import photos at the highest available resolution (2048px)
- **Seamless Workflow**: One-click import to media generator
- **Proper Branding**: Compliant with Strava API guidelines

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Strava API credentials (see setup below)

### 1. Get Strava API Credentials

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Create a new application with these settings:
   - **Application Name**: Your app name
   - **Category**: Cycling (or appropriate category)
   - **Website**: `http://localhost:8567` (for development)
   - **Authorization Callback Domain**: `localhost`
3. Note your **Client ID** and **Client Secret**

### 2. Environment Setup

1. **Copy the environment template**:
   ```bash
   cp env-example.txt .env
   ```

2. **Update `.env` with your Strava credentials**:
   ```env
   # Strava API Configuration
   STRAVA_CLIENT_ID=your_actual_client_id_here
   STRAVA_CLIENT_SECRET=your_actual_client_secret_here
   STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback

   # Server Configuration
   PORT=3001
   FRONTEND_URL=http://localhost:8567
   SESSION_SECRET=your-super-secret-session-key-change-this-in-production

   # Development
   NODE_ENV=development
   ```

### 3. Launch the Application

```bash
# Start both frontend and backend
docker compose up --build

# Or for development with logs
docker compose up --build -d && docker compose logs -f
```

The application will be available at:
- **Frontend**: http://localhost:8567
- **Backend API**: http://localhost:3001

### 4. Using Strava Integration

1. Click **"Connect with Strava"** in the app
2. Authorize the application in Strava
3. Browse your recent activities with photos
4. Select an activity to view details and photos
5. Click **"Import to Media Generator"** to use the data

## 🔧 Development

### Backend Development
```bash
cd backend
npm install
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
The frontend files are mounted as volumes in Docker, so changes are reflected immediately.

### API Endpoints

#### Authentication
- `GET /auth/strava` - Initiate Strava OAuth
- `GET /auth/strava/callback` - OAuth callback
- `POST /api/logout` - Logout user

#### Data
- `GET /api/user` - Get authenticated user info
- `GET /api/activities` - Get activities with photos (last 30)
- `GET /api/activities/:id` - Get detailed activity data and photos
- `GET /api/strava-branding` - Get Strava branding requirements

#### Health
- `GET /health` - Backend health check

## 📁 Project Structure

```
cycling-media/
├── backend/                 # Node.js API server
│   ├── package.json        # Backend dependencies
│   ├── server.js          # Main server file
│   └── Dockerfile         # Backend container
├── src/                    # Frontend files
│   ├── index.html         # Main HTML
│   ├── script.js          # Core media generator
│   ├── style.css          # Main styles
│   ├── strava-integration.js  # Strava API integration
│   └── strava-styles.css  # Strava UI styles
├── docker/                # Docker configuration
├── docker compose.yml     # Multi-service setup
├── Dockerfile            # Frontend container
└── .env                  # Environment variables (create from env-example.txt)
```

## 🔐 Security Considerations

### For Production

1. **Environment Variables**:
   - Change `SESSION_SECRET` to a strong, random value
   - Use HTTPS URLs for redirect URIs
   - Set `NODE_ENV=production`

2. **Strava API**:
   - Update callback domain to your production domain
   - Store tokens securely (consider database instead of memory)
   - Implement token refresh logic for long-term usage

3. **Docker**:
   - Use non-root users (already implemented)
   - Enable health checks (already implemented)
   - Consider using secrets management

## 🎨 Customization

### Adding New Statistics
Edit the `importActivityStats` function in `strava-integration.js` to include additional Strava data points.

### Modifying UI Layout
Update `strava-styles.css` and the HTML structure in `createStravaUI()` to customize the Strava integration interface.

### Extending API
Add new endpoints to `backend/server.js` to fetch additional Strava data (segments, routes, etc.).

## 📋 Strava API Compliance

This application follows Strava's API guidelines:
- ✅ Displays "Powered by Strava" branding
- ✅ Uses official Strava colors (#FC4C02)
- ✅ Respects rate limits (200 requests per 15 minutes)
- ✅ Includes proper attribution
- ✅ Links to Strava terms of service

## 🐛 Troubleshooting

### Common Issues

**"Authentication failed"**
- Verify your Strava Client ID and Secret in `.env`
- Check that the redirect URI matches exactly: `http://localhost:3001/auth/strava/callback`
- Ensure your Strava app's authorization callback domain is set to `localhost`

**"No activities with photos found"**
- The app only shows activities that have photos attached
- Upload photos to your Strava activities using the mobile app

**Backend connection errors**
- Check that both containers are running: `docker compose ps`
- Verify the backend is healthy: `curl http://localhost:3001/health`

**Docker issues**
- Rebuild containers: `docker compose down && docker compose up --build`
- Check logs: `docker compose logs backend` or `docker compose logs frontend`

### Development Mode

For local development without Docker:

1. **Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend**: Serve the `src/` directory with any static file server:
   ```bash
   # Using Python
   cd src && python -m http.server 8567
   
   # Using Node.js
   npx serve src -p 3001
   ```

## 📝 License

MIT License - feel free to modify and distribute.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with your own Strava credentials
5. Submit a pull request

---

**Happy cycling! 🚴‍♂️📸**

Create beautiful posts to share your cycling adventures with the world! 