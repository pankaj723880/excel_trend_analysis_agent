"""FastAPI application entry point for the Excel Data Analyst backend."""
import sys
import os

# Ensure backend root is in sys.path when invoked directly as uvicorn main:app
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from app.main import app

__all__ = ["app"]
