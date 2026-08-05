from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from fastapi.responses import JSONResponse

from silo.testing import fixture_api as e2e_api


class _DummyRequest:
    def __init__(self, cookies: dict[str, str] | None = None) -> None:
        self.cookies = cookies or {}
        self.state = SimpleNamespace(request_id="request-1")


def _payload(response: JSONResponse) -> dict[str, object]:
    return json.loads(response.body)


def test_fixture_api_helpers_cover_validation_and_formatting_branches(monkeypatch) -> None:
    fixture_state = e2e_api.FixtureState()
    monkeypatch.setattr(e2e_api, "state", fixture_state)

    error = _payload(
        e2e_api._error("Falha", status=418, field="field", data={"count": 1})  # noqa: SLF001
    )
    assert error["error"] == "Falha"
    assert error["field"] == "field"
    assert error["data"] == {"count": 1}

    assert e2e_api._normalize_api_path("/api/users") == "/api/admin/users"  # noqa: SLF001
    assert e2e_api._normalize_api_path("/api/admin/users") == "/api/admin/users"  # noqa: SLF001
    assert e2e_api._normalize_api_path("/api/other") == "/api/other"  # noqa: SLF001

    assert e2e_api._is_safe_filename("report.pdf") is True  # noqa: SLF001
    assert e2e_api._is_safe_filename("") is False  # noqa: SLF001
    assert e2e_api._is_safe_filename("../report.pdf") is False  # noqa: SLF001
    assert e2e_api._is_safe_filename("folder/report.pdf") is False  # noqa: SLF001
    assert e2e_api._is_safe_filename("folder:report.pdf") is False  # noqa: SLF001
    assert e2e_api._is_safe_filename(" report.pdf") is False  # noqa: SLF001

    assert e2e_api._record_to_cookie_header("token-1").startswith("silo_session=token-1;")  # noqa: SLF001
    assert e2e_api._clear_cookie_header().endswith("Max-Age=0")  # noqa: SLF001

    assert e2e_api._as_list([1, 2]) == [1, 2]  # noqa: SLF001
    assert e2e_api._as_list("nope") == []  # noqa: SLF001

    assert e2e_api._content_type_for_filename("report.pdf") == "application/pdf"  # noqa: SLF001
    assert e2e_api._content_type_for_filename("figure.png") == "image/png"  # noqa: SLF001
    assert e2e_api._content_type_for_filename("photo.jpg") == "image/jpeg"  # noqa: SLF001
    assert e2e_api._content_type_for_filename("photo.jpeg") == "image/jpeg"  # noqa: SLF001
    assert e2e_api._content_type_for_filename("image.webp") == "image/webp"  # noqa: SLF001
    assert e2e_api._content_type_for_filename("image.gif") == "image/gif"  # noqa: SLF001
    assert e2e_api._content_type_for_filename("archive.bin") == "application/octet-stream"  # noqa: SLF001

    assert e2e_api._strip_lucide_icon_class(None) == "users"  # noqa: SLF001
    assert e2e_api._strip_lucide_icon_class("icon-[lucide--server]") == "server"  # noqa: SLF001
    assert e2e_api._strip_lucide_icon_class("shield") == "shield"  # noqa: SLF001

    admin = fixture_state.users_by_email["admin@inpe.br"]
    admin_public = admin.public_user()
    assert admin_public["email"] == "admin@inpe.br"
    assert admin_public["isActive"] is True
    assert admin.profile_payload()["isAdmin"] is True
    assert admin.preferences_payload()["userPreferences"]["chatEnabled"] is True

    group_count = e2e_api._group_user_count(  # noqa: SLF001
        [{"id": e2e_api.GROUP_OPERATIONS_ID}, {"id": e2e_api.GROUP_QUALITY_ID}],
        fixture_state.users_by_email,
    )
    assert group_count == 3

    now = datetime(2026, 8, 4, 12, 0, tzinfo=UTC)
    chat_message = e2e_api.ChatMessageRecord(  # noqa: SLF001
        id="chat-1",
        content="Mensagem",
        sender_user_id=e2e_api.ADMIN_USER_ID,
        sender_name="Admin",
        receiver_group_id=e2e_api.CHAT_THREAD_GROUP_ID,
        receiver_user_id=None,
        created_at=now,
        read_at=now,
        deleted_at=now,
    )
    chat_payload = chat_message.to_dto()
    assert chat_payload["readAt"] is not None
    assert chat_payload["deletedAt"] is not None

    thread = e2e_api.AssistantThreadRecord(  # noqa: SLF001
        id="thread-1",
        user_id=e2e_api.ADMIN_USER_ID,
        title="Resumo",
        last_message_preview="Preview",
        message_count=2,
        last_message_at=now,
        created_at=now - timedelta(minutes=10),
        updated_at=now,
    )
    assert thread.to_summary()["messageCount"] == 2

    assistant_message = e2e_api.AssistantMessageRecord(  # noqa: SLF001
        id="assistant-message-1",
        thread_id="thread-1",
        sender_type="assistant",
        sender_user_id=None,
        sender_name="Assistente",
        content="Resposta",
        created_at=now,
        thinking="Pensando",
        generation={"status": "success"},
        visualization={"kind": "chart"},
        artifacts=[{"kind": "pdf"}],
    )
    assistant_payload = assistant_message.to_dto()
    assert assistant_payload["thinking"] == "Pensando"
    assert assistant_payload["generation"]["status"] == "success"
    assert assistant_payload["visualization"]["kind"] == "chart"
    assert assistant_payload["artifacts"][0]["kind"] == "pdf"

    pdf_asset = fixture_state._build_pdf_asset("!!!", ["Alpha"])  # noqa: SLF001
    assert pdf_asset["filename"] == "report.pdf"
    assert pdf_asset["url"].endswith("/report.pdf")
    assert pdf_asset["byteSize"] > 0


def test_fixture_api_state_and_assistant_branches(monkeypatch) -> None:
    fixture_state = e2e_api.FixtureState()
    monkeypatch.setattr(e2e_api, "state", fixture_state)

    admin = fixture_state.users_by_email["admin@inpe.br"]
    viewer = fixture_state.users_by_email["viewer@inpe.br"]

    token = fixture_state.create_session(admin)
    assert fixture_state.get_user_from_token(None) is None
    assert fixture_state.get_user_from_token("missing") is None
    assert fixture_state.get_user_from_token(token) is admin
    fixture_state.clear_session(token)
    assert fixture_state.get_user_from_token(token) is None

    assert fixture_state._thread_title("") == "Nova conversa"  # noqa: SLF001
    assert fixture_state._thread_title("Resumo curto") == "Resumo curto"  # noqa: SLF001
    assert fixture_state._thread_title(" ".join(["palavra"] * 20)).endswith("...")  # noqa: SLF001

    thread_summary = fixture_state._thread_summary_from_question("thread-question", "Pergunta longa")  # noqa: SLF001
    assert thread_summary.id == "thread-question"
    assert thread_summary.message_count == 2

    now = datetime(2026, 8, 4, 12, 0, tzinfo=UTC)
    old_thread = e2e_api.AssistantThreadRecord(  # noqa: SLF001
        id="thread-old",
        user_id=admin.id,
        title="Antigo",
        last_message_preview="old",
        message_count=1,
        last_message_at=now - timedelta(minutes=20),
        created_at=now - timedelta(hours=2),
        updated_at=now - timedelta(minutes=30),
    )
    new_thread = e2e_api.AssistantThreadRecord(  # noqa: SLF001
        id="thread-new",
        user_id=admin.id,
        title="Novo",
        last_message_preview="new",
        message_count=2,
        last_message_at=now,
        created_at=now - timedelta(hours=1),
        updated_at=now,
    )
    other_thread = e2e_api.AssistantThreadRecord(  # noqa: SLF001
        id="thread-other",
        user_id=viewer.id,
        title="Outro",
        last_message_preview="other",
        message_count=1,
        last_message_at=now,
        created_at=now,
        updated_at=now,
    )
    fixture_state.assistant_threads = {
        old_thread.id: old_thread,
        new_thread.id: new_thread,
        other_thread.id: other_thread,
    }
    fixture_state.assistant_messages = {
        old_thread.id: [
            e2e_api.AssistantMessageRecord(  # noqa: SLF001
                id="message-1",
                thread_id=old_thread.id,
                sender_type="user",
                sender_user_id=admin.id,
                sender_name="Admin",
                content="Pergunta antiga",
                created_at=now - timedelta(minutes=21),
            )
        ]
    }

    threads = fixture_state.list_assistant_threads(admin.id)
    assert [item["id"] for item in threads] == ["thread-new", "thread-old"]

    found_thread, found_messages = fixture_state.get_assistant_thread(admin.id, old_thread.id)
    assert found_thread is old_thread
    assert found_messages[0]["id"] == "message-1"

    missing_thread, missing_messages = fixture_state.get_assistant_thread(admin.id, "missing")
    assert missing_thread is None
    assert missing_messages == []

    assert fixture_state.assistant_response_for_prompt("forçar falha de artefato", old_thread.id)[
        "generation"
    ]["status"] == "fallback"
    assert fixture_state.assistant_response_for_prompt("mostre um mermaid", old_thread.id)[
        "visualization"
    ]["kind"] == "mermaid"
    assert fixture_state.assistant_response_for_prompt("quero uma image-resumo", old_thread.id)[
        "visualization"
    ]["kind"] == "image"
    assert fixture_state.assistant_response_for_prompt("quero chart e pdf", old_thread.id)[
        "artifacts"
    ][0]["kind"] == "pdf"
    assert fixture_state.assistant_response_for_prompt("gere um pdf node legado", old_thread.id)[
        "visualization"
    ]["src"].endswith("ai-node-legacy.pdf")
    assert fixture_state.assistant_response_for_prompt("gere um pdf python", old_thread.id)[
        "artifacts"
    ][0]["filename"].endswith(".pdf")
    assert fixture_state.assistant_response_for_prompt("faça um chart", old_thread.id)[
        "visualization"
    ]["kind"] == "chart"
    assert fixture_state.assistant_response_for_prompt("resumo textual", old_thread.id)[
        "scope"
    ] == "general"

    appended_response = fixture_state.append_assistant_exchange(  # noqa: SLF001
        "resumo textual",
        old_thread.id,
        fixture_state.assistant_response_for_prompt("resumo textual", old_thread.id),
    )
    assert appended_response["thread"]["id"] == old_thread.id
    message_count = len(fixture_state.assistant_messages[old_thread.id])
    fixture_state.assistant_idempotency[old_thread.id] = {"cached": True}
    fixture_state.append_assistant_exchange(  # noqa: SLF001
        "resumo textual",
        old_thread.id,
        fixture_state.assistant_response_for_prompt("resumo textual", old_thread.id),
    )
    assert len(fixture_state.assistant_messages[old_thread.id]) == message_count

    stream_thread = e2e_api.AssistantThreadRecord(  # noqa: SLF001
        id="thread-stream",
        user_id=admin.id,
        title="Stream",
        last_message_preview="stream",
        message_count=0,
        last_message_at=now,
        created_at=now,
        updated_at=now,
    )
    fixture_state.assistant_threads[stream_thread.id] = stream_thread
    fixture_state.assistant_messages[stream_thread.id] = []
    first_stream = fixture_state.build_assistant_stream_payload("quero chart", stream_thread.id, "cache-key")  # noqa: SLF001
    second_stream = fixture_state.build_assistant_stream_payload("quero chart", stream_thread.id, "cache-key")  # noqa: SLF001
    assert first_stream == second_stream
    assert len(fixture_state.assistant_messages[stream_thread.id]) == 2

    assert len(fixture_state.list_products()) == 2
    assert len(fixture_state.list_products(available_only=True)) == 2
    assert fixture_state.get_product_by_slug("produto-alfa") is not None
    assert fixture_state.get_product_by_slug("missing") is None
    assert fixture_state.get_product_by_id(e2e_api.PRODUCT_ID) is not None
    assert fixture_state.get_product_by_id("missing") is None
    assert fixture_state.get_projects_payload()[0]["id"] == e2e_api.PROJECT_ID
    assert fixture_state.get_projects_payload(project_id=e2e_api.PROJECT_ID)[0]["id"] == e2e_api.PROJECT_ID
    assert fixture_state.get_project_activities(e2e_api.PROJECT_ID)
    assert fixture_state.get_project_activities("missing") == []
    assert fixture_state.get_project_tasks(e2e_api.ACTIVITY_ID)["todo"]
    assert fixture_state.get_project_tasks("missing") == {
        "todo": [],
        "progress": [],
        "blocked": [],
        "review": [],
        "done": [],
    }

    chat_messages = fixture_state.get_chat_messages("group", e2e_api.CHAT_THREAD_GROUP_ID)
    assert chat_messages
    first_message = chat_messages[0]
    assert fixture_state.set_chat_message_read(first_message.id) is True
    assert fixture_state.set_chat_message_read("missing") is False
    assert fixture_state.delete_chat_message("missing") is False
    assert fixture_state.delete_chat_message(first_message.id) is True
    fixture_state.update_presence(admin.id, "hidden")
    assert next(user for user in fixture_state.chat_users if user["id"] == admin.id)["presenceStatus"] == "hidden"


def test_fixture_api_request_guards_chat_sidebar_and_uploads(monkeypatch) -> None:
    fixture_state = e2e_api.FixtureState()
    monkeypatch.setattr(e2e_api, "state", fixture_state)

    admin = fixture_state.users_by_email["admin@inpe.br"]
    viewer = fixture_state.users_by_email["viewer@inpe.br"]

    token = fixture_state.create_session(admin)
    current_user = e2e_api._current_user_from_request(_DummyRequest({"silo_session": token}))  # noqa: SLF001
    assert current_user is admin

    monkeypatch.setattr(e2e_api, "_current_user_from_request", lambda request: None)  # noqa: SLF001
    response = e2e_api._require_session(_DummyRequest())  # noqa: SLF001
    assert isinstance(response, JSONResponse)
    assert response.status_code == 401

    monkeypatch.setattr(e2e_api, "_current_user_from_request", lambda request: viewer)  # noqa: SLF001
    assert e2e_api._require_session(_DummyRequest()) is viewer  # noqa: SLF001

    monkeypatch.setattr(e2e_api, "_require_session", lambda request: e2e_api._error("Usuário não autenticado.", status=401))  # noqa: SLF001
    response = e2e_api._require_admin(_DummyRequest())  # noqa: SLF001
    assert isinstance(response, JSONResponse)
    assert response.status_code == 401

    monkeypatch.setattr(e2e_api, "_require_session", lambda request: viewer)  # noqa: SLF001
    response = e2e_api._require_admin(_DummyRequest())  # noqa: SLF001
    assert isinstance(response, JSONResponse)
    assert response.status_code == 403

    monkeypatch.setattr(e2e_api, "_require_session", lambda request: admin)  # noqa: SLF001
    assert e2e_api._require_admin(_DummyRequest()) is admin  # noqa: SLF001

    base = datetime(2026, 8, 4, 12, 0, tzinfo=UTC)
    chat_messages = [
        e2e_api.ChatMessageRecord(  # noqa: SLF001
            id="chat-a",
            content="Antiga",
            sender_user_id=admin.id,
            sender_name="Admin",
            receiver_group_id=e2e_api.CHAT_THREAD_GROUP_ID,
            receiver_user_id=None,
            created_at=base - timedelta(minutes=30),
        ),
        e2e_api.ChatMessageRecord(  # noqa: SLF001
            id="chat-b",
            content="Removida",
            sender_user_id=admin.id,
            sender_name="Admin",
            receiver_group_id=e2e_api.CHAT_THREAD_GROUP_ID,
            receiver_user_id=None,
            created_at=base - timedelta(minutes=20),
            deleted_at=base - timedelta(minutes=19),
        ),
        e2e_api.ChatMessageRecord(  # noqa: SLF001
            id="chat-c",
            content="Nova",
            sender_user_id=viewer.id,
            sender_name="Viewer",
            receiver_group_id=e2e_api.CHAT_THREAD_GROUP_ID,
            receiver_user_id=None,
            created_at=base - timedelta(minutes=10),
        ),
    ]
    filtered = e2e_api._filter_chat_messages(  # noqa: SLF001
        chat_messages,
        before=e2e_api._iso(base - timedelta(minutes=5)),
        after=e2e_api._iso(base - timedelta(minutes=40)),
        limit=1,
        order="asc",
    )
    assert len(filtered) == 1
    assert filtered[0]["id"] == "chat-a"

    sidebar = e2e_api._build_chat_sidebar_payload(admin)  # noqa: SLF001
    assert sidebar["totalUnread"] == 0
    assert sidebar["groups"]
    assert sidebar["users"]

    normal_pdf = e2e_api._build_upload_response("manual", "report.pdf")  # noqa: SLF001
    legacy_pdf = e2e_api._build_upload_response("manual", "ai-node-legacy.pdf")  # noqa: SLF001
    avatar_image = e2e_api._build_upload_response("avatars", "profile.png")  # noqa: SLF001
    assert normal_pdf.headers["content-type"] == "application/pdf"
    assert legacy_pdf.headers["content-type"] == "application/pdf"
    assert avatar_image.headers["content-type"].startswith("image/")
