from sqlalchemy import Column, Integer, String
from backend.database import Base

class APIConfigModel(Base):
    __tablename__ = "api_configs"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, default="")
    key = Column(String, default="")
    instance = Column(String, default="")
    token = Column(String, default="")

class CampaignModel(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, default="promo")
    total = Column(Integer, default=0)
    sucesso = Column(Integer, default=0)
    falhas = Column(Integer, default=0)
    status = Column(String, default="Rodando")
    date = Column(String, nullable=False)

class LogModel(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, nullable=False)
    campaign = Column(String, nullable=False)
    contact = Column(String, default="Cliente")
    phone = Column(String, nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, default="Sucesso")

class VisualConfigModel(Base):
    __tablename__ = "visual_configs"

    id = Column(Integer, primary_key=True, index=True)
    login_bg_desktop = Column(String, default="")
    login_bg_mobile = Column(String, default="")
    logo_sidebar = Column(String, default="")
    logo_login = Column(String, default="")
