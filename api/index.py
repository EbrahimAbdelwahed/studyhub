from app.main import app
from mangum import Mangum

# Vercel serverless entrypoint
handler = Mangum(app)
