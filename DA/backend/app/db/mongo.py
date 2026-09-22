"""MongoDB connection service & GridFS manager.

Manages persistent database client for Excel Intelligence using PyMongo.
Compatible with MongoDB Atlas (SRV, TLS/SSL, certifi CA bundles) and local instances.
Never exposes credentials to the frontend.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from pymongo import MongoClient, ASCENDING
from pymongo.database import Database
import gridfs

try:
    import certifi
    CA_FILE = certifi.where()
except Exception:
    CA_FILE = None

logger = logging.getLogger(__name__)

_CLIENT: MongoClient | None = None
_DB: Database | None = None
_FS: gridfs.GridFS | None = None


def get_mongo_uri() -> str:
    """Retrieves MongoDB connection string from environment variables.
    
    Checks MONGODB_URI or MONGO_URI.
    Default fallback for local development: mongodb://localhost:27017/excel_intelligence
    """
    uri = os.environ.get("MONGODB_URI", "").strip() or os.environ.get("MONGO_URI", "").strip()
    if not uri:
        uri = "mongodb://localhost:27017/excel_intelligence"
    return uri


def get_mongo_client() -> MongoClient:
    """Returns singleton PyMongo client instance configured for Atlas & local MongoDB."""
    global _CLIENT
    if _CLIENT is None:
        uri = get_mongo_uri()
        logger.info("Initializing MongoDB connection client...")

        # Base connection kwargs
        client_kwargs: dict[str, Any] = {
            "serverSelectionTimeoutMS": 10000,
            "connectTimeoutMS": 10000,
            "socketTimeoutMS": 45000,
            "retryWrites": True,
            "appname": "ExcelTrendAnalyst",
        }

        # For MongoDB Atlas (mongodb+srv:// or ssl/tls connections), use certifi root certificates
        if "mongodb+srv://" in uri or "ssl=true" in uri.lower() or "tls=true" in uri.lower():
            if CA_FILE:
                client_kwargs["tlsCAFile"] = CA_FILE

        _CLIENT = MongoClient(uri, **client_kwargs)
    return _CLIENT


def get_db() -> Database:
    """Returns target MongoDB Database instance."""
    global _DB
    if _DB is None:
        client = get_mongo_client()
        # Default name or explicit DATABASE_NAME env var
        db_name = os.environ.get("DATABASE_NAME", "").strip() or os.environ.get("MONGO_DB_NAME", "").strip()
        if not db_name:
            try:
                default_name = client.get_default_database()
                if default_name is not None and default_name.name:
                    db_name = default_name.name
            except Exception:
                pass
        if not db_name:
            db_name = "excel_intelligence"
        _DB = client[db_name]
    return _DB


def get_gridfs() -> gridfs.GridFS:
    """Returns singleton GridFS instance for Excel file binary storage."""
    global _FS
    if _FS is None:
        db = get_db()
        _FS = gridfs.GridFS(db)
    return _FS


# Collection Getters for the 9 specified collections
def get_users_collection():
    return get_db()["users"]


def get_workbooks_collection():
    return get_db()["workbooks"]


def get_workbook_sheets_collection():
    return get_db()["workbook_sheets"]


def get_sheet_data_collection():
    return get_db()["sheet_data"]


def get_analysis_results_collection():
    return get_db()["analysis_results"]


def get_ai_insights_collection():
    return get_db()["ai_insights"]


def get_conversations_collection():
    return get_db()["conversations"]


def get_cleaning_operations_collection():
    return get_db()["cleaning_operations"]


def get_reports_collection():
    return get_db()["reports"]


def get_dashboards_collection():
    return get_db()["dashboards"]


def validate_mongo_connection() -> bool:
    """Validates connection to MongoDB cluster by pinging the server.
    
    Returns True if connected, False if offline.
    """
    try:
        client = get_mongo_client()
        client.admin.command("ping")
        logger.info("Successfully connected to MongoDB cluster.")
        init_db_indexes()
        return True
    except Exception as exc:
        logger.warning(f"MongoDB connection validation failed: {exc}")
        return False


def init_db_indexes() -> None:
    """Creates performance indexes across all 9 collections."""
    try:
        get_workbooks_collection().create_index([("workbook_id", ASCENDING)], unique=True)
        get_workbooks_collection().create_index([("user_id", ASCENDING)])

        get_workbook_sheets_collection().create_index([("workbook_id", ASCENDING)])

        get_sheet_data_collection().create_index([("workbook_id", ASCENDING), ("sheet_name", ASCENDING), ("chunk_index", ASCENDING)])

        get_analysis_results_collection().create_index([("workbook_id", ASCENDING)], unique=True)

        get_ai_insights_collection().create_index([("workbook_id", ASCENDING)], unique=True)

        get_conversations_collection().create_index([("workbook_id", ASCENDING), ("created_at", ASCENDING)])

        get_cleaning_operations_collection().create_index([("workbook_id", ASCENDING)])

        get_reports_collection().create_index([("workbook_id", ASCENDING)])

        get_users_collection().create_index([("email", ASCENDING)], unique=True)
    except Exception as idx_err:
        logger.warning(f"Could not create MongoDB indexes: {idx_err}")


def close_mongo_connection() -> None:
    """Closes PyMongo client connection on application shutdown."""
    global _CLIENT, _DB, _FS
    if _CLIENT:
        _CLIENT.close()
        _CLIENT = None
        _DB = None
        _FS = None
        logger.info("MongoDB client connection closed.")
