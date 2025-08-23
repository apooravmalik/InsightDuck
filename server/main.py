# main.py
from fastapi import FastAPI, HTTPException, status, UploadFile, File, Depends
from pydantic import BaseModel, EmailStr
from gotrue.errors import AuthApiError
from config.supabaseClient import supabase
from db.duckdb import con, get_data_profile, suggest_type_conversions, convert_column_types, get_all_tables, auto_clean_and_prepare
from supabase.lib.client_options import ClientOptions
from auth.auth import get_current_user
import pandas as pd
import io
from utils.utils import create_project_entry

# --- FastAPI App Initialization ---
app = FastAPI(title="DuckDB Data Agent", version="0.1.0")

# --- Pydantic Models ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    
class ProjectRequest(BaseModel):
    project_id: int
    
class ColumnConversion(BaseModel):
    column_name: str
    new_type: str

class ConvertTypesRequest(BaseModel):
    project_id: int
    conversions: list[ColumnConversion]

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

# --- Check for db health ---
@app.get("/health/duckdb-tables", tags=["Health"])
def get_duckdb_tables():
    """
    Health check endpoint to list all tables currently in the DuckDB instance.
    Useful for debugging in-memory table persistence.
    """
    try:
        tables = get_all_tables()
        return {
            "message": "Current tables in DuckDB memory.",
            "tables": tables
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# --- Get Project Status Endpoint [Protected] ---

@app.post("/get-project-status/")
def get_project_status(
    project: ProjectRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Retrieves the full, up-to-date data profile for a given project table.
    Ideal for refreshing the frontend after any cleaning or conversion operation.
    """
    try:
        table_name = f"project_{project.project_id}"

        # We can directly reuse our existing get_data_profile function
        current_profile = get_data_profile(table_name=table_name)

        return {
            "message": "Current project status retrieved successfully.",
            "project_id": project.project_id,
            "profile": current_profile
        }
    except Exception as e:
        # This will catch errors if the table doesn't exist for some reason
        if "does not exist" in str(e):
             raise HTTPException(status_code=404, detail=f"Project with ID {project.project_id} not found or data table is missing.")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
        
# --- CSV upload and Profiling Endpoint [Protected] ---

@app.post("/upload-and-profile/")
async def upload_and_profile_csv(
    file: UploadFile = File(...),
    current_user: ClientOptions = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV.")

    try:
        # 1. Create the project entry in Supabase DB
        user_id = current_user.id
        project_name = file.filename
        storage_file_name = f"{user_id}_{project_name}"
        
        project_id = create_project_entry(user_id, project_name, storage_file_name)
        if not project_id:
            raise HTTPException(status_code=500, detail="Could not create project entry in the database.")

        # 2. Define a unique table name for DuckDB using the new project_id
        table_name = f"project_{project_id}"

        # 3. Process and load the data into DuckDB
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False)
        df.replace('', None, inplace=True)
        
        con.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM df;")

        # 4. Profile the data and return results
        profile = get_data_profile(table_name=table_name)

        return {
            "message": "File uploaded and project created successfully.",
            "project_id": project_id, # Return the stable ID from the database
            "profile": profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
# --- Clean Data Endpoint [Protected] ---

@app.post("/auto-clean/")
def run_auto_clean(
    project: ProjectRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Runs a powerful, automated cleaning and preparation script on the dataset.
    """
    try:
        table_name = f"project_{project.project_id}"
        
        # Call the new, more comprehensive function
        result = auto_clean_and_prepare(table_name)
        
        # Return a new profile to show the results of the cleaning
        new_profile = get_data_profile(table_name)
        
        return {
            "message": result.get("message"),
            "operations_log": result.get("operations_log"),
            "new_profile_summary": new_profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

# --- Format Conversion Endpoints [Protected] ---

@app.post("/suggest-conversions/")
def get_suggested_conversions(
    project: ProjectRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    try:
        # Reconstruct the table name using the project_id
        table_name = f"project_{project.project_id}"
        
        # Verify the user owns this project (optional but good for security)
        # This check is implicitly handled by our RLS policies if we were to query the project table
        
        suggestions = suggest_type_conversions(table_name)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@app.post("/convert-types/")
def apply_type_conversions(
    request_body: ConvertTypesRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Applies the specified data type conversions to the user's project table.
    """
    try:
        table_name = f"project_{request_body.project_id}"
        
        # Convert Pydantic models to simple dicts for the db function
        conversions_list = [conv.dict() for conv in request_body.conversions]

        result = convert_column_types(table_name, conversions_list)
        
        # After converting, let's return a new preview to show the changes
        new_profile_sample = get_data_profile(table_name)
        
        return {
            "message": "Type conversions applied successfully.",
            "new_profile_summary": {
                "schema": new_profile_sample.get("schema"),
                "sample_preview": new_profile_sample.get("sample_preview")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
