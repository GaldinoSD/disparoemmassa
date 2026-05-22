from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models.db_models import CampaignModel
from backend.models.schemas import CampaignCreateSchema, CampaignUpdateSchema, CampaignOutSchema

router = APIRouter(prefix="/api/campaigns", tags=["Campanhas"])

# Listar todas as campanhas
@router.get("", response_model=List[CampaignOutSchema])
def list_campaigns(db: Session = Depends(get_db)):
    return db.query(CampaignModel).order_by(CampaignModel.id.desc()).all()

# Criar nova campanha
@router.post("", response_model=CampaignOutSchema)
def create_campaign(payload: CampaignCreateSchema, db: Session = Depends(get_db)):
    campaign = CampaignModel(
        name=payload.name,
        type=payload.type,
        total=payload.total,
        status=payload.status,
        date=payload.date
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign

# Atualizar progresso da campanha
@router.put("/{campaign_id}", response_model=CampaignOutSchema)
def update_campaign(campaign_id: int, payload: CampaignUpdateSchema, db: Session = Depends(get_db)):
    campaign = db.query(CampaignModel).filter(CampaignModel.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    
    campaign.sucesso = payload.sucesso
    campaign.falhas = payload.falhas
    campaign.status = payload.status
    
    db.commit()
    db.refresh(campaign)
    return campaign
