"""
Run this once to generate your FERNET_KEY for .env

Usage:
    python generate_fernet_key.py
"""
from cryptography.fernet import Fernet

key = Fernet.generate_key().decode()
print("Your FERNET_KEY (add this to your .env):")
print()
print(f"FERNET_KEY={key}")
print()
print("⚠️  Keep this secret and NEVER change it after credentials are stored.")
print("    Changing it will make existing encrypted credentials unreadable.")
