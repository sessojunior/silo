from __future__ import annotations

from collections.abc import Awaitable, Callable

from silo.worker.handlers.model import model_handler
from silo.worker.handlers.monitoring import monitoring_handler

KafkaHandler = Callable[..., Awaitable[None]]


def get_handler_for_topic(topic: str) -> KafkaHandler:
    if topic.startswith("model."):
        return model_handler
    if topic.startswith("monitoring."):
        return monitoring_handler

    async def _topic_noop_handler(**kwargs: object) -> None:
        del kwargs
        return None

    _topic_noop_handler.__dict__["__worker_handler_name__"] = topic
    return _topic_noop_handler
