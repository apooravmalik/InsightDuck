# server/db/duckdb.py
import duckdb
import os # Import the os module

# --- Persistent DuckDB Connection ---
# Define the path for the database file
db_file_path = os.path.join(os.path.dirname(__file__), 'insightduck.db')

# This will now create a file named 'insightduck.db' in your 'db' folder
# and use it for all storage. If the file exists, it reconnects to it.
con = duckdb.connect(database=db_file_path, read_only=False)
print(f"✅ DuckDB persistent database initialized at: {db_file_path}")

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
    Converts the data type of specified columns in a DuckDB table.
    'conversions' should be a list of dicts, e.g.,
    [{"column_name": "tenure", "new_type": "DOUBLE"}, ...]
    """
    try:
        for conv in conversions:
            col = conv.get("column_name")
            new_type = conv.get("new_type")
            
            if not col or not new_type:
                continue # Skip if the conversion info is incomplete

            # IMPORTANT: Sanitize column names to prevent SQL injection
            safe_col_name = f'"{col.replace("`", "").replace(";", "")}"'

            # Build and execute the ALTER TABLE query
            query = f"ALTER TABLE {table_name} ALTER COLUMN {safe_col_name} SET DATA TYPE {new_type};"
            con.execute(query)
        
        print(f"✅ Successfully applied {len(conversions)} type conversions to table {table_name}.")
        return {"status": "success", "message": f"{len(conversions)} columns converted."}
    except Exception as e:
        raise RuntimeError(f"Failed to convert column types: {e}")