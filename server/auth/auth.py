import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from config.supabaseClient import supabase

# Scheme for extracting the bearer token from the request header
bearer_scheme = HTTPBearer()

async def get_current_user(token: str = Depends(bearer_scheme)):
    """
    Dependency to validate Supabase JWT and get the current user.
    
    This function is injected into protected endpoints. It extracts the Bearer token,
    validates it with Supabase, and returns the user object if valid.
    Otherwise, it raises an HTTP 401 Unauthorized error.
    """
    try:
        # The token object from HTTPBearer has 'credentials' attribute
        jwt = token.credentials
        # Validate the token using Supabase's gotrue-py
        user_response = supabase.auth.get_user(jwt)
        
        if user_response.user:
            return user_response.user
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception:
        # This will catch errors from supabase.auth.get_user if the token is malformed
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
