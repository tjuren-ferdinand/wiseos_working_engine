"""End-to-end-kontroll: batch-rättning utan facit + integrationsstatus."""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.request
import uuid

API = "http://127.0.0.1:8000"
HERE = pathlib.Path(__file__).parent


def _multipart(fields: dict[str, str], files: list[pathlib.Path]) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )
    for path in files:
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="files"; '
            f'filename="{path.name}"\r\nContent-Type: image/png\r\n\r\n'.encode()
            + path.read_bytes()
            + b"\r\n"
        )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def main() -> int:
    status = json.load(urllib.request.urlopen(f"{API}/"))["integrations"]
    print("Integrationer:", status)

    images = sorted(HERE.glob("*.png"))[:3]
    if not images:
        print("Inga demobilder hittades i", HERE)
        return 1
    print("Filer:", [p.name for p in images])

    body, content_type = _multipart(
        {
            "prov_id": f"e2e-{uuid.uuid4().hex[:8]}",
            "class_grading_parameters": "Kräv enheter i slutsvar. Kräv gällande siffror.",
            "test_specific_parameters": "Fysik 1: fritt fall och Newtons andra lag.",
            "answer_key_json": "[]",  # inget facit – ska genereras av backend
        },
        images,
    )
    req = urllib.request.Request(
        f"{API}/api/v1/batch/grade",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.load(resp)

    print("Elever:", data["totalStudents"], "Steg:", data["totalSteps"])
    print("Aktiva regler:", data["activeRules"])
    for r in data["results"]:
        first = r["steps"][0] if r["steps"] else {}
        print(f"- {r.get('studentName')}")
        print("  stegnycklar:", list(first.keys()))
        print("  steg:", json.dumps(first, ensure_ascii=False)[:400])
    return 0


if __name__ == "__main__":
    sys.exit(main())
