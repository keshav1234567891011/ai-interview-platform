from sqlalchemy import CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RateLimitBucket(Base):
    """Shared fixed-window quotas. Keys contain HMACs, never emails or IP addresses."""

    __tablename__ = "rate_limit_buckets"
    __table_args__ = (CheckConstraint("count >= 1", name="ck_rate_limit_positive"),)

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[int] = mapped_column(Integer, index=True)
    count: Mapped[int] = mapped_column(Integer)
