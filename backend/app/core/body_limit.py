"""Bound both advertised and streamed bodies before multipart spooling or JSON parsing."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

MAX_BODY_BYTES = 11 * 1024 * 1024  # 10 MB audio plus multipart envelope; resumes enforce 5 MB.
MAX_JSON_BYTES = 128 * 1024


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        limit = (
            MAX_JSON_BYTES
            if b"application/json" in headers.get(b"content-type", b"").lower()
            else MAX_BODY_BYTES
        )
        response = JSONResponse({"detail": "Request body is too large."}, status_code=413)
        try:
            if int(headers.get(b"content-length", b"0")) > limit:
                return await response(scope, receive, send)
        except ValueError:
            return await JSONResponse({"detail": "Invalid content length."}, status_code=400)(
                scope, receive, send
            )
        size = 0
        body = bytearray()
        # A bounded buffer also catches chunked uploads before the multipart parser runs.
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > limit:
                return await response(scope, receive, send)
            body.extend(message.get("body", b""))
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
