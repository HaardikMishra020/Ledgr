from fastapi import FastAPI

app = FastAPI(title="Ledgr API")


@app.get("/health")
async def health():
    return {"status": "ok"}
