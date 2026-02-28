"""Run the backend server."""
import uvicorn
from app.config import get_settings

if __name__ == "__main__":
    s = get_settings()
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=s.DEBUG)
