from fastapi import FastAPI

from app.routers import auth, expenses, groups, invites, ws

app = FastAPI(title="Ledgr API")

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(invites.router)
app.include_router(expenses.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
