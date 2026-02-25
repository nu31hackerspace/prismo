import os

def generate_frozen_assets():
    assets = {}
    
    # Process static files
    if os.path.exists("web/static"):
        for filename in os.listdir("web/static"):
            filepath = os.path.join("web/static", filename)
            if os.path.isfile(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    assets[f"static/{filename}"] = f.read()

    # Process template files
    if os.path.exists("web/templates"):
        for filename in os.listdir("web/templates"):
            filepath = os.path.join("web/templates", filename)
            if os.path.isfile(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    assets[f"templates/{filename}"] = f.read()

    # Generate the python file
    out_path = "src/frozen_assets.py"
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
