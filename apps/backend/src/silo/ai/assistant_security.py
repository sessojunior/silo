from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class AssistantCapability(StrEnum):
    CONVERSATION_READ = "CONVERSATION_READ"
    DATABASE_READ = "DATABASE_READ"
    CONVERSATION_PERSIST = "CONVERSATION_PERSIST"


class AssistantSecurityError(PermissionError):
    code = "ASSISTANT_CAPABILITY_DENIED"


@dataclass(frozen=True, slots=True)
class AssistantSecurityPolicy:
    capabilities: frozenset[AssistantCapability]
    allowed_model_hosts: frozenset[str]

    def __post_init__(self) -> None:
        if not isinstance(self.capabilities, frozenset) or any(
            type(capability) is not AssistantCapability for capability in self.capabilities
        ):
            raise AssistantSecurityError("Política contém capacidade desconhecida.")
        if not isinstance(self.allowed_model_hosts, frozenset) or any(
            not isinstance(host, str) for host in self.allowed_model_hosts
        ):
            raise AssistantSecurityError("Política contém host inválido.")


def require_capability(
    policy: AssistantSecurityPolicy | None, capability: AssistantCapability
) -> None:
    if (
        not isinstance(policy, AssistantSecurityPolicy)
        or type(capability) is not AssistantCapability
        or capability not in policy.capabilities
    ):
        raise AssistantSecurityError(f"Capacidade não permitida: {capability!s}.")
