import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.fx.rates import run_daily_fx_job
from app.routers import auth, expenses, groups, invites, ws
from app.ws.worker import run_outbox_worker


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(invites.router)
app.include_router(expenses.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
