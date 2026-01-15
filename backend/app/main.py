from fastapi import FastAPI

from app.routers import auth, groups

app = FastAPI(title="Ledgr API")

app.include_router(auth.router)
app.include_router(groups.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
