from supabase import create_client, Client
from dotenv import load_dotenv
import os

# Load environment variables from .env in current directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise Exception("❌ .env values not loaded properly!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

print("✅ Supabase URL:", SUPABASE_URL)
print("✅ Supabase Key:", SUPABASE_ANON_KEY[:8] + "...")
