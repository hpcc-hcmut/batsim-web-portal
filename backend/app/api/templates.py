"""Template download endpoint for workload, platform, and strategy files."""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

TEMPLATE_MAP = {
    "workload": {
        "filename": "workload-template.json",
        "media_type": "application/json",
    },
    "platform": {
        "filename": "platform-template.xml",
        "media_type": "application/xml",
    },
    "strategy": {
        # snake_case so the file runs unchanged after upload: PyBatsim CLI
        # discovers the scheduler class by CamelCasing the file name
        # (strategy_template.py -> Strategy_template).
        "filename": "strategy_template.py",
        "media_type": "text/x-python",
    },
}


@router.get("/{template_type}")
def download_template(template_type: str):
    """Download a template file for the given input type."""
    if template_type not in TEMPLATE_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown template type '{template_type}'. "
                   f"Available: {', '.join(TEMPLATE_MAP.keys())}",
        )

    info = TEMPLATE_MAP[template_type]
    file_path = os.path.join(TEMPLATE_DIR, info["filename"])

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Template file not found on server")

    return FileResponse(
        path=file_path,
        filename=info["filename"],
        media_type=info["media_type"],
    )
