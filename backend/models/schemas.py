from pydantic import BaseModel
from typing import Optional

class LoginSchema(BaseModel):
    username: str
    password: str

class APIConfigSchema(BaseModel):
    url: str
    key: str
    instance: str
    token: Optional[str] = ""

class CampaignCreateSchema(BaseModel):
    name: str
    type: str
    total: int
    status: str
    date: str

class CampaignUpdateSchema(BaseModel):
    sucesso: int
    falhas: int
    status: str

class LogCreateSchema(BaseModel):
    date: str
    campaign: str
    contact: str
    phone: str
    message: str
    status: str

# Schemas de retorno (Output)
class CampaignOutSchema(BaseModel):
    id: int
    name: str
    type: str
    total: int
    sucesso: int
    falhas: int
    status: str
    date: str

    class Config:
        from_attributes = True

class LogOutSchema(BaseModel):
    id: int
    date: str
    campaign: str
    contact: str
    phone: str
    message: str
    status: str

    class Config:
        from_attributes = True

class VisualConfigSchema(BaseModel):
    login_bg_desktop: Optional[str] = ""
    login_bg_mobile: Optional[str] = ""
    logo_sidebar: Optional[str] = ""
    logo_login: Optional[str] = ""
