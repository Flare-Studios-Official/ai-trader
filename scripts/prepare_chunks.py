import os
import json

scratch_dir = r"C:\Users\ibbg\.gemini\antigravity\brain\42e71d93-a4cd-4a75-bd0a-378f68a53823\scratch\chunks"
os.makedirs(scratch_dir, exist_ok=True)

ignored_dirs = {".git", "node_modules", "__pycache__", ".pytest_cache", "dist", "build", "data", "scratch"}

all_files = []
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in ignored_dirs]
    for f in files:
        if f == "package-lock.json":
            continue
        full_p = os.path.join(root, f)
        rel = os.path.relpath(full_p, ".").replace(os.sep, "/")
        with open(rel, "r", encoding="utf-8", errors="ignore") as fp:
            content = fp.read()
        all_files.append({"path": rel, "content": content, "size": len(content)})

all_files.sort(key=lambda x: x["path"])

chunks = []
current_chunk = []
current_size = 0

for item in all_files:
    if current_size + item["size"] > 35000 and current_chunk:
        chunks.append(current_chunk)
        current_chunk = []
        current_size = 0
    current_chunk.append({"path": item["path"], "content": item["content"]})
    current_size += item["size"]

if current_chunk:
    chunks.append(current_chunk)

print(f"Total files: {len(all_files)}")
print(f"Total chunks: {len(chunks)}")
for i, c in enumerate(chunks):
    total_sz = sum(len(x["content"]) for x in c)
    paths = [x["path"] for x in c]
    print(f"Chunk {i+1}: {len(c)} files, {total_sz} bytes -> {paths}")
    with open(os.path.join(scratch_dir, f"chunk_{i+1}.json"), "w", encoding="utf-8") as fp:
        json.dump(c, fp)
