"""Private S3-compatible resume storage. Credentials are explicit; no ambient discovery."""

import re
from uuid import uuid4

from fastapi import HTTPException

from app.core.config import BACKEND_ROOT, get_settings


class S3ResumeStorage:
    def __init__(self):
        import boto3
        from botocore.config import Config
        from botocore.session import Session as BotocoreSession

        settings = get_settings()
        if not all([settings.s3_bucket, settings.s3_access_key_id, settings.s3_secret_access_key]):
            raise HTTPException(503, "Private object storage is not configured")
        self.bucket = settings.s3_bucket
        session = BotocoreSession()
        # Avoid reading personal ~/.aws files or unrelated AWS configuration.
        session.set_config_variable("config_file", str(BACKEND_ROOT / "runtime/aws-config"))
        session.set_config_variable(
            "credentials_file", str(BACKEND_ROOT / "runtime/aws-credentials")
        )
        session.set_config_variable("profile", None)
        session.set_config_variable("data_path", None)
        self.client = boto3.session.Session(botocore_session=session).client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id.get_secret_value(),
            aws_secret_access_key=settings.s3_secret_access_key.get_secret_value(),
            aws_session_token=settings.s3_session_token.get_secret_value()
            if settings.s3_session_token
            else None,
            verify=True,
            config=Config(
                connect_timeout=5,
                read_timeout=10,
                retries={"total_max_attempts": 1},
                proxies={},
                signature_version="s3v4",
            ),
        )

    @staticmethod
    def location(key):
        if not re.fullmatch(r"[a-f0-9]{32}\.(pdf|docx)", key):
            raise ValueError("Invalid storage key")
        return "resumes/" + key

    def save(self, data: bytes, extension: str) -> str:
        if extension not in {"pdf", "docx"}:
            raise ValueError("Unsupported resume format")
        key = uuid4().hex + "." + extension
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=self.location(key),
                Body=data,
                ContentType="application/pdf"
                if extension == "pdf"
                else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        except Exception:
            raise HTTPException(503, "Private storage is temporarily unavailable") from None
        return key

    def delete(self, key: str) -> None:
        location = self.location(key)
        try:
            self.client.delete_object(Bucket=self.bucket, Key=location)
        except Exception:
            raise HTTPException(503, "Private storage is temporarily unavailable") from None
