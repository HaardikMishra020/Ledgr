import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import auth, expenses, groups, invites, ws
from app.ws.worker import run_outbox_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(run_outbox_worker())
    yield
    task.cancel()


app = FastAPI(title="Ledgr API", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(invites.router)
app.include_router(expenses.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
