from dotenv import load_dotenv
import os

# Load environment variables from .env in the parent directory (server/)
# This assumes the .env file is in the server directory, NOT the config directory.
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=dotenv_path)

GROQ_API_KEY = os.getenv("GROQ_API")

# Add a confirmation print for the Groq key
if GROQ_API_KEY:
    print("✅ Groq API Key loaded successfully.")
else:
    print("⚠️ Groq API Key not found. Please check your .env file.")