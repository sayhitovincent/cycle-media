# Use nginx alpine image for serving static files
FROM nginx:alpine

# Copy the web app files to nginx html directory
COPY src/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 