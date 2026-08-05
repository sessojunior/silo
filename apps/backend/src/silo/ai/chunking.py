from __future__ import annotations

import math
import re
from dataclasses import dataclass

CHUNK_SIZE_CHARS = 2_048
CHUNK_OVERLAP_CHARS = 256
MIN_CHUNK_SIZE_CHARS = 100


@dataclass(frozen=True, slots=True)
class TextChunk:
    content: str
    index: int
    token_count: int


def chunk_markdown(markdown: str) -> list[TextChunk]:
    if not markdown or len(markdown.strip()) == 0:
        return []

    sections = split_by_headings(markdown)
    chunks: list[TextChunk] = []
    chunk_index = 0

    for section in sections:
        section_chunks = chunk_section(section, chunk_index)
        chunks.extend(section_chunks)
        chunk_index += len(section_chunks)

    return merge_small_chunks(chunks)


def split_by_headings(text: str) -> list[str]:
    heading_regex = re.compile(r"^(#{1,6}\s+.+)$", re.MULTILINE)
    sections: list[str] = []
    last_index = 0

    for match in heading_regex.finditer(text):
        before_heading = text[last_index : match.start()].strip()
        if before_heading:
            sections.append(before_heading)
        last_index = match.start()

    remaining = text[last_index:].strip()
    if remaining:
        sections.append(remaining)

    if not sections and text.strip():
        sections.append(text.strip())

    return sections


def chunk_section(section: str, start_index: int) -> list[TextChunk]:
    cleaned = clean_markdown(section)
    if len(cleaned) <= CHUNK_SIZE_CHARS:
        return [TextChunk(content=cleaned, index=start_index, token_count=estimate_tokens(cleaned))]

    paragraphs = split_paragraphs(cleaned)
    chunks: list[TextChunk] = []
    current_chunk = ""
    chunk_idx = start_index

    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) + 1 <= CHUNK_SIZE_CHARS:
            current_chunk = f"{current_chunk}\n\n{paragraph}" if current_chunk else paragraph
            continue

        if len(current_chunk) >= MIN_CHUNK_SIZE_CHARS:
            chunks.append(
                TextChunk(
                    content=current_chunk,
                    index=chunk_idx,
                    token_count=estimate_tokens(current_chunk),
                )
            )
            chunk_idx += 1
            overlap_text = extract_overlap(current_chunk)
            current_chunk = f"{overlap_text}\n\n{paragraph}" if overlap_text else paragraph
        else:
            sentence_chunks = chunk_by_sentences(
                f"{current_chunk}\n\n{paragraph}",
                chunk_idx,
            )
            chunks.extend(sentence_chunks)
            chunk_idx += len(sentence_chunks)
            current_chunk = ""

    if len(current_chunk) >= MIN_CHUNK_SIZE_CHARS:
        chunks.append(
            TextChunk(
                content=current_chunk,
                index=chunk_idx,
                token_count=estimate_tokens(current_chunk),
            )
        )

    return chunks


def split_paragraphs(text: str) -> list[str]:
    return [paragraph.strip() for paragraph in re.split(r"\n\s*\n", text) if paragraph.strip()]


def chunk_by_sentences(text: str, start_index: int) -> list[TextChunk]:
    sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text) if sentence.strip()]
    chunks: list[TextChunk] = []
    current_chunk = ""
    chunk_idx = start_index

    for sentence in sentences:
        if len(current_chunk) + len(sentence) + 1 <= CHUNK_SIZE_CHARS:
            current_chunk = f"{current_chunk} {sentence}".strip()
            continue

        if len(current_chunk) >= MIN_CHUNK_SIZE_CHARS:
            chunks.append(
                TextChunk(
                    content=current_chunk,
                    index=chunk_idx,
                    token_count=estimate_tokens(current_chunk),
                )
            )
            chunk_idx += 1
            current_chunk = sentence
        else:
            truncated = sentence[:CHUNK_SIZE_CHARS]
            chunks.append(
                TextChunk(
                    content=truncated,
                    index=chunk_idx,
                    token_count=estimate_tokens(truncated),
                )
            )
            chunk_idx += 1
            current_chunk = ""

    if len(current_chunk) >= MIN_CHUNK_SIZE_CHARS:
        chunks.append(
            TextChunk(
                content=current_chunk,
                index=chunk_idx,
                token_count=estimate_tokens(current_chunk),
            )
        )

    return chunks


def extract_overlap(chunk: str) -> str:
    words = chunk.split()
    if len(words) <= 10:
        return ""

    overlap = ""
    for index in range(len(words) - 1, -1, -1):
        candidate = f"{words[index]} {overlap}".strip()
        if len(candidate) > CHUNK_OVERLAP_CHARS:
            break
        overlap = candidate

    return overlap


def merge_small_chunks(chunks: list[TextChunk]) -> list[TextChunk]:
    if len(chunks) <= 1:
        return chunks

    merged: list[TextChunk] = []
    current = chunks[0]

    for next_chunk in chunks[1:]:
        if (
            len(current.content) < MIN_CHUNK_SIZE_CHARS
            and len(current.content) + len(next_chunk.content) <= CHUNK_SIZE_CHARS
        ):
            combined = f"{current.content}\n\n{next_chunk.content}"
            current = TextChunk(
                content=combined,
                index=current.index,
                token_count=estimate_tokens(combined),
            )
        else:
            merged.append(current)
            current = next_chunk

    merged.append(current)
    return merged


def clean_markdown(markdown: str) -> str:
    cleaned = markdown
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"(\*{1,3}|_{1,3})(.*?)\1", r"\2", cleaned)
    cleaned = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", cleaned)
    cleaned = re.sub(r"!\[([^\]]*)\]\([^)]*\)", "", cleaned)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
    cleaned = re.sub(r"^[\s]*[-*+]\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^[\s]*\d+\.\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^>\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^[-*_]{3,}\s*$", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / 4)
