import os

def generate_frozen_assets():
    assets = {}
    
    # Get the project root directory (one level up from this script)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    web_static_dir = os.path.join(project_root, "web", "static")
    web_templates_dir = os.path.join(project_root, "web", "templates")
    out_path = os.path.join(project_root, "src", "frozen_assets.py")

    # Process static files
    if os.path.exists(web_static_dir):
        for filename in os.listdir(web_static_dir):
            filepath = os.path.join(web_static_dir, filename)
            if os.path.isfile(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    assets[f"static/{filename}"] = f.read()

    # Process template files
    if os.path.exists(web_templates_dir):
        for filename in os.listdir(web_templates_dir):
            filepath = os.path.join(web_templates_dir, filename)
            if os.path.isfile(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    assets[f"templates/{filename}"] = f.read()

    # Generate the python file
    with open(out_path, "w", encoding="utf-8") as out:
        out.write("# AUTO-GENERATED FILE. DO NOT EDIT.\n")
        out.write("# This file contains the contents of web/static and web/templates\n")
        out.write("# so they can be frozen into the MicroPython firmware.\n\n")
        
        out.write("FILES = {\n")
        for name, content in assets.items():
            # repr safely escapes quotes, newlines, etc.
            out.write(f"    {repr(name)}: {repr(content)},\n")
        out.write("}\n")
        
    print(f"Generated {out_path} with {len(assets)} assets.")

if __name__ == "__main__":
    generate_frozen_assets()
