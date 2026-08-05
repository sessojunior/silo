from __future__ import annotations

from silo.ai.chunking import chunk_markdown


def test_chunk_markdown_returns_empty_list_for_blank_input() -> None:
    assert chunk_markdown("") == []
    assert chunk_markdown("   \n\t  ") == []


def test_chunk_markdown_preserves_unicode_and_strips_markdown_headings() -> None:
    chunks = chunk_markdown("# Título\n\nOlá, mundo!\n\n## Subtítulo\n\nCoração e ação.")

    assert len(chunks) == 1
    content = chunks[0].content
    assert "Título" in content
    assert "Olá, mundo!" in content
    assert "Coração e ação." in content
    assert "#" not in content


def test_chunk_markdown_splits_long_text_into_sequential_chunks() -> None:
    text = "# Manual\n\n" + ("Texto longo com overlap. " * 260)
    chunks = chunk_markdown(text)

    assert len(chunks) > 1
    assert [chunk.index for chunk in chunks] == list(range(len(chunks)))
    assert all(len(chunk.content) <= 2_048 for chunk in chunks)
    assert all(chunk.token_count > 0 for chunk in chunks)

