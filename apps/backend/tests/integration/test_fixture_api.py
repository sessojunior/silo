from __future__ import annotations

from fastapi.testclient import TestClient

from silo.testing.fixture_api import (
    ACTIVITY_ID,
    ADMIN_USER_ID,
    CHAT_THREAD_GROUP_ID,
    CHAT_THREAD_USER_ID,
    GROUP_OPERATIONS_ID,
    PRODUCT_ID,
    PRODUCT_SLUG,
    PROJECT_ID,
    app,
)


def _login_admin(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login/password",
        json={"email": "admin@inpe.br", "password": "#Admin123"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["signedIn"] is True


def _stream_assistant_message(client: TestClient, *, thread_id: str, content: str, key: str) -> str:
    with client.stream(
        "POST",
        "/api/admin/ai-assistant/messages/stream",
        json={"content": content, "threadId": thread_id},
        headers={"x-idempotency-key": key},
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    return body


def test_fixture_api_auth_sessions_and_profile_routes() -> None:
    with TestClient(app) as client:
        reset_response = client.post("/__test/reset")
        assert reset_response.status_code == 200

        assert client.get("/health").json()["service"] == "SILO Fixture API"
        assert client.get("/health/live").json() == {"ok": True}
        assert client.get("/health/ready").json() == {"ok": True}

        _login_admin(client)

        session_response = client.get("/api/auth/get-session")
        assert session_response.status_code == 200
        assert session_response.json()["data"]["user"]["id"] == ADMIN_USER_ID

        assert client.get("/api/check-admin").json()["data"]["isAdmin"] is True
        assert client.get("/api/users/profile").json()["data"]["user"]["email"] == "admin@inpe.br"
        assert (
            client.get("/api/users/preferences").json()["data"]["userPreferences"]["chatEnabled"]
            is True
        )

        login_google = client.get("/api/auth/login-google?from=login")
        assert login_google.status_code == 200
        assert login_google.json()["url"] == "/admin/dashboard"

        login_email = client.post(
            "/api/auth/login-email/send-otp",
            json={"email": "viewer@inpe.br"},
        )
        assert login_email.status_code == 200
        assert login_email.json()["data"]["step"] == 2

        verify_email = client.post(
            "/api/auth/login-email/verify-otp",
            json={"email": "viewer@inpe.br", "code": "123456"},
        )
        assert verify_email.status_code == 200
        assert verify_email.json()["data"]["signedIn"] is True

        sign_out = client.post("/api/auth/sign-out")
        assert sign_out.status_code == 200
        assert sign_out.json()["data"]["signedOut"] is True

        sign_up = client.post(
            "/api/auth/sign-up/email",
            json={"email": "new.user@example.test", "name": "New User", "password": "#NewUser123"},
        )
        assert sign_up.status_code == 201
        assert sign_up.json()["data"]["step"] == 2

        verify_signup = client.post(
            "/api/auth/sign-up/email/verify-otp",
            json={"email": "new.user@example.test", "code": "123456"},
        )
        assert verify_signup.status_code == 200
        assert verify_signup.json()["data"]["signedIn"] is True

        assert (
            client.get("/api/users/profile").json()["data"]["user"]["email"]
            == "new.user@example.test"
        )

        forget_password = client.post(
            "/api/auth/forget-password",
            json={"email": "viewer@inpe.br"},
        )
        assert forget_password.status_code == 200

        verify_forget_password = client.post(
            "/api/auth/forget-password/verify-otp",
            json={"email": "viewer@inpe.br", "code": "123456"},
        )
        assert verify_forget_password.status_code == 200
        assert verify_forget_password.json()["data"]["step"] == 3

        setup_password = client.post(
            "/api/auth/setup-password",
            json={"email": "viewer@inpe.br", "code": "123456", "password": "#Viewer456"},
        )
        assert setup_password.status_code == 200
        assert setup_password.json()["data"]["signedIn"] is True

        admin_login = client.get("/api/auth/login-google?from=settings")
        assert admin_login.status_code == 200

        profile_image = client.post(
            "/api/admin/users/profile-image",
            files={"fileToUpload": ("profile.png", b"fixture", "image/png")},
        )
        assert profile_image.status_code == 200
        assert profile_image.json()["data"]["imageUrl"].endswith("profile-upload.png")

        profile_image_update = client.put(
            "/api/users/profile-image/update",
            json={"imageUrl": "/uploads/avatars/profile-updated.png"},
        )
        assert profile_image_update.status_code == 200
        assert profile_image_update.json()["data"]["imageUrl"].endswith("profile-updated.png")

        profile_image_delete = client.delete("/api/admin/users/profile-image")
        assert profile_image_delete.status_code == 200
        assert profile_image_delete.json()["data"]["imageUrl"] == "/images/profile.png"


def test_fixture_api_catalog_reports_chat_assistant_and_websocket_routes() -> None:
    with TestClient(app) as client:
        client.post("/__test/reset")
        _login_admin(client)

        state_response = client.get("/__test/state")
        assert state_response.status_code == 200
        assert state_response.json()["sessions"] >= 1

        users_response = client.get(f"/api/admin/users?groupId={GROUP_OPERATIONS_ID}")
        assert users_response.status_code == 200
        assert users_response.json()["data"]["total"] >= 1

        groups_response = client.get("/api/admin/groups")
        assert groups_response.status_code == 200
        assert groups_response.json()["data"]["items"][0]["id"]

        permissions_response = client.get("/api/admin/groups/permissions?groupId=group-1")
        assert permissions_response.status_code == 200
        assert permissions_response.json()["data"]["total"] == 2

        group_users_response = client.post("/api/admin/groups/users", json={"groupId": "group-1"})
        assert group_users_response.status_code == 200

        contacts_response = client.get("/api/admin/contacts?status=active")
        assert contacts_response.status_code == 200
        assert contacts_response.json()["data"]["total"] >= 1

        products_response = client.get("/api/admin/products")
        assert products_response.status_code == 200
        assert products_response.json()["data"]["items"][0]["id"] == PRODUCT_ID

        product_by_slug = client.get(f"/api/admin/products?slug={PRODUCT_SLUG}")
        assert product_by_slug.status_code == 200
        assert product_by_slug.json()["data"]["products"][0]["slug"] == PRODUCT_SLUG

        product_by_id = client.get(f"/api/admin/products?id={PRODUCT_ID}")
        assert product_by_id.status_code == 200
        assert product_by_id.json()["data"]["items"][0]["id"] == PRODUCT_ID

        products_for_project = client.get(f"/api/admin/products?projectId={PROJECT_ID}&page=2")
        assert products_for_project.status_code == 200
        assert products_for_project.json()["data"]["page"] == "2"

        public_products = client.get("/api/products?available=true")
        assert public_products.status_code == 200
        assert public_products.json()["data"]["total"] >= 1

        assert client.get("/api/admin/products/dependencies").status_code == 200
        assert client.get("/api/admin/products/contacts").status_code == 200
        assert client.get("/api/admin/products/manual").status_code == 200
        assert client.get(f"/api/admin/products/problems?slug={PRODUCT_SLUG}").status_code == 200
        assert client.get("/api/admin/products/problems/categories").status_code == 200

        solutions_count = client.post(
            "/api/admin/products/solutions/count",
            json={"problemIds": ["problem-1", "problem-2"]},
        )
        assert solutions_count.status_code == 200
        assert solutions_count.json()["data"]["problem-1"] >= 1

        assert client.get("/api/admin/products/solutions?problemId=problem-1").status_code == 200
        assert (
            client.post("/api/admin/products/solutions", json={"description": "ok"}).status_code
            == 200
        )
        assert (
            client.put("/api/admin/products/solutions", json={"description": "ok"}).status_code
            == 200
        )
        assert client.get("/api/admin/products/solutions/summary").status_code == 200
        assert client.get("/api/admin/products/images?problemId=problem-1").status_code == 200
        assert (
            client.get("/api/admin/products/solutions/images?solutionId=solution-1").status_code
            == 200
        )
        assert client.post("/api/admin/products/problems", json={"title": "x"}).status_code == 200

        projects_response = client.get("/api/admin/projects")
        assert projects_response.status_code == 200
        projects_data = projects_response.json()["data"]
        if isinstance(projects_data, list):
            assert projects_data[0]["id"] == PROJECT_ID
        else:
            assert projects_data["items"][0]["id"] == PROJECT_ID

        assert client.get(f"/api/admin/projects?id={PROJECT_ID}").status_code == 200
        assert client.post("/api/admin/projects", json={"name": "Projeto"}).status_code == 200
        assert (
            client.put(
                "/api/admin/projects", json={"id": PROJECT_ID, "name": "Projeto"}
            ).status_code
            == 200
        )
        assert (
            client.request("DELETE", "/api/admin/projects", json={"id": PROJECT_ID}).status_code
            == 200
        )
        assert client.get(f"/api/admin/projects/{PROJECT_ID}/activities").status_code == 200
        assert (
            client.get(
                f"/api/admin/projects/{PROJECT_ID}/activities/{ACTIVITY_ID}/tasks"
            ).status_code
            == 200
        )

        assert client.get("/api/admin/dashboard").status_code == 200
        assert client.get("/api/admin/dashboard/summary").status_code == 200
        assert client.get("/api/admin/dashboard/projects").status_code == 200
        assert client.get("/api/admin/dashboard/problems-causes").status_code == 200
        assert client.get("/api/admin/dashboard/problems-solutions").status_code == 200

        assert client.get("/api/admin/monitoring/picture-pages").status_code == 200
        assert client.get("/api/admin/monitoring/radar-groups").status_code == 200
        assert client.get("/api/admin/monitoring/radars").status_code == 200
        monitoring_products = client.post("/api/admin/monitoring/products")
        assert monitoring_products.status_code == 200
        assert monitoring_products.json()["data"]["products"][0]["productId"]

        assert client.get("/api/admin/reports/availability").status_code == 200
        assert client.get("/api/admin/reports/problems").status_code == 200
        assert client.get("/api/admin/reports/projects").status_code == 200
        assert client.get("/api/admin/reports/executive").status_code == 200
        assert client.post("/api/admin/reports/availability/pdf", json={}).status_code == 200
        assert client.post("/api/admin/reports/problems/pdf", json={}).status_code == 200
        assert client.post("/api/admin/reports/projects/pdf", json={}).status_code == 200
        assert client.post("/api/admin/reports/executive/pdf", json={}).status_code == 200

        pdf_response = client.get("/api/upload/serve/reports/availability-report.pdf")
        assert pdf_response.status_code == 200
        assert pdf_response.headers["content-type"] == "application/pdf"
        assert len(pdf_response.content) > 0

        image_response = client.get("/api/upload/serve/avatars/profile.png")
        assert image_response.status_code == 200
        assert image_response.headers["content-type"].startswith("image/")

        assert client.get("/api/upload/serve/reports").status_code == 404
        assert (
            client.post(
                "/api/upload/general",
                files={"file": ("upload.png", b"data", "image/png")},
            ).status_code
            == 201
        )

        sidebar_response = client.get("/api/admin/chat/sidebar")
        assert sidebar_response.status_code == 200
        assert sidebar_response.json()["data"]["totalUnread"] == 0

        chat_message = client.post(
            "/api/admin/chat/messages",
            json={
                "content": "Olá grupo",
                "receiverGroupId": CHAT_THREAD_GROUP_ID,
            },
        )
        assert chat_message.status_code == 200
        message_id = chat_message.json()["data"]["id"]

        assert (
            client.get(f"/api/admin/chat/messages?groupId={CHAT_THREAD_GROUP_ID}").status_code
            == 200
        )
        assert (
            client.get(f"/api/admin/chat/messages/count?groupId={CHAT_THREAD_GROUP_ID}").status_code
            == 200
        )
        assert (
            client.get(
                f"/api/admin/chat/unread-messages?groupId={CHAT_THREAD_GROUP_ID}"
            ).status_code
            == 200
        )
        assert client.post(f"/api/admin/chat/messages/{message_id}/read").status_code == 200
        assert client.delete(f"/api/admin/chat/messages/{message_id}").status_code == 200
        assert client.post("/api/admin/chat/messages/read").status_code == 200
        assert (
            client.post("/api/admin/chat/presence", json={"status": "visible"}).status_code == 200
        )

        private_chat_message = client.post(
            "/api/admin/chat/messages",
            json={
                "content": "Olá usuário",
                "receiverUserId": CHAT_THREAD_USER_ID,
            },
        )
        assert private_chat_message.status_code == 200
        private_message_id = private_chat_message.json()["data"]["id"]
        assert (
            client.get(f"/api/admin/chat/messages?userId={CHAT_THREAD_USER_ID}").status_code == 200
        )
        assert (
            client.get(f"/api/admin/chat/messages/count?userId={CHAT_THREAD_USER_ID}").status_code
            == 200
        )
        assert (
            client.get(f"/api/admin/chat/unread-messages?userId={CHAT_THREAD_USER_ID}").status_code
            == 200
        )
        assert client.post(f"/api/admin/chat/messages/{private_message_id}/read").status_code == 200
        assert client.delete(f"/api/admin/chat/messages/{private_message_id}").status_code == 200

        assert client.get("/api/admin/ai-assistant/examples").status_code == 200
        assert client.get("/api/admin/ai-assistant/status").status_code == 200
        assert client.get("/api/ai-assistant/status").status_code == 200

        thread_response = client.post("/api/admin/ai-assistant/threads", json={"title": "Smoke"})
        assert thread_response.status_code == 200
        thread_id = thread_response.json()["data"]["thread"]["id"]
        assert client.get("/api/admin/ai-assistant/threads").status_code == 200
        assert client.get(f"/api/admin/ai-assistant/threads/{thread_id}").status_code == 200

        with client.stream(
            "POST",
            "/api/admin/ai-assistant/messages/stream",
            json={"content": "legacy node pdf", "threadId": thread_id},
            headers={"x-idempotency-key": "fixture-key-1"},
        ) as response:
            legacy_body = "".join(response.iter_text())
        assert response.status_code == 200
        assert "event: data" in legacy_body
        assert "event: complete" in legacy_body

        with client.stream(
            "POST",
            "/api/admin/ai-assistant/messages/stream",
            json={"content": "resuma o painel", "threadId": thread_id},
            headers={"x-idempotency-key": "fixture-key-2"},
        ) as response:
            live_body = "".join(response.iter_text())
        assert response.status_code == 200
        assert "event: thinking" in live_body
        assert "event: result" in live_body

        chart_body = _stream_assistant_message(
            client,
            thread_id=thread_id,
            content="Quero um chart dos produtos.",
            key="fixture-key-3",
        )
        assert "Segue um gráfico com a distribuição dos dados." in chart_body
        assert '"kind": "chart"' in chart_body

        mermaid_body = _stream_assistant_message(
            client,
            thread_id=thread_id,
            content="Mostre o fluxo em mermaid.",
            key="fixture-key-4",
        )
        assert "Segue o diagrama Mermaid do fluxo." in mermaid_body
        assert '"kind": "mermaid"' in mermaid_body

        chart_pdf_body = _stream_assistant_message(
            client,
            thread_id=thread_id,
            content="Quero chart e pdf do painel.",
            key="fixture-key-5",
        )
        assert "Gráfico e PDF prontos." in chart_pdf_body
        assert '"kind": "chart"' in chart_pdf_body
        assert '"kind": "pdf"' in chart_pdf_body

        legacy_pdf_body = _stream_assistant_message(
            client,
            thread_id=thread_id,
            content="Crie um pdf node legado.",
            key="fixture-key-6",
        )
        assert "PDF legado gerado como visualização de imagem." in legacy_pdf_body
        assert "/api/upload/serve/reports/ai-node-legacy.pdf" in legacy_pdf_body

        failure_body = _stream_assistant_message(
            client,
            thread_id=thread_id,
            content="Forçar falha de artefato.",
            key="fixture-key-7",
        )
        assert "Não foi possível gerar o arquivo desta vez" in failure_body
        assert '"status": "fallback"' in failure_body

        thread_after_stream = client.get(f"/api/admin/ai-assistant/threads/{thread_id}")
        assert thread_after_stream.status_code == 200
        assert thread_after_stream.json()["data"]["thread"]["messageCount"] >= 2

        assert (
            client.delete(
                f"/api/admin/ai-assistant/threads/{thread_id}/messages/message-1"
            ).status_code
            == 200
        )
        assert client.delete(f"/api/admin/ai-assistant/threads/{thread_id}").status_code == 200

        assert client.post("/api/does-not-exist").status_code == 404

        with client.websocket_connect("/api/chat/ws") as websocket:
            connected = websocket.receive_json()
            assert connected["type"] == "chat.connected"
            websocket.send_text("not-json")
            websocket.send_json({"type": "chat.pong"})
