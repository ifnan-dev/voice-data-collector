from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Afaan Oromo Speech Data Collection API",
    version="1.0.0",
    description="Backend for collecting Afaan Oromo speech recordings and transcriptions.",
)

# CORS: allow the Expo dev client. Restrict origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api")


@app.get("/")
async def root():
    return {"service": "Afaan Oromo Speech Data Collection API", "version": "1.0.0"}
