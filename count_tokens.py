import os, pathlib, argparse, tiktoken, csv, sys

def get_encoder(name):
    try:
        return tiktoken.encoding_for_model(name)
    except (KeyError, ValueError):
        return tiktoken.get_encoding(name)

ap = argparse.ArgumentParser()
ap.add_argument("--name", default="gpt-4o")
ap.add_argument("--ext",  default=".py,.ts,.js,.html,.css")
ap.add_argument("--ignore-dir",
                default=".git,.venv,node_modules,with,own,its,folder,create,Python,#")
ap.add_argument("--csv", help="Write full report to this CSV file")
args = ap.parse_args()

enc         = get_encoder(args.name)
extensions  = tuple(args.ext.split(","))
ignore_dirs = set(args.ignore_dir.split(","))

rows, grand = [], 0
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for f in files:
        if f.endswith(extensions):
            p = pathlib.Path(root, f)
            tok = len(enc.encode(p.read_text("utf-8", errors="ignore"),
                                 disallowed_special=()))
            rows.append((tok, str(p)))
            grand += tok

rows.sort(reverse=True)

print(f"\nRepo total: {grand:,} tokens ({args.name})\n")
for tok, path in rows[:40]:
    print(f"{tok:>10,}  {path}")

if args.csv:
    with open(args.csv, "w", newline="") as fh:
        csv.writer(fh).writerows([("tokens", "path"), *rows])
    print(f"\nFull per‑file list written to {args.csv}")
