from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.interview import Interview
from app.services.analytics import analytics_data, history_item

router = APIRouter(prefix="/api", tags=["Practice analytics"])


@router.get("/analytics")
def analytics(user: CurrentUser, db: DbSession):
    return analytics_data(db, user.id)


@router.get("/history")
def history(user: CurrentUser, db: DbSession, offset: int = Query(default=0, ge=0, le=100000)):
    return [
        history_item(item)
        for item in db.scalars(
            select(Interview)
            .where(Interview.user_id == user.id)
            .order_by(Interview.created_at.desc())
            .offset(offset)
            .limit(50)
        ).all()
    ]
