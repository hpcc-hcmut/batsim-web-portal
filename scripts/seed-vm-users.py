# Seed demo + lab user accounts on a fresh VM deployment via /api/auth/register.
# Usage: python seed-vm-users.py --base http://VM_IP:8000
# NOTE: email domain uses example.com — pydantic EmailStr rejects reserved TLDs
#       like .local, so demo accounts must use a normal-looking domain.
import argparse
import json
import urllib.request
import urllib.error

DEMO_USERS = [("demo1", "demo@123"), ("demo2", "demo@123"), ("demo3", "demo@123")]
LAB_USERS = [(f"user{i}", "lab@123") for i in range(1, 7)]


def register(base: str, username: str, password: str) -> str:
    payload = json.dumps({
        "username": username,
        "email": f"{username}@example.com",
        "password": password,
    }).encode()
    req = urllib.request.Request(
        f"{base}/api/auth/register",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return f"OK ({resp.status})"
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:120]
        return f"SKIP {e.code}: {detail}"  # 400 = already registered, fine on re-run


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000", help="Backend base URL")
    args = ap.parse_args()
    base = args.base.rstrip("/")
    for username, password in DEMO_USERS + LAB_USERS:
        print(f"{username}: {register(base, username, password)}")
    print("\nAccounts: demo1-3 / demo@123 (trinh dien), user1-6 / lab@123 (khao sat)")
    print("Next: chay setup-demo-data.py de nap workload/platform/strategy/scenario mau.")


if __name__ == "__main__":
    main()
