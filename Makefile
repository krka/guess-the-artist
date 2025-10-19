.PHONY: run-local deploy deploy-setup help clean clean-certs

# Default target
help:
	@echo "Available targets:"
	@echo "  make run-local     - Start HTTPS local development server on port 8443"
	@echo "  make deploy-setup  - One-time setup for gh-pages deployment with git worktree"
	@echo "  make deploy        - Deploy to GitHub Pages (gh-pages branch)"
	@echo "  make clean         - Remove temporary files"
	@echo "  make clean-certs   - Remove SSL certificates (will regenerate on next run)"
	@echo "  make help          - Show this help message"

# Start local HTTPS development server
run-local:
	@python3 server.py || python server.py

# One-time setup for gh-pages deployment
deploy-setup:
	@echo "Setting up gh-pages deployment with git worktree..."
	@if [ -d "gh-pages" ]; then \
		echo "✗ gh-pages directory already exists!"; \
		echo "  Run 'rm -rf gh-pages' first if you want to recreate it."; \
		exit 1; \
	fi
	@echo ""
	@echo "Creating gh-pages branch..."
	@git checkout --orphan gh-pages 2>/dev/null || git checkout gh-pages
	@git rm -rf . 2>/dev/null || true
	@echo "# GitHub Pages" > README.md
	@git add README.md
	@git commit -m "Initialize gh-pages branch" 2>/dev/null || true
	@git push -u origin gh-pages
	@git checkout master
	@echo ""
	@echo "Setting up worktree in gh-pages/ directory..."
	@git worktree add gh-pages gh-pages
	@echo ""
	@echo "✓ Setup complete! Now run 'make deploy' to deploy."

# Deploy to GitHub Pages using worktree
deploy:
	@if [ ! -d "gh-pages" ]; then \
		echo "✗ gh-pages worktree not set up!"; \
		echo "  Run 'make deploy-setup' first."; \
		exit 1; \
	fi
	@echo "Deploying to GitHub Pages..."
	@echo ""
	@echo "Step 1: Copying files to gh-pages worktree..."
	@rsync -av --delete \
		--exclude='.git' \
		--exclude='gh-pages' \
		--exclude='.local-*.pem' \
		--exclude='server.py' \
		--exclude='Makefile' \
		--exclude='PLAN.md' \
		--exclude='DEPLOY.md' \
		. gh-pages/
	@echo ""
	@echo "Step 2: Creating versioned assets in gh-pages..."
	@cd gh-pages && \
		HASH=$$(git -C .. rev-parse --short HEAD) && \
		echo "  Commit hash: $$HASH" && \
		VERSION_DIR="v/$$HASH" && \
		mkdir -p "$$VERSION_DIR" && \
		cp -r src "$$VERSION_DIR/" && \
		echo "  Updating HTML files to reference $$VERSION_DIR..." && \
		sed -i.bak -e "s|src/css/|$$VERSION_DIR/src/css/|g" \
			-e "s|src/js/|$$VERSION_DIR/src/js/|g" \
			index.html game.html debug.html && \
		rm -f index.html.bak game.html.bak debug.html.bak && \
		echo "  Cleaning up old versions (keeping last 3)..." && \
		cd v && ls -t | tail -n +4 | xargs -r rm -rf && cd ..
	@echo ""
	@echo "Step 3: Committing to gh-pages..."
	@cd gh-pages && \
		git add -A && \
		(git diff --cached --quiet || git commit -m "Deploy: $$(git -C .. rev-parse --short HEAD) - $$(date '+%Y-%m-%d %H:%M:%S')") && \
		git push origin gh-pages
	@echo ""
	@echo "✓ Deployed! Your changes will be live at:"
	@echo "  https://krka.github.io/guess-the-artist/"
	@echo "  (Wait ~1-2 minutes for GitHub Pages to build)"

# Clean temporary files
clean:
	@echo "Cleaning temporary files..."
	@find . -type f -name "*.pyc" -delete
	@find . -type d -name "__pycache__" -delete
	@echo "Done!"

# Clean SSL certificates
clean-certs:
	@echo "Removing SSL certificates..."
	@rm -f .local-cert.pem .local-key.pem
	@echo "Done! Certificates will be regenerated on next 'make run-local'"
