from fastapi import FastAPI

app = FastAPI(
    title="Coworking Booking API",
    description="API платформы бронирования переговорных и коворкингов",
    version="1.0.0",
)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
