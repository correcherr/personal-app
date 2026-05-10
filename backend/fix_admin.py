from database import SessionLocal
from models import User
from auth import get_password_hash
import os
from dotenv import load_dotenv

load_dotenv()

db = SessionLocal()
admin_pass = os.getenv("APP_PASSWORD", "245242")
admin = db.query(User).filter(User.username == "admin").first()

if admin:
    print(f"Updating existing admin password to {admin_pass}")
    admin.hashed_password = get_password_hash(admin_pass)
else:
    print(f"Creating new admin user with password {admin_pass}")
    admin = User(
        username="admin",
        hashed_password=get_password_hash(admin_pass)
    )
    db.add(admin)

db.commit()
print("Admin user fixed.")
db.close()
