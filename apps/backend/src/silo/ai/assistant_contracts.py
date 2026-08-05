from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from silo.api.schemas import CamelModel

AI_ASSISTANT_SCOPES: tuple[str, ...] = (
    "models",
    "pending",
    "reports",
    "problems",
    "solutions",
    "projects",
    "general",
    "generate_pdf",
)

AiAssistantScope = Literal[
    "models",
    "pending",
    "reports",
    "problems",
    "solutions",
    "projects",
    "general",
    "generate_pdf",
]


class AiAssistantExampleDto(CamelModel):
    id: str
    title: str
    prompt: str
    description: str
    scope: AiAssistantScope


class AiAssistantExamplesResponseDto(CamelModel):
    guidance: str
    scope_policy: str
    examples: list[AiAssistantExampleDto]


class AiAssistantThreadSummaryDto(CamelModel):
    id: str
    title: str
    last_message_preview: str
    message_count: int
    last_message_at: str
    created_at: str
    updated_at: str


class AiAssistantCitationDto(CamelModel):
    label: str
    detail: str | None = None


class AiAssistantGenerationDto(CamelModel):
    provider: str
    model: str
    status: Literal["success", "fallback", "error"]
    latency_ms: int
    generated_tokens: int | None = None
    thinking_time_ms: int | None = None
    error_message: str | None = None


class AiAssistantRuntimeStatusDto(CamelModel):
    provider: Literal["ollama"]
    model: str
    mode: Literal["ollama", "fallback"]
    latency_ms: int
    checked_at: str
    fallback_reason: str | None = None


class AiAssistantVisualizationImageDto(CamelModel):
    kind: Literal["image"]
    src: str
    alt: str
    caption: str | None = None
    width: int | None = None
    height: int | None = None


class AiAssistantVisualizationChartSeriesDto(CamelModel):
    name: str
    values: list[float]
    color: str | None = None


class AiAssistantVisualizationChartDto(CamelModel):
    kind: Literal["chart"]
    chart_type: Literal["bar", "line", "donut"]
    title: str
    subtitle: str | None = None
    categories: list[str]
    series: list[AiAssistantVisualizationChartSeriesDto]
    height: int | None = None


class AiAssistantVisualizationMermaidDto(CamelModel):
    kind: Literal["mermaid"]
    diagram: str
    title: str
    caption: str | None = None


AiAssistantVisualizationDto = Annotated[
    AiAssistantVisualizationImageDto | AiAssistantVisualizationChartDto | AiAssistantVisualizationMermaidDto,
    Field(discriminator="kind"),
]


class AiAssistantArtifactDto(CamelModel):
    kind: Literal["pdf"]
    url: str
    filename: str
    title: str | None = None
    mime_type: Literal["application/pdf"] = "application/pdf"
    report_type: str | None = None
    checksum: str | None = None
    byte_size: int | None = None


class AiAssistantThreadMessageDto(CamelModel):
    id: str
    thread_id: str
    sender_type: Literal["user", "assistant"]
    sender_user_id: str | None = None
    sender_name: str
    content: str
    thinking: str | None = None
    generation: AiAssistantGenerationDto | None = None
    visualization: AiAssistantVisualizationDto | None = None
    artifacts: list[AiAssistantArtifactDto] | None = None
    created_at: str


class AiAssistantThreadsResponseDto(CamelModel):
    threads: list[AiAssistantThreadSummaryDto]


class AiAssistantThreadDetailResponseDto(CamelModel):
    thread: AiAssistantThreadSummaryDto
    messages: list[AiAssistantThreadMessageDto]


class AiAssistantCreateThreadResponseDto(CamelModel):
    thread: AiAssistantThreadSummaryDto


class AiAssistantMessageRequestDto(CamelModel):
    thread_id: str | None = None
    content: str


class AiAssistantMessageResponseDto(CamelModel):
    thread_id: str
    thread: AiAssistantThreadSummaryDto | None = None
    message_content: str | None = None
    scope: AiAssistantScope
    is_in_scope: bool
    refusal_reason: str | None = None
    answer: str
    thinking: str | None = None
    suggested_questions: list[str]
    citations: list[AiAssistantCitationDto]
    visualization: AiAssistantVisualizationDto | None = None
    artifacts: list[AiAssistantArtifactDto] | None = None
    generation: AiAssistantGenerationDto | None = None
    context_summary: str
