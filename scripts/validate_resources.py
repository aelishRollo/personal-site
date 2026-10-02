#!/usr/bin/env python3
"""Validate local resources referenced by the static site.

The validator intentionally scans every stylesheet under assets/css, not only
the files linked directly from HTML. This keeps nested skin stylesheets,
@imports, fonts, and images covered even when a theme is loaded at runtime.
"""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
CSS_ROOT = ROOT / "assets" / "css"
LOCAL_REFERENCE_ATTRIBUTES = {
    "action",
    "data",
    "href",
    "poster",
    "src",
    "words-src",
}
SKIPPED_SCHEMES = {
    "about",
    "blob",
    "data",
    "http",
    "https",
    "javascript",
    "mailto",
    "tel",
}
CSS_URL_PATTERN = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE)
CSS_IMPORT_PATTERN = re.compile(
    r"@import\s+(?!url\()(['\"])(.*?)\1", re.IGNORECASE
)
CSS_COMMENT_PATTERN = re.compile(r"/\*.*?\*/", re.DOTALL)


def is_local_reference(value: str) -> bool:
    value = value.strip()
    if not value or value.startswith(("#", "//")):
        return False

    parsed = urlparse(value)
    return not parsed.netloc and parsed.scheme.lower() not in SKIPPED_SCHEMES


def resolve_reference(value: str, source: Path) -> Path | None:
    parsed = urlparse(value.strip())
    path = unquote(parsed.path)
    if not path:
        return None

    target = ROOT / path.lstrip("/") if path.startswith("/") else source.parent / path
    target = target.resolve(strict=False)

    try:
        target.relative_to(ROOT)
    except ValueError as error:
        raise ValueError(f"reference escapes repository root: {value}") from error

    if target.is_dir():
        target /= "index.html"

    return target


def split_srcset(value: str) -> list[str]:
    references = []
    for candidate in value.split(","):
        candidate = candidate.strip()
        if candidate:
            references.append(candidate.split()[0])
    return references


class ResourceParser(HTMLParser):
    def __init__(self, source: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.references: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._collect(attrs)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self._collect(attrs)

    def _collect(self, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if not value:
                continue
            if name in LOCAL_REFERENCE_ATTRIBUTES:
                self.references.append((name, value))
            elif name == "srcset":
                self.references.extend((name, item) for item in split_srcset(value))
            elif name == "style":
                self.references.extend(
                    (name, match.group(2).strip())
                    for match in CSS_URL_PATTERN.finditer(value)
                )


def check_reference(
    failures: list[str], source: Path, attribute: str, raw_reference: str
) -> None:
    if not is_local_reference(raw_reference):
        return

    try:
        target = resolve_reference(raw_reference, source)
    except ValueError as error:
        failures.append(f"{source.relative_to(ROOT)}: {attribute} {error}")
        return

    if target is not None and not target.exists():
        failures.append(
            f"{source.relative_to(ROOT)}: missing {attribute}={raw_reference!r} "
            f"-> {target.relative_to(ROOT)}"
        )


def validate_html(html_files: list[Path], failures: list[str]) -> int:
    reference_count = 0
    for html_file in html_files:
        parser = ResourceParser(html_file)
        parser.feed(html_file.read_text(encoding="utf-8"))
        for attribute, reference in parser.references:
            reference_count += 1
            check_reference(failures, html_file, attribute, reference)
    return reference_count


def validate_css(css_files: list[Path], failures: list[str]) -> int:
    reference_count = 0
    for css_file in css_files:
        contents = CSS_COMMENT_PATTERN.sub(
            "", css_file.read_text(encoding="utf-8", errors="replace")
        )
        references = [
            ("url", match.group(2).strip())
            for match in CSS_URL_PATTERN.finditer(contents)
        ]
        references.extend(
            ("@import", match.group(2).strip())
            for match in CSS_IMPORT_PATTERN.finditer(contents)
        )

        for reference_type, reference in references:
            reference_count += 1
            check_reference(failures, css_file, reference_type, reference)
    return reference_count


def main() -> int:
    html_files = sorted(ROOT.glob("*.html"))
    css_files = sorted(CSS_ROOT.rglob("*.css"))
    failures: list[str] = []

    html_references = validate_html(html_files, failures)
    css_references = validate_css(css_files, failures)

    if failures:
        print("Resource validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(
        "Resource validation passed: "
        f"{len(html_files)} HTML files ({html_references} references), "
        f"{len(css_files)} CSS files ({css_references} references)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
