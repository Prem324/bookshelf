import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
import os

from database import Base, get_db
from main import app

# Create engine globally for the module
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_register(client):
    response = client.post(
        "/users/register",
        json={"name": "Test User", "email": "test@example.com", "password": "password123"}
    )
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"

def test_login(client):
    client.post(
        "/users/register",
        json={"name": "Login User", "email": "login@example.com", "password": "password123"}
    )
    response = client.post(
        "/users/login",
        json={"email": "login@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    assert "token" in response.json()
    assert "refresh_token" in response.json()

def test_validate_token(client):
    client.post(
        "/users/register",
        json={"name": "Val User", "email": "val@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/users/login",
        json={"email": "val@example.com", "password": "password123"}
    )
    token = login_res.json()["token"]
    
    response = client.get(
        "/users/validate",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert "user_id" in response.json()
