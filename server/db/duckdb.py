# server/db/duckdb.py
import duckdb
import os
import re
import pandas as pd
import numpy as np
import json
import threading
from groq import Groq
from config.config import GROQ_API_KEY
from scipy.stats import iqr, pearsonr

# --- Thread-Safe DuckDB Connection Pool ---
# Define the path for the database file
db_file_path = os.path.join(os.path.dirname(__file__), 'insightduck.db')

# Use a thread-local storage pattern for connections
_thread_local = threading.local()

def get_connection():
    """
    Returns a thread-safe DuckDB connection.
    Each thread gets its own connection to avoid conflicts.
    """
    if not hasattr(_thread_local, 'connection'):
        # Initialize connection for the thread if it doesn't exist
        _thread_local.connection = duckdb.connect(database=db_file_path, read_only=False)
        print(f"✅ Created new DuckDB connection for thread {threading.current_thread().name}")
    return _thread_local.connection

# For backward compatibility, create a default connection
# NOTE: All functions below should use get_connection() instead of 'con'
con = get_connection()
print(f"✅ DuckDB persistent database initialized at: {db_file_path}")

# --- Health Check Function ---
def get_all_tables():
    """
    Returns a list of all tables currently in the DuckDB database.
    """
    conn = get_connection()
    try:
        tables_df = conn.execute("SHOW TABLES;").fetchdf()
        return tables_df['name'].tolist()
    except Exception as e:
        raise RuntimeError(f"Could not fetch tables: {e}")

# --- Data Profiling Function ---
def get_data_profile(table_name: str):
    """
    Runs a series of profiling queries on a DuckDB table.
    """
    conn = get_connection()
    try:
        # 1. Get schema and column names
        schema_df = conn.execute(f"DESCRIBE {table_name};").fetchdf()
        schema = schema_df.to_dict('records')
        column_names = schema_df['column_name'].tolist()

        # 2. Get total row and column count
        total_rows = conn.execute(f"SELECT COUNT(*) FROM {table_name};").fetchone()[0]
        total_columns = len(schema)

        # 3. Calculate null counts safely
        null_counts = {}
        if column_names:
            null_counts_clauses = [f"SUM(CASE WHEN \"{col}\" IS NULL THEN 1 ELSE 0 END) AS \"{col}\"" for col in column_names]
            null_counts_query = f"SELECT {', '.join(null_counts_clauses)} FROM {table_name};"
            null_counts_result = conn.execute(null_counts_query).fetchdf()

            if not null_counts_result.empty:
                for col in null_counts_result.columns:
                    value = null_counts_result[col][0]
                    if pd.notna(value) and value > 0:
                        null_counts[col] = int(value)

        # 4. Calculate exact duplicates count
        duplicates_count_query = f"""
        SELECT
            (SELECT COUNT(*) FROM {table_name}) -
            (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {table_name}))
        """
        duplicates_count = conn.execute(duplicates_count_query).fetchone()[0]

        # 5. Get a sample preview and clean it for JSON
        sample_preview_df = conn.execute(f"SELECT * FROM {table_name} LIMIT 5;").fetchdf()
        # Replace non-JSON compliant values (NaN, Infinity) with None
        sample_preview = sample_preview_df.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict('records')

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
    conn = get_connection()
    schema_df = conn.execute(f"DESCRIBE {table_name};").fetchdf()
    varchar_columns = schema_df[schema_df['column_type'] == 'VARCHAR']['column_name'].tolist()

    suggestions = []
    total_rows = conn.execute(f"SELECT COUNT(*) FROM {table_name};").fetchone()[0]

    for col in varchar_columns:
        # --- Attempt to cast to DOUBLE (for numeric) ---
        # We use TRY_CAST which returns NULL if the conversion fails.
        numeric_non_null_count_query = f"""
        SELECT COUNT(*)
        FROM {table_name}
        WHERE TRY_CAST(\"{col}\" AS DOUBLE) IS NOT NULL;
        """
        numeric_count = conn.execute(numeric_non_null_count_query).fetchone()[0]

        # Calculate the percentage of rows that could be converted
        # We also check for empty strings in the original column
        original_non_empty_count_query = f"""
        SELECT COUNT(*) FROM {table_name} WHERE \"{col}\" IS NOT NULL AND \"{col}\" != '';
        """
        original_non_empty_count = conn.execute(original_non_empty_count_query).fetchone()[0]

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
    conn = get_connection()
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
                initial_nulls = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {safe_col_name} IS NULL;").fetchone()[0]

                # Step 2: Create a new column with the attempted conversion
                conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {temp_col_name} {new_type};")
                conn.execute(f"UPDATE {table_name} SET {temp_col_name} = TRY_CAST({safe_col_name} AS {new_type});")

                # Step 3: Count nulls in the new column
                new_nulls = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {temp_col_name} IS NULL;").fetchone()[0]

                # Step 4: Calculate conversion failures
                conversion_failures = new_nulls - initial_nulls

                # Step 5: Replace the original column
                conn.execute(f"ALTER TABLE {table_name} DROP COLUMN {safe_col_name};")
                conn.execute(f'ALTER TABLE {table_name} RENAME COLUMN {temp_col_name} TO {safe_col_name};')

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
    conn = get_connection()
    try:
        operations_log = []

        # --- 1. Structural Cleaning: Column Names ---
        schema_df = conn.execute(f"DESCRIBE {table_name};").fetchdf()
        for _, row in schema_df.iterrows():
            original_name = row['column_name']

            # Convert to snake_case
            s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', original_name)
            new_name = re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

            # Remove special characters
            new_name = re.sub(r'[^a-zA-Z0-9_]', '', new_name)

            if original_name != new_name:
                conn.execute(f'ALTER TABLE {table_name} RENAME COLUMN "{original_name}" TO "{new_name}";')
                operations_log.append(f"Renamed column '{original_name}' to '{new_name}'.")

        # Re-fetch schema after renaming
        schema_df = conn.execute(f"DESCRIBE {table_name};").fetchdf()

        # --- 2. Value Cleaning (Whitespace, Unify Nulls, Casing) ---
        varchar_columns = schema_df[schema_df['column_type'] == 'VARCHAR']['column_name'].tolist()

        for col_name in varchar_columns:
            safe_col_name = f'"{col_name}"'

            # Trim leading/trailing whitespace from all values
            conn.execute(f"UPDATE {table_name} SET {safe_col_name} = TRIM({safe_col_name});")

            # Unify common null-like strings to actual NULL
            null_like_values = ['N/A', 'NA', 'null', 'Null', '?', '', ' ']
            conn.execute(f"UPDATE {table_name} SET {safe_col_name} = NULL WHERE {safe_col_name} IN {tuple(null_like_values)};")

            # Standardize casing for categorical data (convert to Title Case)
            # This is a good general approach for consistency ("male", "MALE" -> "Male")
            conn.execute(f"UPDATE {table_name} SET {safe_col_name} = ucase({safe_col_name});")

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
    conn = get_connection()
    try:
        # --- Part 1: Find and Sample Exact Duplicates ---
        exact_duplicates_query = f"""
        WITH RowCounts AS (
            SELECT COLUMNS(*), COUNT(*) OVER (PARTITION BY COLUMNS(*)) as row_count
            FROM {table_name}
        )
        SELECT * EXCLUDE(row_count) FROM RowCounts WHERE row_count > 1 LIMIT 10;
        """
        exact_duplicates_sample_df = conn.execute(exact_duplicates_query).fetchdf()

        count_query = f"""
        SELECT (SELECT COUNT(*) FROM {table_name}) - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {table_name}))
        """
        exact_duplicates_count = conn.execute(count_query).fetchone()[0]

        # --- Part 2: Find Potential Entity Duplicates ---
        schema_df = conn.execute(f"DESCRIBE {table_name};").fetchdf()
        entity_col_to_check = None

        if primary_key_column and primary_key_column in schema_df['column_name'].tolist():
            entity_col_to_check = primary_key_column
        else:
            common_id_names = ['id', 'name', 'customer_id', 'user_id', 'customerid', 'userid']
            for col in schema_df['column_name']:
                if any(id_name in col.lower() for id_name in common_id_names):
                    count_query = f'SELECT COUNT(*) - COUNT(DISTINCT "{col}") FROM {table_name};'
                    if conn.execute(count_query).fetchone()[0] > 0:
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
            entity_df = conn.execute(entity_query).fetchdf()
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
    conn = get_connection()
    try:
        # This condition now accepts the new, more specific strategy name.
        if strategy == "remove_exact_duplicates":
            # Create a new table with only distinct rows, then replace the old one
            temp_table_name = f"temp_{table_name}"
            conn.execute(f"CREATE TABLE {temp_table_name} AS SELECT DISTINCT * FROM {table_name};")
            conn.execute(f"DROP TABLE {table_name};")
            conn.execute(f"ALTER TABLE {temp_table_name} RENAME TO {table_name};")

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
    conn = get_connection()
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
                impute_value = conn.execute(f"SELECT AVG({safe_col_name}) FROM {table_name}").fetchone()[0]
            elif strategy == "median":
                impute_value = conn.execute(f"SELECT MEDIAN({safe_col_name}) FROM {table_name}").fetchone()[0]
            elif strategy == "mode":
                impute_value = conn.execute(f"SELECT MODE({safe_col_name}) FROM {table_name}").fetchone()[0]
            elif strategy == "custom" and custom_value is not None:
                impute_value = custom_value

            if impute_value is not None:
                conn.execute(f"UPDATE {table_name} SET {safe_col_name} = ? WHERE {safe_col_name} IS NULL;", [impute_value])
                operations_log.append(f"Imputed NULLs in '{col}' with {strategy}: {impute_value}.")

        return {"status": "success", "message": "Imputation complete.", "operations_log": operations_log}

    except Exception as e:
        raise RuntimeError(f"Failed during imputation: {e}")

# --- Drop columns function ---

def drop_columns(table_name: str, columns_to_drop: list[str]):
    """
    Drops one or more specified columns from a DuckDB table.
    """
    conn = get_connection()
    try:
        if not columns_to_drop:
            return {"status": "skipped", "message": "No columns specified to drop."}

        for col in columns_to_drop:
            # Sanitize column name to prevent SQL injection
            safe_col_name = f'"{col.replace("`", "").replace(";", "")}"'
            query = f"ALTER TABLE {table_name} DROP COLUMN {safe_col_name};"
            conn.execute(query)

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
    conn = get_connection()
    try:

        # Fetch the data as a pandas DataFrame and use its CSV export.
        df = conn.table(table_name).to_df()

        # Use pandas to_csv to write to an in-memory text buffer (StringIO)
        from io import StringIO
        buffer = StringIO()
        df.to_csv(buffer, index=False)

        # Get the string value from the buffer
        csv_string = buffer.getvalue()

        return csv_string

    except Exception as e:
        raise RuntimeError(f"Failed to export table to CSV: {e}")

#---- Cleanup function ----
def clear_all_project_tables():
    """
    Drops all tables that start with 'project_' to clean the database.
    """
    conn = get_connection()
    try:
        tables_to_drop = conn.execute("SHOW TABLES;").fetchdf()
        dropped_count = 0
        for table_name in tables_to_drop['name']:
            if table_name.startswith('project_'):
                conn.execute(f'DROP TABLE "{table_name}";')
                print(f"✅ Dropped table: {table_name}")
                dropped_count += 1
        return {"status": "success", "message": f"Successfully dropped {dropped_count} project tables."}
    except Exception as e:
        raise RuntimeError(f"Failed during database cleanup: {e}")

#--- EDA Functions ---

def generate_statistical_summary(table_name: str):
    """
    Generates a comprehensive statistical summary for the given table.
    """
    conn = get_connection()
    try:
        df = conn.table(table_name).to_df()

        numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()

        # 1. Numeric Summary
        numeric_summary = {}
        if numeric_cols:
            desc_df = df[numeric_cols].describe(percentiles=[.25, .5, .75]).transpose()
            # Replace non-JSON compliant values (NaN, Infinity) with None
            numeric_summary = desc_df.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict('index')

        # 2. Categorical Summary
        categorical_summary = {}
        for col in categorical_cols:
            counts = df[col].value_counts(dropna=True)
            total_count = counts.sum()

            # Convert keys to string for JSON serialization
            top_5_frequencies = {str(k): v for k, v in counts.head(5).to_dict().items()}

            categorical_summary[col] = {
                "unique_count": df[col].nunique(),
                "mode": str(counts.index[0]) if not counts.empty else None,
                "top_5_frequencies": top_5_frequencies
            }

        # 3. Correlation Matrix
        correlation_matrix = []
        if len(numeric_cols) >= 2:
            # Drop non-numeric for correlation calculation just in case
            numeric_df = df[numeric_cols].apply(pd.to_numeric, errors='coerce')
            corr_df = numeric_df.corr()

            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols):
                    if i < j: # Upper triangle, excluding diagonal
                        # Check if correlation value exists and is a number
                        corr_val = corr_df.loc[col1, col2]
                        if pd.notna(corr_val):
                            correlation_matrix.append({
                                "col1": col1,
                                "col2": col2,
                                "correlation": round(corr_val, 4)
                            })

        return {
            "numeric_summary": numeric_summary,
            "categorical_summary": categorical_summary,
            "correlation_matrix": correlation_matrix,
            "total_rows": len(df),
            "total_columns": len(df.columns)
        }
    except Exception as e:
        raise RuntimeError(f"Failed to generate statistical summary: {e}")

def detect_data_insights(table_name: str):
    """
    Detects simple data insights like high correlation or distribution issues.
    """
    conn = get_connection()
    try:
        summary = generate_statistical_summary(table_name)
        df = conn.table(table_name).to_df()
        insights = []

        # Insight 1: High Correlation (Warning)
        for corr in summary["correlation_matrix"]:
            if abs(corr["correlation"]) >= 0.8:
                 insights.append({
                    "type": "correlation",
                    "severity": "warning",
                    "title": "High Feature Correlation",
                    "description": f"Columns '{corr['col1']}' and '{corr['col2']}' are highly correlated ({corr['correlation']}). Consider removing one for modeling.",
                    "affected_columns": [corr["col1"], corr["col2"]]
                })

        # Insight 2: Potential Outliers (Warning)
        numeric_cols = list(summary["numeric_summary"].keys())
        for col in numeric_cols:
            q1 = summary["numeric_summary"][col].get('25%')
            q3 = summary["numeric_summary"][col].get('75%')
            count = summary["numeric_summary"][col].get('count')

            if q1 is not None and q3 is not None and count:
                q1 = float(q1)
                q3 = float(q3)
                iqr_val = q3 - q1
                lower_bound = q1 - 1.5 * iqr_val
                upper_bound = q3 + 1.5 * iqr_val

                # DuckDB query for outlier count
                # Need to use a safe column name and handle nulls in query
                safe_col_name = f'"{col}"'
                outlier_query = f"""
                SELECT COUNT(*) FROM {table_name}
                WHERE {safe_col_name} IS NOT NULL AND ({safe_col_name} < {lower_bound} OR {safe_col_name} > {upper_bound});
                """
                outlier_count = conn.execute(outlier_query).fetchone()[0]

                if outlier_count > 0.01 * summary["total_rows"] and outlier_count > 5:
                    insights.append({
                        "type": "outlier",
                        "severity": "warning",
                        "title": "Potential Outliers Detected",
                        "description": f"Column '{col}' has {outlier_count} values outside the typical 1.5*IQR range. Review with a Box Plot.",
                        "affected_columns": [col]
                    })

        # Insight 3: Imbalanced Categorical Data (Info)
        for col, cat_sum in summary["categorical_summary"].items():
            if cat_sum["mode"] is not None and cat_sum["top_5_frequencies"]:
                # The first item in top_5_frequencies is the mode
                mode_key = list(cat_sum["top_5_frequencies"].keys())[0]
                mode_count = cat_sum["top_5_frequencies"][mode_key]
                total = summary["total_rows"]
                mode_percentage = mode_count / total
                if mode_percentage > 0.9:
                    insights.append({
                        "type": "distribution",
                        "severity": "info",
                        "title": "Highly Imbalanced Feature",
                        "description": f"Categorical column '{col}' is highly skewed, with the mode value ('{cat_sum['mode']}') making up {round(mode_percentage * 100)}% of the data. This might impact model performance.",
                        "affected_columns": [col]
                    })

        return {"insights": insights}

    except Exception as e:
        print(f"Error during insight detection: {e}")
        return {"insights": []}

def get_llm_suggestions(table_name: str):
    """
    Generates EDA chart suggestions by calling the Groq LLM.
    """
    conn = get_connection()
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")

    try:
        client = Groq(api_key=GROQ_API_KEY)

        schema_df = conn.execute(f"DESCRIBE {table_name};").fetchdf()
        schema = schema_df.to_dict('records')

        sample_data_df = conn.execute(f"SELECT * FROM {table_name} LIMIT 5;").fetchdf()
        sample_data = sample_data_df.to_dict('records')

        prompt = f"""
        You are an expert data analyst. Based on the following table schema and data sample,
        provide 4-5 diverse chart suggestions in a valid JSON format.

        **Table Schema:**
        {json.dumps(schema, indent=2)}

        **Data Sample (first 5 rows):**
        {json.dumps(sample_data, indent=2)}

        **Instructions:**
        1.  Analyze the data types and column names to understand the data.
        2.  Suggest varied chart types: bar_chart, histogram, scatter_plot.
        3.  Provide a concise `title` and a brief `description` for each chart.
        4.  Specify `chart_type` and `parameters` (`x_axis`, `y_axis`).
        5.  The entire output MUST be a single JSON object with a key "suggestions"
            containing an array of chart objects. Do not include any text before or after the JSON.
        """

        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.4,
            response_format={"type": "json_object"},
        )

        response_content = chat_completion.choices[0].message.content
        suggestions = json.loads(response_content)

        return suggestions.get("suggestions", [])

    except Exception as e:
        raise RuntimeError(f"Failed to get LLM suggestions: {e}")

def get_chart_data(table_name: str, chart_type: str, x_axis: str, y_axis: str | None = None):
    """
    Fetches data from DuckDB formatted for a specific chart type.
    Thread-safe version with better error handling.
    """
    conn = get_connection()  # Get thread-safe connection

    try:
        # First, verify the table exists and has data
        try:
            total_rows = conn.execute(f"SELECT COUNT(*) FROM {table_name};").fetchone()[0]
            if total_rows == 0:
                print(f"⚠️ Table {table_name} is empty")
                return []
        except Exception as e:
            print(f"❌ Table {table_name} not found or inaccessible: {e}")
            return []

        # Verify columns exist
        schema_df = conn.execute(f"DESCRIBE {table_name};").fetchdf()
        available_columns = schema_df['column_name'].tolist()

        if x_axis not in available_columns:
            print(f"⚠️ Column '{x_axis}' not found in table. Available: {available_columns}")
            return []

        if y_axis and y_axis not in available_columns:
            print(f"⚠️ Column '{y_axis}' not found in table. Available: {available_columns}")
            return []

        # Sanitize column names
        safe_x_axis = f'"{x_axis}"'
        safe_y_axis = f'"{y_axis}"' if y_axis else None

        if chart_type in ['histogram', 'bar_chart']:
            # Check if column has any non-null values
            non_null_count = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {safe_x_axis} IS NOT NULL;").fetchone()[0]

            if non_null_count == 0:
                print(f"⚠️ Column '{x_axis}' has no non-null values")
                return []

            query = f"""
            SELECT {safe_x_axis} as x, COUNT(*) AS y
            FROM {table_name}
            WHERE {safe_x_axis} IS NOT NULL
            GROUP BY {safe_x_axis}
            ORDER BY y DESC
            LIMIT 50;
            """

            chart_data_df = conn.execute(query).fetchdf()

            if chart_data_df is None or chart_data_df.empty:
                print(f"⚠️ Query returned no data for {chart_type} on column '{x_axis}'")
                return []

            # Clean and return data
            result = chart_data_df.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict('records')
            print(f"✅ Returned {len(result)} rows for {chart_type} on '{x_axis}'")
            return result

        elif chart_type == 'scatter_plot' and safe_y_axis:
            # Check both columns have non-null values
            non_null_query = f"""
            SELECT COUNT(*) FROM {table_name}
            WHERE {safe_x_axis} IS NOT NULL AND {safe_y_axis} IS NOT NULL;
            """
            non_null_count = conn.execute(non_null_query).fetchone()[0]

            if non_null_count == 0:
                print(f"⚠️ No rows with both '{x_axis}' and '{y_axis}' non-null")
                return []

            # Sample if dataset is large
            limit_clause = "USING SAMPLE 1000 ROWS" if total_rows > 1000 else ""

            query = f"""
            SELECT {safe_x_axis} as x, {safe_y_axis} as y
            FROM {table_name}
            WHERE {safe_x_axis} IS NOT NULL AND {safe_y_axis} IS NOT NULL
            {limit_clause};
            """

            chart_data_df = conn.execute(query).fetchdf()

            if chart_data_df is None or chart_data_df.empty:
                print(f"⚠️ Query returned no data for scatter_plot")
                return []

            # Clean and return data
            result = chart_data_df.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict('records')
            print(f"✅ Returned {len(result)} rows for scatter_plot")
            return result
        else:
            print(f"⚠️ Unsupported chart type: {chart_type}")
            return []

    except Exception as e:
        print(f"❌ Error in get_chart_data: {str(e)}")
        import traceback
        traceback.print_exc()
        return []  # Return empty array instead of raising error