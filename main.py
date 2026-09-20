"""Root entry point for Render / ASGI web servers.
Exposes `app` from `DA.backend.app.main:app`.
"""
import sys
import os

# Ensure backend directory is in Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "DA", "backend"))

from app.main import app
