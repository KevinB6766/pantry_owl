from typing import Callable

from fastapi import Depends, HTTPException

from .auth import current_user_id
from .db import supabase


def current_profile(user_id: str = Depends(current_user_id)) -> dict:
    result = (
        supabase.table("profiles")
        .select("id, email, role, location_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=403, detail="No profile is assigned to this account")
    return result[0]


def require_roles(*roles: str) -> Callable:
    def dependency(profile: dict = Depends(current_profile)) -> dict:
        if profile["role"] not in roles:
            raise HTTPException(status_code=403, detail="This account does not have permission")
        return profile

    return dependency


def require_location_access(profile: dict, location_id: str) -> None:
    if profile["role"] == "admin":
        return
    if profile.get("location_id") != location_id:
        raise HTTPException(status_code=403, detail="This account is not assigned to that location")
