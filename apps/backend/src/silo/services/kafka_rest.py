from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
import secrets

JSON_V2 = "application/vnd.kafka.v2+json"
JSON_RECORDS = "application/vnd.kafka.json.v2+json"


@dataclass(frozen=True, slots=True)
class RestConsumerInstance:
    group_id: str
    instance_id: str
    base_uri: str


@dataclass(frozen=True, slots=True)
class KafkaRestConfig:
    rest_proxy_url: str
    rest_proxy_auth: str
    use_mock_data: bool
    dataflow_topic_prefix: str
    group_id: str
    timeout_seconds: float = 10.0


@dataclass(frozen=True, slots=True)
class KafkaRestError(RuntimeError):
    method: str
    url: str
    status_code: int
    body: str

    def __init__(self, *, method: str, url: str, status_code: int, body: str) -> None:
        message = f"{method} {url} failed: {status_code} {body}"
        super().__init__(message)
        object.__setattr__(self, "method", method)
        object.__setattr__(self, "url", url)
        object.__setattr__(self, "status_code", status_code)
        object.__setattr__(self, "body", body)


class KafkaRestClient:
    def __init__(self, config: KafkaRestConfig | None = None) -> None:
        self.config = config or load_kafka_rest_config()
        self._timeout = httpx.Timeout(self.config.timeout_seconds)

    def should_use_mock_data(self) -> bool:
        return self.config.use_mock_data or not self.config.rest_proxy_url.strip()

    async def create_rest_consumer(
        self,
        group_id: str,
        instance_name: str | None = None,
        offset_reset: str = "latest",
    ) -> RestConsumerInstance:
        base_url = self._base_url_or_raise()
        name = instance_name or f"inst-{_random_hex_suffix()}"
        payload = {
            "name": name,
            "format": "json",
            "auto.offset.reset": offset_reset,
            "auto.commit.enable": "false",
        }

        response = await self._request(
            "POST",
            f"{base_url}/consumers/{group_id}",
            headers=_build_headers(self.config, JSON_V2, JSON_V2),
            json=payload,
        )
        data = _json_object(response)
        instance_id = str(data.get("instance_id") or data.get("instanceId") or name)
        base_uri = str(data.get("base_uri") or data.get("baseUri") or f"/consumers/{group_id}/instances/{instance_id}")
        absolute_base_uri = _absolute_url(base_url, base_uri)
        return RestConsumerInstance(group_id=group_id, instance_id=instance_id, base_uri=absolute_base_uri)

    async def subscribe_rest(self, instance: RestConsumerInstance, topics: list[str]) -> None:
        await self._request(
            "POST",
            f"{instance.base_uri}/subscription",
            headers=_build_headers(self.config, JSON_V2, JSON_V2),
            json={"topics": topics},
        )

    async def fetch_records_rest(self, instance: RestConsumerInstance, timeout_ms: int = 10_000) -> list[dict[str, Any]]:
        response = await self._request(
            "GET",
            f"{instance.base_uri}/records?timeout={timeout_ms}",
            headers=_build_headers(self.config, None, JSON_RECORDS),
        )
        data = _json_value(response)
        if not isinstance(data, list):
            return []

        records: list[dict[str, Any]] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            records.append(
                {
                    "topic": item.get("topic"),
                    "partition": item.get("partition"),
                    "offset": item.get("offset"),
                    "key": item.get("key", None),
                    "value": item.get("value"),
                }
            )
        return records

    async def commit_offsets_rest(self, instance: RestConsumerInstance, offsets: list[dict[str, Any]]) -> None:
        await self._request(
            "POST",
            f"{instance.base_uri}/offsets",
            headers=_build_headers(self.config, JSON_V2, JSON_V2),
            json={"offsets": offsets},
        )

    async def delete_rest_consumer(self, instance: RestConsumerInstance) -> None:
        await self._request(
            "DELETE",
            instance.base_uri,
            headers=_build_headers(self.config, None, JSON_V2),
        )

    async def produce_record_rest(
        self,
        topic: str,
        value: str | dict[str, Any],
        key: str | None = None,
    ) -> None:
        base_url = self._base_url_or_raise()
        await self._request(
            "POST",
            f"{base_url}/topics/{topic}",
            headers=_build_headers(self.config, "application/vnd.kafka.json.v2+json", JSON_V2),
            json={"records": [{"key": key, "value": value}]},
        )

    async def _request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: object | None = None,
    ) -> httpx.Response:
        async with httpx.AsyncClient(timeout=self._timeout, trust_env=False) as client:
            response = await client.request(method, url, headers=headers, json=json)

        if response.is_success:
            return response

        raise KafkaRestError(
            method=method,
            url=url,
            status_code=response.status_code,
            body=_redact_body(response.text),
        )

    def _base_url_or_raise(self) -> str:
        base_url = self.config.rest_proxy_url.strip()
        if not base_url:
            raise RuntimeError("KAFKA_REST_PROXY_URL not configured")
        return base_url.rstrip("/")


def load_kafka_rest_config() -> KafkaRestConfig:
    from silo.config import load_settings

    settings = load_settings()
    return KafkaRestConfig(
        rest_proxy_url=settings.kafka.rest_proxy_url,
        rest_proxy_auth=settings.kafka.rest_proxy_auth.get_secret_value(),
        use_mock_data=settings.kafka.rest_proxy_use_mock_data,
        dataflow_topic_prefix=settings.kafka.dataflow_topic_prefix,
        group_id=settings.kafka.group_id,
        timeout_seconds=10.0,
    )


def _build_headers(
    config: KafkaRestConfig,
    content_type: str | None = None,
    accept: str | None = None,
) -> dict[str, str]:
    headers: dict[str, str] = {}
    if content_type:
        headers["Content-Type"] = content_type
    if accept:
        headers["Accept"] = accept
    if config.rest_proxy_auth:
        headers["Authorization"] = config.rest_proxy_auth
    return headers


def _absolute_url(base_url: str, maybe_relative: str) -> str:
    parsed = urlparse(maybe_relative)
    if parsed.scheme and parsed.netloc:
        return maybe_relative
    return urljoin(base_url.rstrip("/") + "/", maybe_relative.lstrip("/"))


def _json_object(response: httpx.Response) -> dict[str, Any]:
    data = response.json()
    return data if isinstance(data, dict) else {}


def _json_value(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return None


def _redact_body(body: str, *, limit: int = 240) -> str:
    normalized = " ".join(body.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit].rstrip()}…"


def _random_hex_suffix() -> str:
    return secrets.token_hex(4)
