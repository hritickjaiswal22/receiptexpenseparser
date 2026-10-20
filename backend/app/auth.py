import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import SUPABASE_JWKS_URL

security = HTTPBearer()
jwks_client = PyJWKClient(SUPABASE_JWKS_URL)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency that verifies the Supabase JWT and returns the user's payload.
    """
    token = credentials.credentials
    try:
        # 1. Fetch the signing key from Supabase's JWKS endpoint
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 2. Decode and verify the token's signature and expiration
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            options={"verify_aud": False}, # Supabase tokens may not have a standard 'aud'
        )
        
        # 3. The user's unique ID from Supabase Auth is in the 'sub' claim
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing the 'sub' (user ID) claim",
            )
        
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )