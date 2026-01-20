from fastapi import FastAPI

from app.routers import auth, expenses, groups, invites

app = FastAPI(title="Ledgr API")

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(invites.router)
app.include_router(expenses.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
