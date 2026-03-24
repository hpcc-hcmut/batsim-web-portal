"""Shared file utilities for upload handling."""

import os
import re


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename to prevent path traversal and invalid characters.

    Strips directory components, removes dangerous characters,
    and ensures the result is a safe basename.
    """
    # Extract just the basename (strip any directory traversal)
    filename = os.path.basename(filename)
    # Remove null bytes and other control characters
    filename = re.sub(r'[\x00-\x1f]', '', filename)
    # Replace potentially dangerous characters
    filename = re.sub(r'[/\\:*?"<>|]', '_', filename)
    # Strip leading dots (prevent hidden files)
    filename = filename.lstrip('.')
    # Fallback if empty after sanitization
    if not filename:
        filename = "uploaded_file"
    return filename


def safe_file_path(storage_dir: str, filename: str) -> str:
    """Build a file path and verify it stays within the storage directory.

    Raises ValueError if the resolved path escapes the storage root.
    """
    full_path = os.path.join(storage_dir, filename)
    # Resolve to absolute and verify containment
    resolved = os.path.realpath(full_path)
    storage_root = os.path.realpath(storage_dir)
    if not resolved.startswith(storage_root + os.sep) and resolved != storage_root:
        raise ValueError("Invalid filename: path traversal detected")
    return full_path
