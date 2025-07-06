from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def get_system_status():
    return {"message": "System API - To be implemented"}
