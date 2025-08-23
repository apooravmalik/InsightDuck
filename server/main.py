# main.py
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr
from gotrue.errors import AuthApiError
from config.supabaseClient import supabase # Import your configured Supabase client

# --- FastAPI App Initialization ---
app = FastAPI(title="DuckDB Data Agent", version="0.1.0")

# --- Pydantic Models for Auth ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# --- API Endpoints ---

@app.get("/")
def read_root():
    """
    Root endpoint to check if the server is running.
    """
    return {"message": "Welcome to the DuckDB Data Agent API!"}

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user_credentials: UserCreate):
    """
    Registers a new user in Supabase.
    """
    try:
        # Use the imported Supabase client to sign up the user
        response = supabase.auth.sign_up({
            "email": user_credentials.email,
            "password": user_credentials.password,
        })
        return {"message": "User registered successfully. Please check your email to confirm."}
    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@app.post("/login")
def login_user(user_credentials: UserLogin):
    """
    Logs in a user and returns a session object with an access token.
    """
    try:
        # Use the imported Supabase client to sign in the user
        session = supabase.auth.sign_in_with_password({
            "email": user_credentials.email,
            "password": user_credentials.password
        })
        return session
    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message or "Invalid login credentials"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )