import sys
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure UTF-8 output encoding for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.core.config import settings
from app.core.logger import logger
from app.core.exceptions import NextStepException
from app.api.routes import router as ai_router
from api.rag_routes import router as rag_router
from api.skill_routes import router as skill_router
from api.recommend_routes import router as recommend_router

app = FastAPI(
    title="NextStep Career Guidance Platform - NVIDIA AI, Skill Graph & RAG Engine",
    description="Backend AI service powered by NVIDIA NIM GLM-5.3, Skill Knowledge Graph, deterministic skill verification, and semantic RAG pipeline.",
    version="1.0.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(ai_router)
app.include_router(rag_router)
app.include_router(skill_router)
app.include_router(recommend_router)


@app.exception_handler(NextStepException)
async def nextstep_exception_handler(request: Request, exc: NextStepException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.error_code,
            "message": exc.message,
        },
    )


@app.get("/")
def root():
    return {
        "platform": "NextStep Career Guidance",
        "ai_engine": "NVIDIA NIM GLM-5.3",
        "status": "online",
        "docs_url": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting NextStep API Server on {settings.host}:{settings.port}...")
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
