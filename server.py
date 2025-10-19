#!/usr/bin/env python3
"""
Simple HTTPS server for local development with Spotify OAuth.
Generates a self-signed certificate on first run.
"""

import http.server
import ssl
import os
import sys
from pathlib import Path

PORT = 8080
CERT_FILE = '.local-cert.pem'
KEY_FILE = '.local-key.pem'

def generate_cert():
    """Generate self-signed certificate for localhost."""
    print("Generating self-signed certificate for localhost...")
    print("(You'll see a browser warning - this is normal for local dev)")

    import subprocess

    # Generate private key and certificate in one command
    cmd = [
        'openssl', 'req', '-x509', '-newkey', 'rsa:4096',
        '-keyout', KEY_FILE, '-out', CERT_FILE,
        '-days', '365', '-nodes',
        '-subj', '/CN=localhost'
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"✓ Certificate created: {CERT_FILE}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to generate certificate: {e}")
        print("\nMake sure OpenSSL is installed:")
        print("  Ubuntu/Debian: sudo apt-get install openssl")
        print("  Mac: brew install openssl")
        return False
    except FileNotFoundError:
        print("✗ OpenSSL not found!")
        print("\nPlease install OpenSSL:")
        print("  Ubuntu/Debian: sudo apt-get install openssl")
        print("  Mac: brew install openssl")
        return False

def main():
    # Check if certificate exists, generate if not
    if not (os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE)):
        if not generate_cert():
            sys.exit(1)

    # Create HTTPS server
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

    # Wrap with SSL
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(CERT_FILE, KEY_FILE)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

    print(f"\n{'='*60}")
    print(f"HTTPS Server running at: https://localhost:{PORT}")
    print(f"{'='*60}")
    print("\nIMPORTANT: Your browser will show a security warning because")
    print("this is a self-signed certificate. This is NORMAL for local dev.")
    print("\nTo proceed:")
    print("  Chrome/Edge: Click 'Advanced' → 'Proceed to localhost'")
    print("  Firefox: Click 'Advanced' → 'Accept the Risk and Continue'")
    print("  Safari: Click 'Show Details' → 'visit this website'")
    print(f"\n{'='*60}")
    print("Press Ctrl+C to stop the server")
    print(f"{'='*60}\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        sys.exit(0)

if __name__ == '__main__':
    main()
