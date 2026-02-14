import os

from celery import Celery


def _build_broker_url() -> str:
    broker_url = os.getenv("RABBITMQ_URL")
    if broker_url:
        return broker_url
    user = os.getenv("RABBITMQ_USER", "guest")
    password = os.getenv("RABBITMQ_PASSWORD", "guest")
    host = os.getenv("RABBITMQ_HOST", "rabbitmq")
    port = os.getenv("RABBITMQ_PORT", "5672")
    vhost = os.getenv("RABBITMQ_VHOST", "/")
    return f"amqp://{user}:{password}@{host}:{port}{vhost}"


celery_app = Celery(
    "books_api",
    broker=_build_broker_url(),
    backend=os.getenv("CELERY_RESULT_BACKEND", "rpc://"),
)

celery_app.autodiscover_tasks(["tasks"])
