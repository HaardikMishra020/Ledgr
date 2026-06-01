import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.fx.rates import run_daily_fx_job
from app.routers import activity, auth, expenses, groups, invites, users, ws
from app.ws.worker import run_outbox_worker

UPLOAD_DIR = Path("uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = [
        asyncio.create_task(run_outbox_worker()),
        asyncio.create_task(run_daily_fx_job()),
    ]
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(title="Ledgr API", lifespan=lifespan)

_origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/avatars", StaticFiles(directory="uploads/avatars"), name="avatars")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(invites.router)
app.include_router(expenses.router)
app.include_router(ws.router)
app.include_router(activity.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
