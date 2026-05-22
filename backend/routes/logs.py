from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models.db_models import LogModel
from backend.models.schemas import LogCreateSchema, LogOutSchema

router = APIRouter(prefix="/api/logs", tags=["Logs"])

# Listar todos os logs
@router.get("", response_model=List[LogOutSchema])
def list_logs(db: Session = Depends(get_db)):
    return db.query(LogModel).order_by(LogModel.id.desc()).all()

# Criar um novo log
@router.post("", response_model=LogOutSchema)
def create_log(payload: LogCreateSchema, db: Session = Depends(get_db)):
    log = LogModel(
        date=payload.date,
        campaign=payload.campaign,
        contact=payload.contact,
        phone=payload.phone,
        message=payload.message,
        status=payload.status
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

# Limpar todos os logs
@router.delete("/clear")
def clear_logs(db: Session = Depends(get_db)):
    db.query(LogModel).delete()
    db.commit()
    return {"status": "success", "message": "Histórico de logs deletado com sucesso."}
