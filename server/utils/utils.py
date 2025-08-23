from config.supabaseClient import supabase 

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