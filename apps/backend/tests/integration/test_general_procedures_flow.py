from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, select

from silo.ai import assistant_tools
from silo.db.models import legacy_tables
from silo.db.url import sqlalchemy_database_url
from silo.services import procedure_portal


def test_procedure_attachment_is_searchable_and_deleted_with_parent(tmp_path, monkeypatch) -> None:
    database_url = os.environ.get("SILO_PROCEDURES_INTEGRATION_DATABASE_URL")
    if not database_url:
        pytest.skip("Defina SILO_PROCEDURES_INTEGRATION_DATABASE_URL para o fluxo PostgreSQL.")

    engine = create_engine(sqlalchemy_database_url(database_url), pool_pre_ping=True)
    monkeypatch.setattr(procedure_portal, "get_uploads_root", lambda: tmp_path)
    monkeypatch.setattr(procedure_portal, "_schedule_embedding", lambda factory: None)
    monkeypatch.setattr(assistant_tools, "_generate_query_embedding_for_search", lambda query: ())
    monkeypatch.setattr(
        assistant_tools, "_search_pgvector_candidates", lambda *args, **kwargs: None
    )

    procedure_id = "integration-procedure-general"
    with engine.connect() as connection:
        user_id = connection.execute(select(legacy_tables["user"].c.id).limit(1)).scalar()
        if user_id is None:
            pytest.skip("O banco de integração não possui um usuário para a fixture.")

        connection.execute(
            legacy_tables["general_procedure"].delete().where(
                legacy_tables["general_procedure"].c.id == procedure_id
            )
        )
        connection.commit()
        created = procedure_portal.create_general_procedure(
            connection,
            user_id=str(user_id),
            title="Reinício de serviço",
            content="Use este procedimento quando o serviço não responder.",
            category="infraestrutura",
        )
        assert created["ok"] is True
        procedure_id = str(created["data"]["procedure"]["id"])

        attachment = procedure_portal.create_general_procedure_attachment(
            connection,
            procedure_id=procedure_id,
            original_name="passos.txt",
            mime_type="text/plain",
            content=b"Pare o servico, valide os logs e reinicie o servico.",
        )
        assert attachment["ok"] is True, attachment
        attachment_id = str(attachment["data"]["attachment"]["id"])
        stored_filename = str(
            connection.execute(
                select(legacy_tables["general_procedure_attachment"].c.stored_filename).where(
                    legacy_tables["general_procedure_attachment"].c.id == attachment_id
                )
            ).scalar_one()
        )
        assert (tmp_path / "procedures" / stored_filename).exists()

        result = assistant_tools.search_silo_knowledge(
            connection,
            query="como reiniciar o servico e validar os logs",
            limit=5,
        )
        assert any(item["source"] == "procedure_attachment" for item in result["items"])

        deleted = procedure_portal.delete_general_procedure(connection, id=procedure_id)
        assert deleted["ok"] is True
        assert not (tmp_path / "procedures" / stored_filename).exists()
        assert connection.execute(
            select(legacy_tables["general_procedure_attachment"].c.id).where(
                legacy_tables["general_procedure_attachment"].c.procedure_id == procedure_id
            )
        ).first() is None
    engine.dispose()
