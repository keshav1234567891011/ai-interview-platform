export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
    public aiReason?: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("X-InterviewAI-Request", "1");
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    if (options.signal?.aborted)
      throw new ApiError(0, "The request timed out. Please try again later.");
    throw new ApiError(0, "We couldn’t reach the server. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("interviewai-session-expired"));
    const data = await response.json().catch(() => ({}));
    const message =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((item: { msg: string }) => item.msg).join(". ")
          : "Something went wrong. Please try again.";
    const retry = Number(response.headers.get("Retry-After"));
    throw new ApiError(response.status, message, Number.isFinite(retry) && retry > 0 ? retry : undefined,
      response.headers.get("X-InterviewAI-AI-Reason") || undefined);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
