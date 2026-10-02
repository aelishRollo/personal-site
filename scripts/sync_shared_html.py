#!/usr/bin/env python3
"""Synchronize shared static-site HTML regions without a deploy build step."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import argparse
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
SHARED_ROOT = ROOT / "shared"


@dataclass(frozen=True)
class PageConfig:
    current: str
    header: str = "header.html"
    footer: str | None = "footer.html"


PAGES = {
    "index.html": PageConfig("index.html", footer="footer-home.html"),
    "work.html": PageConfig("work.html"),
    "about.html": PageConfig("about.html"),
    "connect.html": PageConfig("connect.html"),
    "services.html": PageConfig("services.html"),
    "contact.html": PageConfig("contact.html"),
    "thanks.html": PageConfig("contact.html", header="header-compact.html", footer=None),
    "fridge-poetry.html": PageConfig("work.html"),
}

REGION_ORDER = ("head-assets", "header", "footer", "scripts")
CURRENT_TOKEN = re.compile(r"\{\{CURRENT:([^}]+)}}")

ADOPTION_PATTERNS = {
    "head-assets": re.compile(
        r"\t\t<link rel=\"stylesheet\" href=\"assets/css/main\.css(?:\?v=[^\"]+)?\" />\s*"
        r"\t\t<link rel=\"stylesheet\" href=\"assets/css/skin-system\.css(?:\?v=[^\"]+)?\" />\s*"
        r"\t\t<script src=\"assets/js/skin-bootstrap\.js(?:\?v=[^\"]+)?\"></script>"
    ),
    "header": re.compile(
        r"\t\t<header class=\"site-header\" role=\"banner\">.*?\t\t</header>",
        re.DOTALL,
    ),
    "footer": re.compile(
        r"\t\t\t<footer class=\"site-footer\">.*?\t\t\t</footer>|"
        r"\t\t\t<footer class=\"site-footer\">.*?</footer>",
        re.DOTALL,
    ),
    "scripts": re.compile(
        r"\t\t<script src=\"assets/js/jquery\.min\.js\"></script>\s*"
        r"<script src=\"assets/js/browser\.min\.js\"></script>\s*"
        r"<script src=\"assets/js/breakpoints\.min\.js\"></script>\s*"
        r"<script src=\"assets/js/util\.js\"></script>\s*"
        r"<script src=\"assets/js/main\.js(?:\?v=[^\"]+)?\"></script>"
    ),
}


def read_fragment(name: str) -> str:
    return (SHARED_ROOT / name).read_text(encoding="utf-8").rstrip("\n")


def render_current(fragment: str, current: str) -> str:
    return CURRENT_TOKEN.sub(
        lambda match: ' aria-current="page"' if match.group(1) == current else "",
        fragment,
    )


def rendered_regions(config: PageConfig) -> dict[str, str]:
    regions = {
        "head-assets": read_fragment("head-assets.html"),
        "header": render_current(read_fragment(config.header), config.current),
        "scripts": read_fragment("scripts.html"),
    }
    if config.footer:
        regions["footer"] = read_fragment(config.footer)
    return regions


def wrapped_region(name: str, contents: str) -> str:
    indentation = re.match(r"\s*", contents).group(0)
    indentation = indentation.rsplit("\n", 1)[-1]
    return (
        f"{indentation}<!-- shared:{name}:start -->\n"
        f"{contents}\n"
        f"{indentation}<!-- shared:{name}:end -->"
    )


def replace_region(document: str, name: str, contents: str) -> str:
    wrapped = wrapped_region(name, contents)
    marker_pattern = re.compile(
        rf"^[ \t]*<!-- shared:{re.escape(name)}:start -->$.*?"
        rf"^[ \t]*<!-- shared:{re.escape(name)}:end -->$",
        re.MULTILINE | re.DOTALL,
    )
    if marker_pattern.search(document):
        return marker_pattern.sub(lambda _: wrapped, document, count=1)

    adoption_pattern = ADOPTION_PATTERNS[name]
    if not adoption_pattern.search(document):
        raise ValueError(f"cannot find shared {name!r} region")
    return adoption_pattern.sub(lambda _: wrapped, document, count=1)


def synchronize(path: Path, config: PageConfig) -> tuple[str, str]:
    original = path.read_text(encoding="utf-8")
    updated = original
    regions = rendered_regions(config)
    for name in REGION_ORDER:
        if name in regions:
            updated = replace_region(updated, name, regions[name])
    return original, updated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="report drift without writing files",
    )
    arguments = parser.parse_args()

    changed: list[str] = []
    failures: list[str] = []
    for filename, config in PAGES.items():
        path = ROOT / filename
        try:
            original, updated = synchronize(path, config)
        except (OSError, ValueError) as error:
            failures.append(f"{filename}: {error}")
            continue
        if original == updated:
            continue
        changed.append(filename)
        if not arguments.check:
            path.write_text(updated, encoding="utf-8")

    if failures:
        print("Shared HTML synchronization failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    if arguments.check and changed:
        print("Shared HTML regions are out of date:", file=sys.stderr)
        for filename in changed:
            print(f"- {filename}", file=sys.stderr)
        print("Run: npm run site:sync", file=sys.stderr)
        return 1

    if changed:
        print(f"Synchronized shared HTML in {len(changed)} page(s):")
        for filename in changed:
            print(f"- {filename}")
    else:
        print("Shared HTML regions are up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
