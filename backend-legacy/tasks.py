import os

import requests

from celery_app import celery_app


@celery_app.task(name="tasks.send_welcome_email")
def send_welcome_email(to_email: str, name: str) -> None:
    resend_api_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM")
    if not resend_api_key or not resend_from:
        return

    subject = "Welcome to Bookshelf"
    body = f"Hi {name}, welcome to Bookshelf. Your account is ready."
    requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": resend_from,
            "to": [to_email],
            "subject": subject,
            "text": body,
        },
        timeout=20,
    )
