import secrets
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import httpx

import models, schemas, auth
from database import get_db
from config import settings

router = APIRouter(prefix="/users")
logger = logging.getLogger(__name__)

async def _send_email(to_email: str, subject: str, body: str) -> None:
    resend_api_key = settings.RESEND_API_KEY
    resend_from = settings.RESEND_FROM
    
    logger.info(f"Checking email config: API_KEY={'set' if resend_api_key else 'NOT set'}, FROM={resend_from}")
    
    if not resend_api_key or not resend_from:
        logger.warning("Email service not configured. Skipping email send.")
        return

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": resend_from,
                    "to": [to_email],
                    "subject": subject,
                    "text": body,
                },
                timeout=20,
            )
            if response.status_code not in (200, 201):
                logger.error(f"Failed to send email via Resend: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to send email.",
                )
        except httpx.RequestError as exc:
            logger.error(f"Error while sending email: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Email service communication error",
            )


@router.post("/register", response_model=schemas.UserPublic, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    hashed = auth.hash_password(user.password)
    new_user = models.User(
        name=user.name,
        email=user.email,
        password=hashed,
        role="user",
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=schemas.TokenResponse)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if not db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    if not auth.verify_password(user.password, db_user.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wrong password")

    role = db_user.role or "user"
    access_token = auth.create_access_token(db_user.id, role)
    refresh_token = auth.create_refresh_token(db_user.id, role)
    refresh_hash = auth.hash_token(refresh_token)
    refresh_expiry = datetime.utcnow() + timedelta(days=auth.REFRESH_TOKEN_EXPIRE_DAYS)

    db.add(
        models.RefreshToken(
            user_id=db_user.id,
            token_hash=refresh_hash,
            expires_at=refresh_expiry,
            revoked=False,
        )
    )
    db.commit()

    return {"token": access_token, "refresh_token": refresh_token}


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh_token(payload: schemas.RefreshTokenRequest, db: Session = Depends(get_db)):
    token_hash = auth.hash_token(payload.refresh_token)
    db_token = (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.token_hash == token_hash)
        .first()
    )

    if not db_token or db_token.revoked or db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    db_user = db.query(models.User).filter(models.User.id == db_token.user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate refresh token
    db_token.revoked = True
    role = db_user.role or "user"
    new_access = auth.create_access_token(db_user.id, role)
    new_refresh = auth.create_refresh_token(db_user.id, role)
    new_refresh_hash = auth.hash_token(new_refresh)
    new_refresh_expiry = datetime.utcnow() + timedelta(days=auth.REFRESH_TOKEN_EXPIRE_DAYS)

    db.add(
        models.RefreshToken(
            user_id=db_user.id,
            token_hash=new_refresh_hash,
            expires_at=new_refresh_expiry,
            revoked=False,
        )
    )
    db.commit()

    return {"token": new_access, "refresh_token": new_refresh}


@router.get("/validate")
def validate_token(credentials: HTTPAuthorizationCredentials = Depends(auth.security)):
    payload = auth.decode_token(credentials.credentials)
    token_type = payload.get("type")
    if token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    user_id = payload.get("id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user id",
        )
    return {"user_id": int(user_id), "role": payload.get("role")}


@router.post("/forgot-password")
async def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not registered")

    otp = f"{secrets.randbelow(1000000):06d}"
    otp_hash = auth.hash_token(otp)
    db_user.reset_code_hash = otp_hash
    db_user.reset_code_expires_at = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    await _send_email(
        payload.email,
        "Your password reset code",
        f"Your OTP code is {otp}. It expires in 15 minutes.",
    )
    return {"message": "OTP has been sent."}


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email or OTP")

    if not db_user.reset_code_hash or not db_user.reset_code_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP not requested")

    if db_user.reset_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    if auth.hash_token(payload.otp) != db_user.reset_code_hash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")

    db_user.password = auth.hash_password(payload.new_password)
    db_user.reset_code_hash = None
    db_user.reset_code_expires_at = None
    db.commit()

    return {"message": "Password updated"}
