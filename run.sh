#!/bin/bash

# Cycling Media Generator Docker Management Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Function to start the application
start() {
    print_status "Starting Cycling Media Generator..."
    docker compose up -d --build
    
    if [ $? -eq 0 ]; then
        print_success "Cycling Media Generator is running!"
        print_status "Access the app at: http://localhost:8567"
        print_status "To view logs: ./run.sh logs"
        print_status "To stop: ./run.sh stop"
    else
        print_error "Failed to start the application"
        exit 1
    fi
}

# Function to stop the application
stop() {
    print_status "Stopping Cycling Media Generator..."
    docker compose down
    print_success "Application stopped"
}

# Function to restart the application
restart() {
    print_status "Restarting Cycling Media Generator..."
    stop
    start
}

# Function to show logs
logs() {
    print_status "Showing logs (press Ctrl+C to exit)..."
    docker compose logs -f
}

# Function to show status
status() {
    print_status "Container status:"
    docker compose ps
}

# Function to clean up everything
clean() {
    print_warning "This will remove all containers, images, and volumes related to this app."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up..."
        docker compose down -v --remove-orphans
        docker image rm cycling-media-cycling-media-app 2>/dev/null || true
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show help
show_help() {
    echo "Cycling Media Generator Docker Management"
    echo ""
    echo "Usage: ./run.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the application (default)"
    echo "  stop      Stop the application"
    echo "  restart   Restart the application"
    echo "  logs      Show application logs"
    echo "  status    Show container status"
    echo "  clean     Remove all containers and images"
    echo "  help      Show this help message"
    echo ""
    echo "The application will be available at http://localhost:8567"
}

# Main logic
check_dependencies

case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 