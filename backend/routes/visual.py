from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.db_models import VisualConfigModel
from backend.models.schemas import VisualConfigSchema

router = APIRouter(prefix="/api/visual-config", tags=["Configuração Visual"])

@router.get("")
def get_visual_config(db: Session = Depends(get_db)):
    config = db.query(VisualConfigModel).first()
    if not config:
        return {
            "login_bg_desktop": "",
            "login_bg_mobile": "",
            "logo_sidebar": "",
            "logo_login": ""
        }
    return {
        "login_bg_desktop": config.login_bg_desktop,
        "login_bg_mobile": config.login_bg_mobile,
        "logo_sidebar": config.logo_sidebar,
        "logo_login": config.logo_login
    }

@router.post("")
def save_visual_config(payload: VisualConfigSchema, db: Session = Depends(get_db)):
    config = db.query(VisualConfigModel).first()
    if not config:
        config = VisualConfigModel(
            login_bg_desktop=payload.login_bg_desktop,
            login_bg_mobile=payload.login_bg_mobile,
            logo_sidebar=payload.logo_sidebar,
            logo_login=payload.logo_login
        )
        db.add(config)
    else:
        config.login_bg_desktop = payload.login_bg_desktop
        config.login_bg_mobile = payload.login_bg_mobile
        config.logo_sidebar = payload.logo_sidebar
        config.logo_login = payload.logo_login
    
    db.commit()
    db.refresh(config)
    return {"status": "success", "message": "Configurações visuais salvas com sucesso."}
