from fastapi import APIRouter, HTTPException, status
from backend.models.schemas import LoginSchema

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])

@router.post("/login")
def login(payload: LoginSchema):
    if payload.username == "admin" and payload.password == "admin":
        return {
            "status": "success",
            "username": payload.username,
            "token": "zapflow-session-token-998877"
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Usuário ou senha incorretos."
    )
