#!/usr/bin/env python3
"""
Build the encyclopedia site data from the plain-text books in sources/.

    python3 tools/build.py                      rebuild every book
    python3 tools/build.py --only astronomy     rebuild one book
    python3 tools/build.py --add sources/x.txt --title "Space Medicine" \
        --author "..." --year 1998               register a new book, then build

Reads   sources/books.json  +  sources/*.txt
Writes  docs/data/books.json
        docs/data/<book-id>/index.json      titles, order, chunk map, snippets
        docs/data/<book-id>/chunks/NN.json  entry text, fetched on demand
        docs/data/<book-id>/search/NN.json  inverted index shards

Nothing here is specific to one book: the per-book parser profile in
sources/books.json decides how the text is cut into entries (see parsers.py).
"""

import argparse
import json
import os
import re
import shutil
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parsers  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, "sources")
DATA = os.path.join(ROOT, "docs", "data")

CHUNK_BYTES = 110_000      # target size of one entry chunk
SEARCH_SHARDS = 96         # inverted index is split this many ways
MAX_POSTINGS = 1200        # per term, keeps common words from bloating shards
SNIPPET_CHARS = 180

STOPWORDS = set("""a an and are as at be but by for from has have he her his if in into is it its
of on or our she such that the their then there these they this to was were which while who will
with you your not no can may more most been also than them we us i""".split())


# --------------------------------------------------------------------------
# text cleaning (shared by every parser profile)

DEHYPH = re.compile(r"([A-Za-zÀ-ÿ])[-\u00ad]$")
FIG = re.compile(r"^(figure|fig\.|table|plate)\s*\d+\s*[.:]", re.I)
SEE_ALSO = re.compile(r"^see\s+also\s*:", re.I)
HEADING_STOP = ".,;:•"


def join_block(block):
    """Join the lines of one block into a paragraph, undoing hyphenation."""
    out = ""
    for i, line in enumerate(block):
        line = line.strip()
        if not out:
            out = line
            continue
        m = DEHYPH.search(out)
        if m and line[:1].islower():
            out = out[:-1] + line
        else:
            out = out + " " + line
    return re.sub(r"\s+", " ", out).strip()


def is_junk(text):
    """Stray OCR fragments from figure labels: no real word in them."""
    if len(text) <= 8:
        return True
    return not re.search(r"[A-Za-zÀ-ÿ]{3}", text)


def is_heading(text, nxt):
    if len(text) > 64 or not text:
        return False
    if text[-1] in HEADING_STOP:
        return False
    if not (text[0].isupper() or text[0].isdigit()):
        return False
    if FIG.match(text) or SEE_ALSO.match(text):
        return False
    if re.search(r"[=<>]|\d{4}\)", text):
        return False
    words = text.split()
    if len(words) > 9:
        return False
    return bool(nxt) and len(nxt) > 60


def split_inline_heading(block):
    """Printed section headings often sit on the first line of a block, with no
    blank line under them. Spot them by line length: body lines are justified to
    a steady column, a heading is visibly short."""
    if len(block) < 3:
        return None, block
    head = block[0].strip()
    rest = [l for l in block[1:] if l.strip()]
    if len(head) > 56 or len(head.split()) > 8:
        return None, block
    if head[-1:] in HEADING_STOP or not head[:1].isupper():
        return None, block
    if FIG.match(head) or SEE_ALSO.match(head):
        return None, block
    if re.search(r"[=~@<>]|\d\s*[,.]\s*\d", head):
        return None, block
    widths = sorted(len(l) for l in rest[:-1]) or [0]
    typical = widths[len(widths) // 2]
    if typical and len(head) < 0.72 * typical and rest[0][:1].isupper():
        return head, block[1:]
    return None, block


def clean_entry(blocks):
    """Blocks of raw lines -> list of [kind, text] where kind is p/h/fig/see."""
    paras = []
    for block in blocks:
        head, block = split_inline_heading(block)
        if head:
            paras.append((head, "h"))
        text = join_block(block)
        if not text or is_junk(text):
            continue
        paras.append((text, None))

    out = []
    for i, (text, forced) in enumerate(paras):
        nxt = paras[i + 1][0] if i + 1 < len(paras) else ""
        if forced:
            kind = forced
        elif SEE_ALSO.match(text):
            kind = "see"
        elif FIG.match(text):
            kind = "fig"
        elif is_heading(text, nxt):
            kind = "h"
        else:
            kind = "p"
        # a paragraph broken across a page boundary continues the previous one
        if (
            kind == "p"
            and out
            and out[-1][0] == "p"
            and text[:1].islower()
            and not re.search(r"[.!?:;»”\"']$", out[-1][1])
        ):
            out[-1][1] = join_block([out[-1][1], text])
            continue
        out.append([kind, text])
    return out


def link_see_also(entries):
    """Turn the 'See also:' line of each entry into links where the target exists."""
    by_key = {}
    for e in entries:
        by_key.setdefault(parsers.normalize_key(e["title"]), e["id"])
    for e in entries:
        for para in e["body"]:
            if para[0] != "see":
                continue
            tail = SEE_ALSO.sub("", para[1])
            links = []
            for raw in re.split(r"[;,]", tail):
                label = raw.strip().strip(".")
                if not label or len(label) > 70:
                    continue
                key = parsers.normalize_key(label)
                target = by_key.get(key) or by_key.get(re.sub(r"^the ", "", key))
                if target is None and not key.endswith("s"):
                    target = by_key.get(key + "s")
                if target is None and key.endswith("s"):
                    target = by_key.get(key[:-1])
                links.append([label, target])
            if links:
                para.append(links)


def slugify(title):
    s = unicodedata.normalize("NFKD", title)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^0-9A-Za-z]+", "-", s).strip("-").lower()
    return s[:70] or "entry"


def sort_key(title):
    s = unicodedata.normalize("NFKD", title)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"^(the|a|an)\s+", "", s)
    # digits sort before letters, as they do in a printed index
    return re.sub(r"[^0-9a-z ]+", "", s).strip()


def first_letter(title):
    k = sort_key(title)
    if not k:
        return "#"
    c = k[0]
    return c.upper() if c.isalpha() else "#"


# --------------------------------------------------------------------------
# search index

def tokenize(text):
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    for tok in re.findall(r"[a-z][a-z0-9]{1,24}", text):
        if tok not in STOPWORDS:
            yield tok


def shard_of(term):
    """FNV-1a, mirrored in app.js — both sides must agree on the shard."""
    h = 0x811C9DC5
    for ch in term.encode("utf-8"):
        h ^= ch
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h % SEARCH_SHARDS


# --------------------------------------------------------------------------
# build one book

def build_book(book):
    src = os.path.join(SOURCES, book["file"])
    if not os.path.exists(src):
        raise SystemExit(f"missing source file: {src}")
    print(f"  reading {book['file']} ({os.path.getsize(src)/1e6:.1f} MB)")
    text = open(src, encoding="utf-8", errors="replace").read()

    profile = book.get("profile", "auto")
    opts = dict(book.get("options", {}))
    if profile == "auto":
        guess, guessed = parsers.sniff(text)
        print(f"  profile: auto -> {guess}")
        profile, opts = guess, {**guessed, **opts}
    parse = parsers.PARSERS.get(profile)
    if not parse:
        raise SystemExit(f"unknown parser profile: {profile}")

    raw_entries = parse(text, opts)
    print(f"  parsed {len(raw_entries)} entries")

    entries, seen = [], {}
    for raw in raw_entries:
        body = clean_entry(raw["blocks"])
        words = sum(len(p[1].split()) for p in body)
        if words < int(book.get("min_words", 12)):
            continue
        title = raw["title"]
        slug = slugify(title)
        if slug in seen:
            seen[slug] += 1
            slug = f"{slug}-{seen[slug]}"
        else:
            seen[slug] = 1
        entries.append({"id": slug, "title": title, "body": body, "words": words})

    entries.sort(key=lambda e: (sort_key(e["title"]), e["title"]))
    link_see_also(entries)
    print(f"  kept {len(entries)} entries, {sum(e['words'] for e in entries):,} words")

    out_dir = os.path.join(DATA, book["id"])
    for sub in ("chunks", "search"):
        d = os.path.join(out_dir, sub)
        if os.path.isdir(d):
            shutil.rmtree(d)
        os.makedirs(d)

    # ---- chunks of entry bodies, fetched only when an entry is opened
    chunks, cur, cur_bytes = [], {}, 0
    index_rows = []
    for e in entries:
        payload = {"t": e["title"], "b": e["body"]}
        blob = json.dumps(payload, ensure_ascii=False)
        if cur and cur_bytes + len(blob) > CHUNK_BYTES:
            chunks.append(cur)
            cur, cur_bytes = {}, 0
        cur[e["id"]] = payload
        cur_bytes += len(blob)
        lead = next((p[1] for p in e["body"] if p[0] == "p"), "")
        snippet = lead[:SNIPPET_CHARS].rsplit(" ", 1)[0] if len(lead) > SNIPPET_CHARS else lead
        index_rows.append([e["id"], e["title"], len(chunks), snippet, first_letter(e["title"]), e["words"]])
    if cur:
        chunks.append(cur)

    for i, chunk in enumerate(chunks):
        with open(os.path.join(out_dir, "chunks", f"{i:03d}.json"), "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False, separators=(",", ":"))

    # ---- inverted index
    postings = {}
    for n, e in enumerate(entries):
        counts = {}
        for tok in tokenize(e["title"]):
            counts[tok] = counts.get(tok, 0) + 6   # title hits weigh more
        for para in e["body"]:
            kind, text = para[0], para[1]
            weight = 3 if kind == "h" else 1
            for tok in tokenize(text):
                counts[tok] = counts.get(tok, 0) + weight
        for tok, tf in counts.items():
            postings.setdefault(tok, []).append((n, tf))

    shards = [dict() for _ in range(SEARCH_SHARDS)]
    for term, plist in postings.items():
        if len(plist) > MAX_POSTINGS:
            plist = sorted(plist, key=lambda x: -x[1])[:MAX_POSTINGS]
        flat = []
        for doc, tf in sorted(plist):
            flat.append(doc)
            flat.append(min(tf, 255))
        shards[shard_of(term)][term] = flat
    for i, shard in enumerate(shards):
        with open(os.path.join(out_dir, "search", f"{i:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(shard, f, ensure_ascii=False, separators=(",", ":"))

    letters = {}
    for row in index_rows:
        letters[row[4]] = letters.get(row[4], 0) + 1

    index = {
        "id": book["id"],
        "title": book["title"],
        "subtitle": book.get("subtitle", ""),
        "author": book.get("author", ""),
        "year": book.get("year", ""),
        "note": book.get("note", ""),
        "entries": index_rows,
        "chunks": len(chunks),
        "shards": SEARCH_SHARDS,
        "letters": letters,
        "words": sum(e["words"] for e in entries),
    }
    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    size = sum(
        os.path.getsize(os.path.join(dp, fn))
        for dp, _, fns in os.walk(out_dir)
        for fn in fns
    )
    print(f"  wrote {len(chunks)} chunks + {SEARCH_SHARDS} search shards ({size/1e6:.1f} MB)")
    return {
        "id": book["id"],
        "title": book["title"],
        "subtitle": book.get("subtitle", ""),
        "author": book.get("author", ""),
        "year": book.get("year", ""),
        "entries": len(entries),
        "words": index["words"],
    }


# --------------------------------------------------------------------------
# registry

def load_registry():
    path = os.path.join(SOURCES, "books.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_registry(reg):
    path = os.path.join(SOURCES, "books.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)
        f.write("\n")


def add_book(args):
    reg = load_registry()
    src = args.add
    if not os.path.exists(src):
        raise SystemExit(f"no such file: {src}")
    filename = os.path.basename(src)
    dest = os.path.join(SOURCES, filename)
    if os.path.abspath(src) != os.path.abspath(dest):
        shutil.copyfile(src, dest)
        print(f"copied into sources/{filename}")
    title = args.title or os.path.splitext(filename)[0].replace("_", " ")
    book_id = args.id or slugify(title)
    if book_id in RESERVED_IDS:
        raise SystemExit(f"'{book_id}' is reserved by the site; pass --id something-else")
    if any(b["id"] == book_id for b in reg["books"]):
        raise SystemExit(f"book id '{book_id}' is already registered")
    book = {
        "id": book_id,
        "title": title,
        "subtitle": args.subtitle or "",
        "author": args.author or "",
        "year": args.year or "",
        "file": filename,
        "profile": args.profile,
        "options": {},
    }
    reg["books"].append(book)
    save_registry(reg)
    print(f"registered '{title}' as {book_id}")
    return book_id


RESERVED_IDS = {"search", "sims"}


def check_sims(manifest):
    """Warn about simulations that link to entries which do not exist."""
    path = os.path.join(ROOT, "docs", "sims", "sims.json")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        sims = json.load(f).get("sims", [])
    ids = {}
    for book in manifest["books"]:
        idx_path = os.path.join(DATA, book["id"], "index.json")
        with open(idx_path, encoding="utf-8") as f:
            ids[book["id"]] = {row[0] for row in json.load(f)["entries"]}
    broken = 0
    for sim in sims:
        script = os.path.join(ROOT, "docs", "sims", sim.get("script", ""))
        if not os.path.exists(script):
            print(f"  ! simulation '{sim['id']}': missing script {sim.get('script')}")
            broken += 1
        for link in sim.get("articles", []):
            if link["entry"] not in ids.get(link["book"], ()):
                print(f"  ! simulation '{sim['id']}' links to missing entry {link['book']}/{link['entry']}")
                broken += 1
    total = sum(len(s_.get("articles", [])) for s_ in sims)
    print(f"simulations: {len(sims)}, article links: {total}, broken: {broken}")


def main():
    ap = argparse.ArgumentParser(description="Build the encyclopedia site data.")
    ap.add_argument("--only", help="rebuild a single book id")
    ap.add_argument("--add", help="path to a new plain-text book to register")
    ap.add_argument("--title")
    ap.add_argument("--subtitle")
    ap.add_argument("--author")
    ap.add_argument("--year")
    ap.add_argument("--id", help="url id for the new book (default: from title)")
    ap.add_argument("--profile", default="auto", help="parser profile for the new book")
    args = ap.parse_args()

    added = add_book(args) if args.add else None
    reg = load_registry()
    todo = reg["books"]
    only = args.only or added
    if only:
        todo = [b for b in reg["books"] if b["id"] == only]
        if not todo:
            raise SystemExit(f"no book with id '{only}'")

    os.makedirs(DATA, exist_ok=True)
    built = {}
    manifest_path = os.path.join(DATA, "books.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            built = {b["id"]: b for b in json.load(f).get("books", [])}

    for book in todo:
        print(f"\n{book['title']}")
        built[book["id"]] = build_book(book)

    order = [b["id"] for b in reg["books"]]
    if not only:
        for stale in set(built) - set(order):
            del built[stale]
            shutil.rmtree(os.path.join(DATA, stale), ignore_errors=True)
            print(f"removed data for unregistered book '{stale}'")


    manifest = {
        "site": reg.get("site", {}),
        "books": [built[i] for i in order if i in built],
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\ndone — {len(manifest['books'])} book(s) in docs/data/")
    check_sims(manifest)


if __name__ == "__main__":
    main()
