import sys
import os
import datetime
from datetime import timedelta
from jose import jwt
from fastapi.testclient import TestClient

# Adjust path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from utils.auth import JWT_SECRET_KEY, JWT_ALGORITHM, create_access_token



def run_jwt_tests():
    client = TestClient(app)
    
    # 1. Invalid signature
    bad_secret_token = jwt.encode({"sub": "jwt_boundary_tester"}, "wrong_secret_key", algorithm=JWT_ALGORITHM)
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {bad_secret_token}"})
    print(f"Invalid signature: status_code={response.status_code}, body={response.json()}")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired JWT token"
    
    # 2. Expired token
    expired_token = create_access_token({"sub": "jwt_boundary_tester"}, expires_delta=timedelta(minutes=-10))
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    print(f"Expired token: status_code={response.status_code}, body={response.json()}")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired JWT token"

    # 3. Missing 'sub' claim
    missing_sub_token = jwt.encode({"role": "admin", "exp": datetime.datetime.utcnow() + timedelta(minutes=10)}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {missing_sub_token}"})
    print(f"Missing sub claim: status_code={response.status_code}, body={response.json()}")
    assert response.status_code == 401
    assert response.json()["detail"] == "Token payload is missing subject claim"

    # 4. Malformed token format
    malformed_token = "invalid.token.format"
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {malformed_token}"})
    print(f"Malformed token: status_code={response.status_code}, body={response.json()}")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired JWT token"

    print("ALL JWT boundary tests PASSED successfully!")

if __name__ == "__main__":
    run_jwt_tests()
