"""FastAPI application entry point for the Excel Data Analyst backend."""
from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from DA/backend/.env or current working directory
load_dotenv()
_backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_backend_env):
    load_dotenv(_backend_env, override=False)

from app.api import ai, analysis, cleaning, export, mis, upload, workbooks
from app.db.mongo import validate_mongo_connection, close_mongo_connection
from app.services.mongo_store import get_or_create_default_user

app = FastAPI(
    title="Excel Data Analyst API",
    description="AI-powered Excel workbook analysis: EDA, trends, anomalies, correlations, cleaning, and Gemini insights.",
    version="1.0.0",
)

# Startup & Shutdown hooks
@app.on_event("startup")
async def startup_event():
    mongo_ok = validate_mongo_connection()
    if mongo_ok:
        get_or_create_default_user()

@app.on_event("shutdown")
async def shutdown_event():
    close_mongo_connection()

# CORS - allow Vite dev server, Vercel, Netlify, and configurable origins
_default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://excel-trend-analysis-agent.vercel.app",
    "https://agent-6ab00e97922598066035110--exceltrendanalyst.netlify.app",
]
_origins_env = os.environ.get("CORS_ORIGINS", "*")
if _origins_env.strip() == "*":
    origins = ["*"]
else:
    origins = [origin.strip() for origin in _origins_env.split(",") if origin.strip()]
    for default_origin in _default_origins:
        if default_origin not in origins:
            origins.append(default_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(workbooks.router, prefix="/api", tags=["workbooks"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(cleaning.router, prefix="/api", tags=["cleaning"])
app.include_router(ai.router, prefix="/api", tags=["ai"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(mis.router, prefix="/api", tags=["mis"])


@app.get("/")
async def root():
    from app.services.gemini_client import get_all_api_keys

    keys = get_all_api_keys()
    mongo_ok = validate_mongo_connection()
    return {
        "status": "ok",
        "service": "excel-data-analyst-api",
        "version": "1.0.0",
        "cors_origins": origins,
        "ai_enabled": bool(keys),
        "total_api_keys": len(keys),
        "mongodb_connected": mongo_ok,
    }


@app.get("/api/health")
async def health():
    from app.services.store import stats

    mongo_ok = validate_mongo_connection()
    return {
        "status": "healthy",
        "store": stats(),
        "mongodb_connected": mongo_ok,
    }
