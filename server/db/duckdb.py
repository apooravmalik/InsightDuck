# server/db/duckdb.py
import duckdb
import os
import re

# --- Persistent DuckDB Connection ---
# Define the path for the database file
db_file_path = os.path.join(os.path.dirname(__file__), 'insightduck.db')

# This will now create a file named 'insightduck.db' in your 'db' folder
# and use it for all storage. If the file exists, it reconnects to it.
con = duckdb.connect(database=db_file_path, read_only=False)
print(f"✅ DuckDB persistent database initialized at: {db_file_path}")

# --- Health Check Function ---
def get_all_tables():
    """
    Returns a list of all tables currently in the DuckDB database.
    """
    try:
        tables_df = con.execute("SHOW TABLES;").fetchdf()
        return tables_df['name'].tolist()
    except Exception as e:
        raise RuntimeError(f"Could not fetch tables: {e}")

# --- Data Profiling Function ---
def get_data_profile(table_name: str):
    """
    Runs a series of profiling queries on a DuckDB table.
    """
    try:
        # 1. Get schema and column names
        schema_df = con.execute(f"DESCRIBE {table_name};").fetchdf()
        schema = schema_df.to_dict('records')
        column_names = schema_df['column_name'].tolist()

        # 2. Get total row and column count
        total_rows = con.execute(f"SELECT COUNT(*) FROM {table_name};").fetchone()[0]
        total_columns = len(schema)

        # 3. Calculate null counts for columns that have them (efficiently)
        null_counts_clauses = [f"SUM(CASE WHEN \"{col}\" IS NULL THEN 1 ELSE 0 END) AS \"{col}\"" for col in column_names]
        null_counts_query = f"SELECT {', '.join(null_counts_clauses)} FROM {table_name};"
        null_counts_result = con.execute(null_counts_query).fetchdf()
        null_counts = {col: int(null_counts_result[col][0]) for col in null_counts_result.columns if null_counts_result[col][0] > 0}

        duplicates_count_query = f"""
        SELECT 
            (SELECT COUNT(*) FROM {table_name}) - 
            (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {table_name}))
        """
        duplicates_count = con.execute(duplicates_count_query).fetchone()[0]

        # 5. Get a sample preview of the data
        sample_preview = con.execute(f"SELECT * FROM {table_name} LIMIT 5;").fetchdf().to_dict('records')

        # 6. Assemble the final profile object
        profile = {
            "total_rows": total_rows,
            "total_columns": total_columns,
            "schema": schema,
            "null_counts": null_counts,
            "duplicates_count": duplicates_count,
            "sample_preview": sample_preview
        }
        return profile
    except Exception as e:
        raise RuntimeError(f"Failed to profile data: {e}")
    
    
def suggest_type_conversions(table_name: str):
    """
    Analyzes VARCHAR columns and suggests potential data type conversions.
    """
    schema_df = con.execute(f"DESCRIBE {table_name};").fetchdf()
    varchar_columns = schema_df[schema_df['column_type'] == 'VARCHAR']['column_name'].tolist()
    
    suggestions = []
    total_rows = con.execute(f"SELECT COUNT(*) FROM {table_name};").fetchone()[0]

    for col in varchar_columns:
        # --- Attempt to cast to DOUBLE (for numeric) ---
        # We use TRY_CAST which returns NULL if the conversion fails.
        numeric_non_null_count_query = f"""
        SELECT COUNT(*) 
        FROM {table_name} 
        WHERE TRY_CAST(\"{col}\" AS DOUBLE) IS NOT NULL;
        """
        numeric_count = con.execute(numeric_non_null_count_query).fetchone()[0]

        # Calculate the percentage of rows that could be converted
        # We also check for empty strings in the original column
        original_non_empty_count_query = f"""
        SELECT COUNT(*) FROM {table_name} WHERE \"{col}\" IS NOT NULL AND \"{col}\" != '';
        """
        original_non_empty_count = con.execute(original_non_empty_count_query).fetchone()[0]

        if original_non_empty_count > 0 and (numeric_count / original_non_empty_count) > 0.95:
             suggestions.append({
                "column_name": col,
                "current_type": "VARCHAR",
                "suggested_type": "DOUBLE", # Using DOUBLE to handle decimals
                "confidence": round(numeric_count / original_non_empty_count, 2)
            })
            
    return suggestions


def convert_column_types(table_name: str, conversions: list[dict]):
    """
    Safely converts the data type of specified columns using a create, test, 
    and replace strategy to prevent errors from bad values.
    """
    try:
        report = []
        for conv in conversions:
            col = conv.get("column_name")
            new_type = conv.get("new_type")
            
            if not col or not new_type:
                continue

            safe_col_name = f'"{col}"'
            temp_col_name = f'"{col}_temp_conversion"'

            try:
                # Step 1: Count initial nulls in the original column
                initial_nulls = con.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {safe_col_name} IS NULL;").fetchone()[0]

                # Step 2: Create a new column with the attempted conversion
                con.execute(f"ALTER TABLE {table_name} ADD COLUMN {temp_col_name} {new_type};")
                con.execute(f"UPDATE {table_name} SET {temp_col_name} = TRY_CAST({safe_col_name} AS {new_type});")

                # Step 3: Count nulls in the new column
                new_nulls = con.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {temp_col_name} IS NULL;").fetchone()[0]

                # Step 4: Calculate conversion failures
                conversion_failures = new_nulls - initial_nulls

                # Step 5: Replace the original column
                con.execute(f"ALTER TABLE {table_name} DROP COLUMN {safe_col_name};")
                con.execute(f"ALTER TABLE {table_name} RENAME COLUMN {temp_col_name} TO {safe_col_name};")
                
                report.append({
                    "column_name": col,
                    "status": "Success",
                    "new_type": new_type,
                    "conversion_failures": conversion_failures
                })

            except Exception as col_error:
                # If anything goes wrong for a single column, log it and continue
                report.append({
                    "column_name": col,
                    "status": "Failed",
                    "error": str(col_error)
                })
        
        print(f"✅ Successfully applied type conversions to table {table_name}.")
        return {"status": "success", "message": "Type conversion process completed.", "report": report}

    except Exception as e:
        raise RuntimeError(f"A critical error occurred during the conversion process: {e}")
    
def auto_clean_and_prepare(table_name: str):
    """
    Performs a comprehensive set of automated data cleaning and preparation tasks
    based on a standard data analyst checklist.
    """
    try:
        operations_log = []

        # --- 1. Structural Cleaning: Column Names ---
        schema_df = con.execute(f"DESCRIBE {table_name};").fetchdf()
        for _, row in schema_df.iterrows():
            original_name = row['column_name']
            
            # Convert to snake_case
            s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', original_name)
            new_name = re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
            
            # Remove special characters
            new_name = re.sub(r'[^a-zA-Z0-9_]', '', new_name)

            if original_name != new_name:
                con.execute(f'ALTER TABLE {table_name} RENAME COLUMN "{original_name}" TO "{new_name}";')
                operations_log.append(f"Renamed column '{original_name}' to '{new_name}'.")

        # Re-fetch schema after renaming
        schema_df = con.execute(f"DESCRIBE {table_name};").fetchdf()

        # --- 2. Value Cleaning (Whitespace, Unify Nulls, Casing) ---
        varchar_columns = schema_df[schema_df['column_type'] == 'VARCHAR']['column_name'].tolist()
        
        for col_name in varchar_columns:
            safe_col_name = f'"{col_name}"'
            
            # Trim leading/trailing whitespace from all values
            con.execute(f"UPDATE {table_name} SET {safe_col_name} = TRIM({safe_col_name});")

            # Unify common null-like strings to actual NULL
            null_like_values = ['N/A', 'NA', 'null', 'Null', '?', '', ' ']
            con.execute(f"UPDATE {table_name} SET {safe_col_name} = NULL WHERE {safe_col_name} IN {tuple(null_like_values)};")
            
            # Standardize casing for categorical data (convert to Title Case)
            # This is a good general approach for consistency ("male", "MALE" -> "Male")
            con.execute(f"UPDATE {table_name} SET {safe_col_name} = ucase({safe_col_name});")
        
        operations_log.append(f"Cleaned whitespace, unified nulls, and standardized casing for all text columns.")
        
        # Note: Imputation and duplicate removal to be added in the future.

        return {"status": "success", "message": "Automated preparation complete.", "operations_log": operations_log}

    except Exception as e:
        raise RuntimeError(f"Failed during automated preparation: {e}")