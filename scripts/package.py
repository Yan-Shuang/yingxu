"""Create a clean source/deployment archive, without private runtime data."""

import hashlib
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
IGNORED = {
    ".git",
    ".cache",
    ".run",
    ".tools",
    "node_modules",
    ".next",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "dist",
    "backups",
}
PRIVATE = {
    Path("backend/code"),
    Path("backend/temp"),
    Path("backend/logs"),
    Path("backend/runtime"),
}


def main():
    output = ROOT / "dist" / "yingxu-product.zip"
    output.parent.mkdir(exist_ok=True)
    count = 0
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for directory, dirs, files in os.walk(ROOT):
            parent = Path(directory)
            dirs[:] = sorted(
                d
                for d in dirs
                if d not in IGNORED
                and not (parent / d).is_symlink()
                and (parent / d).relative_to(ROOT) not in PRIVATE
            )
            for filename in sorted(files):
                path = parent / filename
                relative = path.relative_to(ROOT)
                if not path.is_file() or path.is_symlink():
                    continue
                if filename.startswith(".env") and filename != ".env.example":
                    continue
                if (
                    filename in {"config.yaml", ".DS_Store"}
                    or path.suffix in {".zip", ".sqlite3", ".pyc", ".tsbuildinfo"}
                    or ".sqlite3-" in filename
                ):
                    continue
                if relative in {
                    Path("docs/preview.jpg"),
                    Path("docs/yingxu-preview.jpg"),
                }:
                    continue
                archive.write(path, Path("yingxu") / relative)
                count += 1
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    (output.parent / "yingxu-product.sha256").write_text(f"{digest}  {output.name}\n")
    print(f"{output}: {count} files, {output.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
