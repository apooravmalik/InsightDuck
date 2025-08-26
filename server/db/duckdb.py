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
    
# --- Find duplicates function---

def find_duplicates(table_name: str, primary_key_column: str | None = None):
    """
    Finds both exact row-level duplicates (with a sample) and potential 
    entity-level duplicates.
    """
    try:
        # --- Part 1: Find and Sample Exact Duplicates ---
        exact_duplicates_query = f"""
        WITH RowCounts AS (
            SELECT COLUMNS(*), COUNT(*) OVER (PARTITION BY COLUMNS(*)) as row_count
            FROM {table_name}
        )
        SELECT * EXCLUDE(row_count) FROM RowCounts WHERE row_count > 1 LIMIT 10;
        """
        exact_duplicates_sample_df = con.execute(exact_duplicates_query).fetchdf()
        
        count_query = f"""
        SELECT (SELECT COUNT(*) FROM {table_name}) - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {table_name}))
        """
        exact_duplicates_count = con.execute(count_query).fetchone()[0]

        # --- Part 2: Find Potential Entity Duplicates ---
        schema_df = con.execute(f"DESCRIBE {table_name};").fetchdf()
        entity_col_to_check = None

        if primary_key_column and primary_key_column in schema_df['column_name'].tolist():
            entity_col_to_check = primary_key_column
        else:
            common_id_names = ['id', 'name', 'customer_id', 'user_id', 'customerid', 'userid']
            for col in schema_df['column_name']:
                if any(id_name in col.lower() for id_name in common_id_names):
                    count_query = f'SELECT COUNT(*) - COUNT(DISTINCT "{col}") FROM {table_name};'
                    if con.execute(count_query).fetchone()[0] > 0:
                        entity_col_to_check = col
                        break

        entity_duplicates_sample = []
        if entity_col_to_check:
            entity_query = f"""
            WITH PotentialEntityDupes AS (
                SELECT "{entity_col_to_check}" FROM {table_name} GROUP BY "{entity_col_to_check}" HAVING COUNT(*) > 1
            ),
            FinalEntityDupes AS (
                SELECT "{entity_col_to_check}" FROM (SELECT DISTINCT * FROM {table_name} WHERE "{entity_col_to_check}" IN (SELECT * FROM PotentialEntityDupes))
                GROUP BY "{entity_col_to_check}" HAVING COUNT(*) > 1
            )
            SELECT * FROM {table_name} WHERE "{entity_col_to_check}" IN (SELECT * FROM FinalEntityDupes)
            ORDER BY "{entity_col_to_check}" LIMIT 10;
            """
            entity_df = con.execute(entity_query).fetchdf()
            if not entity_df.empty:
                entity_duplicates_sample = entity_df.to_dict('records')

        return {
            "exact_duplicates": {
                "count": exact_duplicates_count,
                "message": "These are identical rows and are generally safe to remove.",
                "sample": exact_duplicates_sample_df.to_dict('records')
            },
            "entity_duplicates": {
                "checked_column": entity_col_to_check,
                "message": f"These rows may share a common ID in '{entity_col_to_check}' but have different data elsewhere. Review carefully.",
                "sample": entity_duplicates_sample
            }
        }
        
    except Exception as e:
        raise RuntimeError(f"Failed to find duplicates: {e}")
    
    
# --- Handle Duplicates Function ---

def handle_duplicates(table_name: str, strategy: str):
    """
    Handles duplicate rows in a table.
    """
    try:
        # This condition now accepts the new, more specific strategy name.
        if strategy == "remove_exact_duplicates":
            # Create a new table with only distinct rows, then replace the old one
            temp_table_name = f"temp_{table_name}"
            con.execute(f"CREATE TABLE {temp_table_name} AS SELECT DISTINCT * FROM {table_name};")
            con.execute(f"DROP TABLE {table_name};")
            con.execute(f"ALTER TABLE {temp_table_name} RENAME TO {table_name};")
            
            return {"status": "success", "message": "All exact duplicate rows have been removed."}
        else:
            return {"status": "skipped", "message": "Unknown or unsupported strategy."}
            
    except Exception as e:
        raise RuntimeError(f"Failed to handle duplicates: {e}")

# --- Impute Null Values Function ---
def impute_null_values(table_name: str, imputations: list[dict]):
    """
    Imputes NULL values in specified columns using a given strategy.
    'imputations' should be a list of dicts, e.g.,
    [{"column_name": "age", "strategy": "mean"}, ...]
    """
    try:
        operations_log = []
        for imp in imputations:
            col = imp.get("column_name")
            strategy = imp.get("strategy")
            custom_value = imp.get("value")
            
            if not col or not strategy:
                continue

            safe_col_name = f'"{col}"'
            impute_value = None

            if strategy == "mean":
                impute_value = con.execute(f"SELECT AVG({safe_col_name}) FROM {table_name}").fetchone()[0]
            elif strategy == "median":
                impute_value = con.execute(f"SELECT MEDIAN({safe_col_name}) FROM {table_name}").fetchone()[0]
            elif strategy == "mode":
                impute_value = con.execute(f"SELECT MODE({safe_col_name}) FROM {table_name}").fetchone()[0]
            elif strategy == "custom" and custom_value is not None:
                impute_value = custom_value
            
            if impute_value is not None:
                con.execute(f"UPDATE {table_name} SET {safe_col_name} = ? WHERE {safe_col_name} IS NULL;", [impute_value])
                operations_log.append(f"Imputed NULLs in '{col}' with {strategy}: {impute_value}.")

        return {"status": "success", "message": "Imputation complete.", "operations_log": operations_log}

    except Exception as e:
        raise RuntimeError(f"Failed during imputation: {e}")
    
# --- Drop columns function ---

def drop_columns(table_name: str, columns_to_drop: list[str]):
    """
    Drops one or more specified columns from a DuckDB table.
    """
    try:
        if not columns_to_drop:
            return {"status": "skipped", "message": "No columns specified to drop."}

        for col in columns_to_drop:
            # Sanitize column name to prevent SQL injection
            safe_col_name = f'"{col.replace("`", "").replace(";", "")}"'
            query = f"ALTER TABLE {table_name} DROP COLUMN {safe_col_name};"
            con.execute(query)
        
        operations_log = f"Successfully dropped columns: {', '.join(columns_to_drop)}."
        print(f"✅ {operations_log}")
        return {"status": "success", "message": operations_log}

    except Exception as e:
        raise RuntimeError(f"Failed to drop columns: {e}")

# --- Final state export ---
def export_table_to_csv_string(table_name: str):
    """
    Exports the entire content of a DuckDB table to a single CSV formatted string.
    """
    try:
        
        # Fetch the data as a pandas DataFrame and use its CSV export.
        df = con.table(table_name).to_df()
        
        # Use pandas to_csv to write to an in-memory text buffer (StringIO)
        from io import StringIO
        buffer = StringIO()
        df.to_csv(buffer, index=False)
        
        # Get the string value from the buffer
        csv_string = buffer.getvalue()
        
        return csv_string

    except Exception as e:
        raise RuntimeError(f"Failed to export table to CSV: {e}")