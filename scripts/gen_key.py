"""Generate a Fernet key for DB_ENCRYPTION_KEY (LI-3 at-rest encryption).

Run:  python scripts/gen_key.py

Copy the output into your .env as DB_ENCRYPTION_KEY=<key> (or the Azure
deploy script, which generates one on the VM). Never commit the key.
"""
from cryptography.fernet import Fernet

if __name__ == "__main__":
    print(Fernet.generate_key().decode("utf-8"))
