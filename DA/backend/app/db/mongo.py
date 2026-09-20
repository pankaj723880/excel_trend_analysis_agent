"""MongoDB connection service & GridFS manager.

Manages persistent database client for Excel Intelligence using PyMongo.
Never exposes credentials to the frontend.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from pymongo import MongoClient, ASCENDING
from pymongo.database import Database
import gridfs

logger = logging.getLogger(__name__)

_CLIENT: MongoClient | None = None
_DB: Database | None = None
_FS: gridfs.GridFS | None = None


def get_mongo_uri() -> str:
    """Retrieves MONGODB_URI from environment variables.
    
    Default fallback for local development: mongodb://localhost:27017/excel_intelligence
    """
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        uri = "mongodb://localhost:27017/excel_intelligence"
    return uri


def get_mongo_client() -> MongoClient:
    """Returns singleton PyMongo client instance."""
    global _CLIENT
    if _CLIENT is None:
        uri = get_mongo_uri()
        logger.info("Initializing MongoDB connection client...")
        _CLIENT = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
    return _CLIENT


def get_db() -> Database:
    """Returns target MongoDB Database instance."""
    global _DB
    if _DB is None:
        client = get_mongo_client()
        db_name = "excel_intelligence"
        try:
            default_name = client.get_default_database()
            if default_name is not None:
                db_name = default_name.name
        except Exception:
            pass
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
