import os
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer = HTTPBearer()


def current_user_id(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    """Validate the Supabase access token by asking Supabase who it belongs to."""
    r = httpx.get(
        f"{os.environ['SUPABASE_URL']}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {creds.credentials}",
            "apikey": os.environ["SUPABASE_ANON_KEY"],
        },
        timeout=10,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return r.json()["id"]
