"""Testa backend batch-grade med riktiga demobilder."""
import json
import mimetypes
import os
import sys
import time
import uuid
import urllib.request
import urllib.error

URL = "http://127.0.0.1:8000/api/v1/batch/grade"

ANSWER_KEY = [
    {
        "question_number": "1",
        "final_answer": "v = 17 m/s",
        "derivation_steps": ["s(t) = 2t^2 + 5t", "v(t) = s'(t) = 4t + 5", "v(3) = 17"],
    }
]

FILES = [
    ("Anna_Andersson.png", "image/png"),
    ("Erik_Eriksson.png", "image/png"),
    ("Linnea_Svensson.png", "image/png"),
]


def build_multipart(fields, files):
    boundary = "----wisebound" + uuid.uuid4().hex
    lines = []
    for name, value in fields:
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        lines.append(b"")
        lines.append(value.encode() if isinstance(value, str) else value)
    for name, filename, data, ctype in files:
        lines.append(f"--{boundary}".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode()
        )
        lines.append(f"Content-Type: {ctype}".encode())
        lines.append(b"")
        lines.append(data)
    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    body = b"\r\n".join(lines)
    return body, f"multipart/form-data; boundary={boundary}"


def main():
    here = os.path.dirname(__file__)
    fields = [
        ("prov_id", "demo-prov-1"),
        ("class_grading_parameters", "Kräv enheter i slutsvar"),
        ("test_specific_parameters", ""),
        ("answer_key_json", json.dumps(ANSWER_KEY)),
    ]
    files = []
    for fn, ct in FILES:
        path = os.path.join(here, fn)
        with open(path, "rb") as f:
            files.append(("files", fn, f.read(), ct))

    body, ctype = build_multipart(fields, files)
    req = urllib.request.Request(URL, data=body, method="POST")
    req.add_header("Content-Type", ctype)
    req.add_header("Content-Length", str(len(body)))

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8")
            elapsed = time.time() - t0
            print(f"HTTP {r.status} in {elapsed:.1f}s, {len(raw)} bytes")
            data = json.loads(raw)
            print("integrations:", data.get("integrations"))
            print("activeRules:", data.get("activeRules"))
            print("totalStudents:", data.get("totalStudents"))
            for res in data["results"]:
                print(f"\n--- {res['studentName']} ---")
                for st in res["steps"]:
                    print(f"  {st['label']}: verdict={st['aiVerdict']} pts={st['pointsBase']}/{st['pointsMax']}")
                    print(f"    feedback: {st['baseAnnotation'][:160]}")
    except urllib.error.HTTPError as e:
        elapsed = time.time() - t0
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTPError {e.code} in {elapsed:.1f}s\n{body}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
