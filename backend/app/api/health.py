from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Application liveness")
def health() -> HealthResponse:
    """Report process health without requiring a database connection."""
    return HealthResponse(status="ok")
