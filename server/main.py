# server/main.py
from fastapi import FastAPI, HTTPException, status, UploadFile, File, Depends, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from gotrue.errors import AuthApiError
from config.supabaseClient import supabase
from db.duckdb import con, get_data_profile, suggest_type_conversions, convert_column_types, get_all_tables, auto_clean_and_prepare, handle_duplicates, impute_null_values, get_data_profile, find_duplicates, drop_columns, export_table_to_csv_string, clear_all_project_tables, get_llm_suggestions, get_chart_data, generate_statistical_summary, detect_data_insights
from supabase.lib.client_options import ClientOptions
from auth.auth import get_current_user
import pandas as pd
import io
from utils.utils import create_project_entry, get_user_projects, create_project_from_kaggle, decrypt_key, encrypt_key

# --- FastAPI App Initialization ---
app = FastAPI(title="DuckDB Data Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # The origin of your React frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers (like Authorization)
)

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
    
class HandleDuplicatesRequest(BaseModel):
    project_id: int
    strategy: str = "remove_all"

class ImputationTask(BaseModel):
    column_name: str
    strategy: str # e.g., "mean", "median", "mode", "custom"
    value: str | int | float | None = None # Required if strategy is "custom"

class ImputeNullsRequest(BaseModel):
    project_id: int
    imputations: list[ImputationTask]
    
class FindDuplicatesRequest(BaseModel):
    project_id: int
    primary_key_column: str | None = None
    
class DropColumnsRequest(BaseModel):
    project_id: int
    columns_to_drop: list[str]
    
class EdaRequest(BaseModel):
    project_id: int

# NEW: Pydantic models for EDA responses
class EdaSummaryResponse(BaseModel):
    numeric_summary: dict
    categorical_summary: dict
    correlation_matrix: list[dict]
    total_rows: int
    total_columns: int

class EdaInsight(BaseModel):
    type: str
    severity: str
    title: str
    description: str
    affected_columns: list[str]

class EdaInsightsResponse(BaseModel):
    insights: list[EdaInsight]

class ChartDataRequest(BaseModel):
    project_id: int
    chart_type: str
    x_axis: str
    y_axis: str | None = None
    
class KaggleCredentials(BaseModel):
    kaggle_username: str
    kaggle_api_key: str # Plain text received from user

class KaggleUploadRequest(BaseModel):
    dataset_url: str
    csv_filename: str | None = None
    project_name: str | None = None
    
class KaggleUsernameResponse(BaseModel):
    kaggle_username: str | None = None # Only return username, not key

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
        
# --- Get User Projects Endpoint [Protected] ---
@app.get("/projects/")
def list_user_projects(current_user: ClientOptions = Depends(get_current_user)):
    """
    Retrieves a list of all projects associated with the authenticated user.
    """
    try:
        user_id = current_user.id
        print(f"this is the user id: {user_id}")
        projects = get_user_projects(user_id)
        if projects is None:
            # This case handles exceptions from the util function
            raise HTTPException(status_code=500, detail="Could not retrieve projects.")
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

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
    
# --- Kaggle Dataset Upload and Profiling Endpoint [Protected] ---  # New endpoint

@app.get("/kaggle-credentials", response_model=KaggleUsernameResponse)
def get_kaggle_username(
    current_user: ClientOptions = Depends(get_current_user)
):
    """Retrieves the user's saved Kaggle username (if any). Does NOT return the key."""
    try:
        user_id = current_user.id
        print(f"Fetching Kaggle username for user: {user_id}")
        response = supabase.table('user_kaggle_credentials')\
                           .select('kaggle_username')\
                           .eq('user_id', user_id)\
                           .maybe_single()\
                           .execute()

        # Handle potential errors from Supabase
        if hasattr(response, 'error') and response.error:
             print(f"❌ Supabase error fetching username: {response.error.message}")
             raise HTTPException(status_code=500, detail="Failed to retrieve Kaggle username.")

        if response.data:
            username = response.data.get('kaggle_username')
            print(f"✅ Found username: {username}")
            return KaggleUsernameResponse(kaggle_username=username)
        else:
            print(f"⚠️ No Kaggle username found for user: {user_id}")
            return KaggleUsernameResponse(kaggle_username=None) # Return None if no credentials found

    except HTTPException as http_exc: # Re-raise known HTTP errors
        raise http_exc
    except Exception as e:
        print(f"❌ Error fetching Kaggle username for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred retrieving username: {str(e)}")

@app.post("/kaggle-credentials") # Removed default 201 status code here
def save_kaggle_credentials(
    creds: KaggleCredentials, # Expects kaggle_username and plain text kaggle_api_key
    response: Response, # Inject Response object to set status code dynamically
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Saves (Inserts or Updates) the user's encrypted Kaggle credentials.
    Returns 201 Created if credentials were newly saved.
    Returns 200 OK if existing credentials were updated.
    """
    try:
        user_id = current_user.id
        # Encrypt the API key before saving
        encrypted_key = encrypt_key(creds.kaggle_api_key) # Ensure encrypt_key is imported

        # --- Check if credentials already exist ---
        existing_creds_response = supabase.table('user_kaggle_credentials')\
                                          .select('user_id')\
                                          .eq('user_id', user_id)\
                                          .maybe_single()\
                                          .execute()

        # Handle potential fetch error during check
        if hasattr(existing_creds_response, 'error') and existing_creds_response.error:
            print(f"❌ Supabase error checking existing credentials: {existing_creds_response.error.message}")
            raise HTTPException(status_code=500, detail="Failed to check existing credentials.")

        existed_before = existing_creds_response.data is not None
        action_verb = "Updated" if existed_before else "Saved"
        success_status_code = status.HTTP_200_OK if existed_before else status.HTTP_201_CREATED

        print(f"{('Updating' if existed_before else 'Saving new')} credentials for user: {user_id}")
        # --- Perform Upsert ---
        upsert_response = supabase.table('user_kaggle_credentials').upsert({
            'user_id': user_id,
            'kaggle_username': creds.kaggle_username,
            'kaggle_api_key': encrypted_key # Store the encrypted key
        }).execute()

        # Basic check for errors during upsert
        if hasattr(upsert_response, 'error') and upsert_response.error:
             print(f"❌ Supabase upsert failed: {upsert_response.error.message}")
             raise HTTPException(status_code=500, detail=f"Failed to save credentials: {upsert_response.error.message}")
        # Check if data was returned (might indicate success differently in some versions)
        elif hasattr(upsert_response, 'data') and not upsert_response.data:
             print(f"❌ Supabase upsert warning: No data returned, but no explicit error.")
             # Consider if this is truly an error in your Supabase version, maybe just log it.
             # raise HTTPException(status_code=500, detail="Failed to save credentials (no data returned).")


        print(f"✅ Credentials {action_verb.lower()} successfully for user: {user_id}")
        response.status_code = success_status_code # Set status code based on existed_before
        return {
            "message": f"Kaggle credentials {action_verb.lower()} successfully.",
            "username": creds.kaggle_username, # Return username for frontend confirmation
            "status": action_verb # Explicitly state if saved or updated
        }

    except ValueError as ve: # Catch specific encryption errors
        print(f"❌ Encryption error for user {user_id}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as http_exc: # Re-raise known HTTP errors
        raise http_exc
    except Exception as e: # Catch other unexpected errors
        print(f"❌ Unexpected error saving Kaggle credentials for user {user_id}: {e}")
        error_msg = f"An unexpected server error occurred: {str(e)}"
        if hasattr(e, 'message'): error_msg = e.message
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/upload-from-kaggle/")
async def upload_and_profile_kaggle(
    request: KaggleUploadRequest, # Uses updated model without credentials
    response: Response,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Downloads Kaggle dataset using saved credentials.
    - If multiple CSVs found and none specified, returns 400 with a list for selection.
    - If successful (single/specified CSV), creates project, loads data, profiles, and returns 200.
    - Handles credential errors (400/500) and processing errors (500).
    """
    try:
        user_id = current_user.id

        # 1. Fetch saved credentials for the user
        print(f"Fetching Kaggle credentials for user: {user_id}")
        creds_response = supabase.table('user_kaggle_credentials')\
                                 .select('kaggle_username, kaggle_api_key')\
                                 .eq('user_id', user_id)\
                                 .maybe_single()\
                                 .execute()

        # Handle potential Supabase fetch error
        if hasattr(creds_response, 'error') and creds_response.error:
            print(f"❌ Supabase error fetching credentials: {creds_response.error.message}")
            raise HTTPException(status_code=500, detail="Failed to retrieve Kaggle credentials.")

        if not creds_response.data or not creds_response.data.get('kaggle_api_key') or not creds_response.data.get('kaggle_username'):
            print(f"⚠️ Kaggle credentials not found or incomplete for user: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kaggle credentials not found or incomplete. Please save them in the upload section."
            )

        kaggle_username = creds_response.data['kaggle_username']
        encrypted_api_key = creds_response.data['kaggle_api_key']
        print(f"✅ Credentials found for user: {kaggle_username}")

        # 2. Decrypt the API key
        try:
            decrypted_api_key = decrypt_key(encrypted_api_key)
            if not decrypted_api_key: # Double-check decryption didn't yield empty string
                 raise ValueError("Decrypted key is empty.")
            print("✅ API key decrypted successfully.")
        except ValueError as ve:
             print(f"❌ Decryption failed for user {user_id}: {ve}")
             raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to decrypt stored Kaggle API key: {str(ve)}. Please try saving credentials again."
            )

        # 3. Call the utils function (can raise Exceptions)
        print(f"Calling create_project_from_kaggle for dataset: {request.dataset_url}, file: {request.csv_filename}")
        project_id, df, csv_files_list = create_project_from_kaggle(
            user_id=user_id,
            dataset_url=request.dataset_url,
            kaggle_username=kaggle_username,
            decrypted_kaggle_api_key=decrypted_api_key, # Pass decrypted key
            csv_filename=request.csv_filename, # Pass user's choice if provided
            project_name=request.project_name
        )

        # 4. Handle different outcomes from the utility function
        if csv_files_list:
            # ---> Multiple CSVs found, selection needed by frontend
            print(f"Multiple CSVs found, returning list to frontend: {csv_files_list}")
            response.status_code = status.HTTP_400_BAD_REQUEST # Use 400 to indicate user action needed
            return {
                "detail": "Multiple CSV files found in the dataset.",
                "action_required": "select_csv",
                "csv_files": csv_files_list # Send the list to the frontend
            }
        elif project_id is not None and df is not None:
            # ---> Success: CSV loaded, project created
            print(f"✅ Successfully created project ID: {project_id}")
            table_name = f"project_{project_id}"
            try:
                print(f"Profiling data for table: {table_name}")
                profile = get_data_profile(table_name=table_name)
                profile['project_id'] = project_id # Ensure project_id is in profile
                print(f"✅ Profiling complete.")
                # Can use 201 if it's guaranteed new, 200 is fine for "OK" response
                response.status_code = status.HTTP_200_OK
                return {
                    "message": "Kaggle dataset loaded and project created successfully.",
                    "project_id": project_id,
                    "profile": profile
                }
            except Exception as profile_error:
                 # Handle case where profiling fails even after successful load
                 print(f"❌ Error profiling data after Kaggle import (Project ID: {project_id}): {profile_error}")
                 raise HTTPException(status_code=500, detail="Kaggle data loaded successfully, but failed to generate data profile.")
        else:
            # ---> General Error during download/processing in utils caught and returned None
            # The specific error should have been printed in utils.py logs
             print(f"❌ create_project_from_kaggle returned None without CSV list for user {user_id}")
             # This path usually indicates an error already logged in utils.py
             error_detail = "Failed to process Kaggle dataset after download. Check server logs for specific errors (e.g., file reading issues, DB errors)."
             raise HTTPException(status_code=500, detail=error_detail)

    except ValueError as ve:
         # Catch ValueErrors raised explicitly (e.g., invalid URL, specified CSV not found)
         print(f"❌ Value Error during Kaggle processing: {ve}")
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except HTTPException as http_exc:
        # Re-raise known HTTP exceptions (like 400 for missing creds, 500 for decryption)
        raise http_exc
    except Exception as e:
        # Catch any other unexpected errors (e.g., Kaggle API errors, disk issues)
        print(f"❌ Unexpected error in /upload-from-kaggle endpoint: {str(e)}")
        import traceback
        traceback.print_exc() # Print full traceback to logs for debugging
        raise HTTPException(status_code=500, detail="An unexpected server error occurred during Kaggle import.")
    
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
            "new_profile_summary": new_profile_sample
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
# --- Find Duplicates endpoint [protected] ---
@app.post("/find-duplicates/")
def run_find_duplicates(
    request_body: FindDuplicatesRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Finds duplicates. If a primary_key_column is provided, it's used for
    entity detection. Otherwise, a heuristic is used.
    """
    try:
        table_name = f"project_{request_body.project_id}"
        result = find_duplicates(table_name, request_body.primary_key_column)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
# --- Data Duplication endpoint [protected] ---

@app.post("/handle-duplicates/")
def run_handle_duplicates(
    request_body: HandleDuplicatesRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Handles duplicate rows in the dataset based on a specified strategy.
    """
    try:
        table_name = f"project_{request_body.project_id}"
        result = handle_duplicates(table_name, request_body.strategy)
        
        # After handling duplicates, return the updated project status
        new_profile = get_data_profile(table_name)
        return {
            "message": result.get("message"),
            "new_profile_summary": new_profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
# --- Impute Null Values endpoint [protected] ---
@app.post("/impute-nulls/")
def run_impute_nulls(
    request_body: ImputeNullsRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Fills (imputes) NULL values in specified columns using different strategies.
    """
    try:
        table_name = f"project_{request_body.project_id}"
        imputations_list = [task.dict() for task in request_body.imputations]
        
        result = impute_null_values(table_name, imputations_list)
        
        # After imputation, return the updated project status
        new_profile = get_data_profile(table_name)
        return {
            "message": result.get("message"),
            "operations_log": result.get("operations_log"),
            "new_profile_summary": new_profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
# --- Drop Columns endpoint [protected] ---
    
@app.post("/drop-columns/")
def run_drop_columns(
    request_body: DropColumnsRequest,
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Permanently drops one or more columns from the project's dataset.
    """
    try:
        table_name = f"project_{request_body.project_id}"
        result = drop_columns(table_name, request_body.columns_to_drop)
        
        # After dropping, return the updated project status so the UI can refresh
        new_profile = get_data_profile(table_name)
        return {
            "message": result.get("message"),
            "new_profile_summary": new_profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
# --- Export Cleaned Data Endpoint [Protected] ---
@app.post("/export-csv/")
def export_project_csv(
    project: ProjectRequest, # Re-using the ProjectRequest model
    current_user: ClientOptions = Depends(get_current_user)
):
    """
    Exports the current state of the project's data table as a downloadable CSV file.
    """
    try:
        table_name = f"project_{project.project_id}"
        
        # Get the CSV data as a single string
        csv_data = export_table_to_csv_string(table_name)
        
        # Create a filename for the download
        # We'll retrieve the original filename from our Supabase project table
        response = supabase.table('user_projects').select('project_name').eq('id', project.project_id).single().execute()
        original_filename = response.data.get('project_name', 'data.csv')
        cleaned_filename = f"cleaned_{original_filename}"

        # Use StreamingResponse to send the data
        return StreamingResponse(
            iter([csv_data]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={cleaned_filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during CSV export: {str(e)}")
    
# --- Admin Endpoint to Clear All Project Tables [Protected]---
    
@app.post("/admin/clear-database/", status_code=status.HTTP_200_OK)
def clear_database(current_user: dict = Depends(get_current_user)):
    """
    [Admin] Clears all 'project_' tables from the DuckDB database.
    This is a protected endpoint.
    """
    try:
        # For now, we allow any authenticated user to do this.
        # In a production app, you would add a role check:
        # if current_user.get('role') != 'admin':
        #     raise HTTPException(status_code=403, detail="Not authorized")
        
        result = clear_all_project_tables()
        return {"detail": result.get("message")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# --- NEW: EDA Endpoints ---

@app.post("/eda-summary/")
def get_eda_summary(
    project: EdaRequest,
    current_user: ClientOptions = Depends(get_current_user)
) -> EdaSummaryResponse:
    """
    Retrieves the statistical summary and correlation matrix for the dataset.
    """
    try:
        table_name = f"project_{project.project_id}"
        summary = generate_statistical_summary(table_name)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.post("/eda-insights/")
def get_eda_insights(
    project: EdaRequest,
    current_user: ClientOptions = Depends(get_current_user)
) -> EdaInsightsResponse:
    """
    Retrieves automated insights (outliers, high correlation, etc.) for the dataset.
    """
    try:
        table_name = f"project_{project.project_id}"
        insights_data = detect_data_insights(table_name)
        return insights_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.post("/suggest-llm-visualizations/")
def suggest_eda_visualizations(
    request_body: EdaRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generates EDA suggestions for a project using an LLM.
    """
    try:
        table_name = f"project_{request_body.project_id}"
        suggestions = get_llm_suggestions(table_name)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-chart-data/")
def fetch_data_for_chart(
    request_body: ChartDataRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetches data formatted for a specific chart type.
    """
    try:
        table_name = f"project_{request_body.project_id}"
        chart_data = get_chart_data(
            table_name, 
            request_body.chart_type, 
            request_body.x_axis, 
            request_body.y_axis
        )
        return {"chart_data": chart_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))