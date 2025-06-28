# 🚴‍♂️ Cycling Media Generator

A beautiful web application for creating stunning cycling social media posts with custom statistics and backgrounds, similar to Strava-style activity summaries.

## ✨ Features

- **Multiple Image Upload**: Upload multiple cycling photos and choose between them
- **Gradient Backgrounds**: Choose from beautiful pre-made gradient backgrounds  
- **Cycling Statistics**: Add distance, time, elevation gain, and custom titles
- **Customizable Styling**: Adjust text colors and overlay opacity
- **Real-time Preview**: See your changes instantly as you edit
- **High-Quality Export**: Download your posts as PNG images
- **Mobile Responsive**: Works perfectly on desktop, tablet, and mobile devices
- **Drag & Drop**: Easy image upload with drag and drop functionality

## 🚀 Getting Started

### Option 1: Docker (Recommended)
The easiest way to run the app with a proper web server:

```bash
# Start the application
./run.sh start

# The app will be available at http://localhost:3000
```

**Docker Commands:**
- `./run.sh start` - Start the application
- `./run.sh stop` - Stop the application  
- `./run.sh restart` - Restart the application
- `./run.sh logs` - View application logs
- `./run.sh status` - Check container status
- `./run.sh clean` - Remove all containers and images

### Option 2: Direct Browser Access
1. Open `src/index.html` in your web browser
2. Upload background images or select a gradient
3. Customize your cycling statistics
4. Adjust colors and styling to your preference
5. Click "Generate Post" to create your media
6. Download your beautiful cycling post!

### No Installation Required
This is a client-side web application that runs entirely in your browser!

## 🎨 How to Use

### 1. Background Selection
- **Upload Images**: Upload multiple images, then click to select between them
- **Sample Gradients**: Choose from 4 beautiful gradient backgrounds
- **Drag & Drop**: Drag multiple images directly onto the upload area
- Supported formats: JPG, PNG, WebP, and other common image formats

### 2. Content Customization
- **Title**: Add a catchy title for your cycling achievement (automatically adapts to length)
- **Distance**: Enter the total distance covered
- **Time**: Add the duration of your ride
- **Elevation Gain**: Include the total elevation climbed

### 3. Styling Options
- **Text Color**: Choose the color for your main text and statistics
- **Overlay Opacity**: Adjust the dark overlay to make text more readable (0-100%)

### 4. Generate & Download
- Click "Generate Post" to create your media with the current settings
- Use "Download Image" to save your creation as a PNG file
- Images are downloaded at 600x800 pixels, perfect for social media

### 📸 What It Creates
The app generates professional cycling posts with:
- **Adaptive title text** positioned above statistics that automatically wraps and scales to fit
- **Flexible statistics layout** with 40px spacing that aggressively wraps to multiple lines when content is too wide
- **Smart overflow handling** that reduces font size when individual stats are too wide for the canvas
- **Multi-line stats support** with proper spacing and centered alignment for each line
- **Smart content shuffling** that adjusts layout when fields are empty
- **Professional typography** with proper spacing and clean hierarchy
- **Single display** of each statistic (no duplicate values)
- **Customizable overlay** for optimal text readability over any background

## 🎯 Use Cases

- **Social Media Posts**: Share your cycling achievements on Instagram, Facebook, Twitter
- **Cycling Blogs**: Create engaging visuals for your cycling blog posts
- **Training Documentation**: Keep a visual record of your training sessions
- **Club Activities**: Create posts for cycling club events and group rides
- **Personal Memories**: Turn your cycling photos into memorable keepsakes

## 🛠️ Technical Details

### Technologies Used
- **HTML5 Canvas**: For image manipulation and text rendering
- **Vanilla JavaScript**: No frameworks required, fast and lightweight
- **Modern CSS**: Beautiful gradients, animations, and responsive design
- **Web APIs**: FileReader for image uploads, Canvas API for drawing

### Browser Compatibility
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

### File Structure
```
cycling-media/
├── src/                    # Application source files
│   ├── index.html          # Main HTML structure
│   ├── style.css           # Modern CSS styling
│   └── script.js           # JavaScript functionality
├── docker/                 # Docker configuration
│   └── nginx/              # Nginx configuration
│       ├── nginx.conf      # Nginx web server configuration
│       └── logs/           # Nginx logs directory
├── README.md               # This documentation
├── Dockerfile              # Docker container configuration
├── docker-compose.yml      # Docker Compose orchestration
├── .dockerignore           # Docker build exclusions
└── run.sh                  # Convenience script for Docker management
```

## 🎨 Customization

### Adding More Gradient Backgrounds
Edit the `gradients` object in `script.js`:
```javascript
const gradients = {
    gradient5: ['#FF6B6B', '#4ECDC4'],
    gradient6: ['#A8E6CF', '#88D8C0']
};
```

### Modifying Layout
The canvas layout and text positioning can be customized in the drawing methods within `script.js`.

### Styling Changes
Modify `style.css` to change colors, fonts, spacing, and responsive breakpoints.

## 📱 Responsive Design

The app automatically adapts to different screen sizes:
- **Desktop**: Side-by-side layout with full controls
- **Tablet**: Stacked layout with optimized preview size
- **Mobile**: Single column layout with touch-friendly controls

## 🤝 Contributing

This is an open-source project! Feel free to:
- Report bugs or suggest features
- Submit pull requests for improvements
- Share your custom gradient combinations
- Provide feedback on user experience

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Inspired by Strava's activity sharing feature
- Icons from Font Awesome
- Typography powered by Google Fonts (Inter)
- Built with modern web standards

---

**Happy Cycling! 🚴‍♂️🚴‍♀️**

Create beautiful posts to share your cycling adventures with the world! 