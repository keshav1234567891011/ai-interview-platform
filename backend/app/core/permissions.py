PERMISSIONS = {
    "users.view": "View users",
    "users.manage": "Manage candidate accounts",
    "interviews.view": "View interview and scheduling history",
    "resumes.view": "View resume metadata",
    "analytics.view": "View application analytics",
    "support.manage": "Manage support account fields",
}


def has_permission(user, permission: str) -> bool:
    return user.role == "owner" or (user.role == "admin" and permission in user.permissions)
