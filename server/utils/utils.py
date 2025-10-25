from config.supabaseClient import supabase 
import glob
import os
from urllib.parse import urlparse
import pandas as pd
import shutil  # For cleanup
from db.duckdb import get_connection  # Import to load into DuckDB
from cryptography.fernet import Fernet
import base64
import threading
import sys
import importlib

# --- Load Encryption Key ---
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    raise RuntimeError("ENCRYPTION_KEY not found in environment variables. Please set it in .env")
try:
    # Validate the key format and create Fernet instance
    fernet = Fernet(ENCRYPTION_KEY.encode())
    print("✅ Encryption key loaded successfully.")
except (ValueError, TypeError) as e:
    raise RuntimeError(f"Invalid ENCRYPTION_KEY format: {e}")

# Thread-local storage for Kaggle credentials
_thread_local = threading.local()

# --- Encryption/Decryption Functions ---

def encrypt_key(api_key: str) -> str:
    """Encrypts the Kaggle API key using the server's secret key."""
    if not api_key:
        return ""
    try:
        encrypted_bytes = fernet.encrypt(api_key.encode())
        # Store as URL-safe base64 string for easier DB storage (TEXT column)
        return base64.urlsafe_b64encode(encrypted_bytes).decode()
    except Exception as e:
        print(f"❌ Error encrypting key: {e}")
        raise ValueError("Encryption failed.") # Re-raise for endpoint handling

def decrypt_key(encrypted_api_key: str) -> str:
    """Decrypts the Kaggle API key using the server's secret key."""
    if not encrypted_api_key:
        return ""
    try:
        # Decode from base64 first
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_api_key.encode())
        decrypted_bytes = fernet.decrypt(encrypted_bytes)
        return decrypted_bytes.decode()
    except Exception as e:
        print(f"❌ Error decrypting key: {e}")
        # Raising is often better to signal a problem.
        raise ValueError("Decryption failed. Key might be invalid or corrupted.")

def create_project_entry(user_id: str, project_name: str, storage_file_name: str):
    """
    Inserts a new project record into the user_projects table and returns the new project's ID.
    """
    try:
        response = supabase.table('user_projects').insert({
            'user_id': user_id,
            'project_name': project_name,
            'storage_file_name': storage_file_name
        }).execute()

        if response.data:
            new_project_id = response.data[0]['id']
            print(f"✅ Successfully created project record with ID: {new_project_id}")
            return new_project_id
        else:
            raise Exception("Failed to create project record: No data returned.")

    except Exception as e:
        print(f"❌ Error creating project entry in Supabase: {e}")
        return None
    
def get_user_projects(user_id: str):
    """
    Fetches all projects for a given user_id from the user_projects table.
    """
    try:
        response = supabase.table('user_projects').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        if response.data:
            return response.data
        return [] # Return an empty list if no projects are found
    except Exception as e:
        print(f"❌ Error fetching user projects from Supabase: {e}")
        return None
    
def setup_kaggle_auth(user_username: str, api_key: str):
    """
    Dynamically sets up Kaggle authentication via environment variables.
    
    Args:
        user_username (str): Your Kaggle username.
        api_key (str): Your Kaggle API token (the 'key' value from kaggle.json).
    """
    os.environ['KAGGLE_USERNAME'] = user_username
    os.environ['KAGGLE_KEY'] = api_key

def _get_kaggle_api_with_credentials(username: str, api_key: str):
    """
    Creates and authenticates a Kaggle API instance with provided credentials.
    Uses environment variables temporarily in a thread-safe manner.
    """
    # Store original values
    original_username = os.environ.get('KAGGLE_USERNAME')
    original_key = os.environ.get('KAGGLE_KEY')
    
    try:
        # Set credentials for this request
        os.environ['KAGGLE_USERNAME'] = username
        os.environ['KAGGLE_KEY'] = api_key
        
        # Force reload of kaggle module to pick up new credentials
        # This is necessary because kaggle caches credentials on first import
        if 'kaggle' in sys.modules:
            # Remove kaggle and its submodules from cache
            modules_to_remove = [key for key in sys.modules.keys() if key.startswith('kaggle')]
            for module in modules_to_remove:
                del sys.modules[module]
        
        # Now import fresh with new credentials
        from kaggle.api.kaggle_api_extended import KaggleApi
        
        api = KaggleApi()
        api.authenticate()
        
        return api
        
    finally:
        # Restore or clear original values
        if original_username is not None:
            os.environ['KAGGLE_USERNAME'] = original_username
        elif 'KAGGLE_USERNAME' in os.environ:
            del os.environ['KAGGLE_USERNAME']
            
        if original_key is not None:
            os.environ['KAGGLE_KEY'] = original_key
        elif 'KAGGLE_KEY' in os.environ:
            del os.environ['KAGGLE_KEY']

def create_project_from_kaggle(
    user_id: str,
    dataset_url: str,
    kaggle_username: str,
    decrypted_kaggle_api_key: str,
    csv_filename: str | None = None,
    project_name: str = None,
    download_path: str = './temp_kaggle_downloads'
) -> tuple[int | None, pd.DataFrame | None, list[str] | None]:
    """
    Downloads a Kaggle dataset using user-provided credentials and loads it into the database.
    
    Args:
        user_id: The ID of the user creating the project
        dataset_url: Full Kaggle dataset URL
        kaggle_username: User's Kaggle username
        decrypted_kaggle_api_key: User's decrypted Kaggle API key
        csv_filename: Optional specific CSV file to load
        project_name: Optional custom project name
        download_path: Temporary download location
        
    Returns:
        Tuple of (project_id, dataframe, csv_files_list)
        - If multiple CSVs and none specified: (None, None, [list of csv files])
        - If successful: (project_id, dataframe, None)
        - If error: raises Exception
    """

    conn = get_connection()
    download_path = os.path.abspath(download_path)

    try:
        # --- Parse URL ---
        parsed_url = urlparse(dataset_url)
        path_parts = parsed_url.path.strip('/').split('/')
        if len(path_parts) < 3 or path_parts[0] != 'datasets':
            raise ValueError("Invalid Kaggle dataset URL. Expected format: https://www.kaggle.com/datasets/owner/dataset-slug")
        owner, slug = path_parts[1], path_parts[2]
        dataset = f"{owner}/{slug}"
        default_project_name = slug.replace('-', '_')
        project_name = project_name or default_project_name
        project_name = "".join(c for c in project_name if c.isalnum() or c in ('_')).rstrip()
        storage_file_name = f"{user_id}_{project_name}"

        # --- Get authenticated API instance ---
        print(f"Authenticating Kaggle API for user: {kaggle_username}")
        api = _get_kaggle_api_with_credentials(kaggle_username, decrypted_kaggle_api_key)
        print("✅ Kaggle API authenticated for this request.")

        # --- Download ---
        if os.path.exists(download_path):
             shutil.rmtree(download_path)
        os.makedirs(download_path, exist_ok=True)
        print(f"Downloading dataset '{dataset}' to {download_path}...")
        api.dataset_download_files(dataset, path=download_path, unzip=True)
        print("✅ Dataset downloaded and unzipped.")

        # --- Find CSV Files ---
        csv_files_full_path = glob.glob(os.path.join(download_path, '*.csv'))
        csv_filenames_only = [os.path.basename(f) for f in csv_files_full_path]

        if not csv_filenames_only:
            raise ValueError(f"No CSV files found in the downloaded dataset.")

        csv_to_load_path = None

        if csv_filename:
            if csv_filename in csv_filenames_only:
                csv_to_load_path = os.path.join(download_path, csv_filename)
            else:
                 raise ValueError(f"Specified CSV '{csv_filename}' not found. Available files: {', '.join(csv_filenames_only)}")
        elif len(csv_filenames_only) == 1:
            csv_to_load_path = csv_files_full_path[0]
            print(f"Found single CSV: {csv_filenames_only[0]}")
        else:
            print(f"Multiple CSVs found: {', '.join(csv_filenames_only)}. Returning list for user selection.")
            if os.path.exists(download_path):
                 shutil.rmtree(download_path)
            return None, None, csv_filenames_only # Return list

        # --- Load Specified/Single CSV ---
        if csv_to_load_path:
            print(f"Reading CSV: {os.path.basename(csv_to_load_path)}")
            df = pd.read_csv(csv_to_load_path, dtype=str, keep_default_na=False)
            df.replace('', None, inplace=True)

            project_id = create_project_entry(user_id, project_name, storage_file_name)
            if not project_id:
                raise Exception("Failed to create project entry in Supabase database.")

            table_name = f"project_{project_id}"
            print(f"Loading data into DuckDB table: {table_name}")
            conn.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM df;")
            print("✅ Data loaded into DuckDB.")

            if os.path.exists(download_path):
                 shutil.rmtree(download_path)
            return project_id, df, None # Success

        else:
             raise Exception("Internal error: CSV path determination failed unexpectedly.")

    except Exception as e:
        print(f"❌ Error during Kaggle project creation/loading: {e}")
        if isinstance(e, ValueError): # Re-raise specific user-facing errors
            raise e
        # Raise a general exception for other errors
        raise Exception(f"Failed during Kaggle processing: {e}")
    finally:
         if os.path.exists(download_path):
            try:
                shutil.rmtree(download_path)
                print(f"🧹 Final cleanup check removed directory: {download_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Error during final cleanup check for {download_path}: {cleanup_error}")