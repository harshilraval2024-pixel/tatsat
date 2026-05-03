from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import AdminUser
from app.utils.security import safe_decode_sub

bearer = HTTPBearer(auto_error=False)


async def get_current_admin(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUser:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    sub = safe_decode_sub(creds.credentials)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )
    result = await session.execute(select(AdminUser).where(AdminUser.username == sub))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or disabled"
        )
    return user
