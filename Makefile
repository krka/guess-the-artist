.PHONY: run-local help clean

# Default target
help:
	@echo "Available targets:"
	@echo "  make run-local    - Start local development server on port 8000"
	@echo "  make clean        - Remove any temporary files"
	@echo "  make help         - Show this help message"

# Start local development server
run-local:
	@echo "Starting local server at http://localhost:8000"
	@echo "Press Ctrl+C to stop"
	@echo ""
	@python3 -m http.server 8000 || python -m http.server 8000

# Clean temporary files (if any)
clean:
	@echo "Cleaning temporary files..."
	@find . -type f -name "*.pyc" -delete
	@find . -type d -name "__pycache__" -delete
	@echo "Done!"
