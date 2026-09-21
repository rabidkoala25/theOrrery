"""
Parsers that turn a plain-text scan of a reference book into structured entries.

Each parser takes the raw text of one book plus a dict of options and returns a
list of entries:

    {"title": str, "blocks": [[line, line, ...], ...]}

`blocks` are paragraph-sized groups of raw lines; build.py does the cleaning
(de-hyphenation, paragraph joining, heading detection) that is common to all
books, so a new parser only has to answer one question: where does each entry
start and stop?

Available profiles
------------------
running-header  Pages carry a running header line ("ENCYCLOPEDIA OF ...").
                Consecutive pages whose running head matches are one entry.
                Works for most OCR'd multi-volume encyclopedias.
caps-heading    Entry titles sit on their own line in CAPITALS.
title-heading   Entry titles sit on their own short line in Title Case,
                separated from the body by a blank line.
auto            Look at the text and pick one of the above.

Add your own by writing a function and registering it in PARSERS at the bottom.
"""

import re
import unicodedata
from collections import Counter

# --------------------------------------------------------------------------
# helpers


def normalize_key(s):
    """Loose comparison key: accents, case and punctuation removed."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^0-9a-z]+", " ", s.lower()).strip()


def split_lines(text):
    return [l.rstrip() for l in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]


def to_blocks(lines):
    """Group lines into blocks separated by blank lines."""
    blocks, cur = [], []
    for line in lines:
        if line.strip():
            cur.append(line.strip())
        elif cur:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    return blocks


def looks_like_caps_heading(line):
    t = line.strip()
    if len(t) < 3 or len(t) > 90:
        return False
    letters = [c for c in t if c.isalpha()]
    if len(letters) < 3:
        return False
    upper = sum(1 for c in letters if c.isupper())
    return upper / len(letters) > 0.9


# --------------------------------------------------------------------------
# profile: running-header


def parse_running_header(text, opts):
    """
    Pages are delimited by a running header line. The entry title is the text
    printed next to that header (the running head), which repeats on every page
    of the same entry.

    Options
      header       regex matching the running header line (required)
      footer       regex matching footer/boilerplate lines to drop (optional)
      max_head_lines  how many wrapped lines a running head may occupy (default 4)
    """
    header_re = re.compile(opts["header"])
    footer_re = re.compile(opts["footer"]) if opts.get("footer") else None
    max_head = int(opts.get("max_head_lines", 4))

    lines = split_lines(text)
    heads = [i for i, l in enumerate(lines) if header_re.search(l)]
    if not heads:
        return []

    def head_block_start(h):
        """First line of the running-head block that precedes header line h."""
        j = h - 1
        while j >= 0 and not lines[j].strip():
            j -= 1
        end = j
        taken = 0
        while (
            j >= 0
            and lines[j].strip()
            and taken < max_head
            and not (footer_re and footer_re.search(lines[j]))
        ):
            j -= 1
            taken += 1
        return j + 1, end

    pages = []
    for n, h in enumerate(heads):
        start, end = head_block_start(h)
        head_lines = [lines[k].strip() for k in range(start, end + 1)] if end >= start else []
        inline = header_re.split(lines[h])[0].strip()
        running_head = " ".join(head_lines + ([inline] if inline else [])).strip()

        stop = head_block_start(heads[n + 1])[0] if n + 1 < len(heads) else len(lines)
        body = lines[h + 1 : stop]
        if footer_re:
            body = [l for l in body if not footer_re.search(l)]
        pages.append((running_head, body))

    # consecutive pages with the same running head belong to one entry
    entries = []
    for running_head, body in pages:
        key = normalize_key(running_head)
        if not key:
            continue
        if entries and entries[-1]["key"] == key:
            entries[-1]["lines"].extend([""] + body)
        else:
            entries.append({"key": key, "title": running_head, "lines": list(body)})

    out = []
    for e in entries:
        blocks = to_blocks(e["lines"])
        if not blocks:
            continue
        title = e["title"]
        # the first block of an entry normally reprints the title, often with
        # better line breaks than the running head — prefer it, then drop it
        first = " ".join(blocks[0])
        if _same_title(first, title):
            if len(first) <= len(title) * 1.6 + 12:
                title = first
                blocks = blocks[1:]
            else:
                # the title runs straight into the first sentence: keep the
                # running head and take the title words off the front
                stripped = _strip_title_prefix(blocks[0], title)
                if stripped:
                    blocks[0] = stripped
        out.append({"title": _tidy_title(title), "blocks": blocks})
    return out


def _same_title(a, b):
    ka, kb = normalize_key(a), normalize_key(b)
    if not ka or not kb:
        return False
    if ka == kb or ka.startswith(kb) or kb.startswith(ka):
        return True
    import difflib

    return difflib.SequenceMatcher(None, ka, kb).ratio() > 0.78


def _strip_title_prefix(block, title):
    """Remove the words of `title` from the front of a block, keeping lines."""
    want = normalize_key(title).split()
    words = [l.split() for l in block]
    line, wi = 0, 0
    while wi < len(want) and line < len(words):
        if not words[line]:
            line += 1
            continue
        tok = normalize_key(words[line][0]).split()
        if tok and tok[0] == want[wi] and len(tok) == 1:
            words[line].pop(0)
            wi += 1
        elif not tok:
            words[line].pop(0)
        else:
            return None
    if wi < len(want):
        return None
    out = [" ".join(w) for w in words]
    out = [l for l in out if l.strip()]
    return out or None


def _tidy_title(t):
    t = re.sub(r"\s+", " ", t).strip(" .,;:-—–")
    # a running head that swallowed the tail of the previous page: the real
    # title follows the page number that separates them
    t = re.sub(r"^\d+\s*:\s*(SPO\s*)?", "", t)
    if len(t) > 75:
        parts = re.split(r"(?<=\s)\d{1,3}\s+(?=[A-Z])", t)
        if len(parts) > 1 and 3 < len(parts[-1]) < 75:
            t = parts[-1]
    t = re.sub(r"\s+([),])", r"\1", t)
    t = re.sub(r"\(\s+", "(", t)
    return t


# --------------------------------------------------------------------------
# profile: caps-heading / title-heading


def _parse_by_heading(text, opts, is_heading):
    lines = split_lines(text)
    drop_re = re.compile(opts["footer"]) if opts.get("footer") else None
    starts = [i for i, l in enumerate(lines) if is_heading(l)]
    if not starts:
        return []
    entries = []
    for n, s in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        body = lines[s + 1 : end]
        if drop_re:
            body = [l for l in body if not drop_re.search(l)]
        blocks = to_blocks(body)
        if not blocks:
            continue
        entries.append({"title": _tidy_title(lines[s]), "blocks": blocks})
    return entries


def parse_caps_heading(text, opts):
    min_words = int(opts.get("min_words", 1))

    def is_heading(line):
        if not looks_like_caps_heading(line):
            return False
        return len(line.split()) >= min_words

    return _parse_by_heading(text, opts, is_heading)


def parse_title_heading(text, opts):
    """A short line, initial capital, no sentence-ending punctuation, with a
    blank line on either side."""
    lines = split_lines(text)
    blank = [not l.strip() for l in lines]

    def is_heading(i):
        l = lines[i].strip()
        if not l or len(l) > 70 or len(l.split()) > 9:
            return False
        if not l[0].isupper():
            return False
        if l[-1] in ".,;:":
            return False
        before = i == 0 or blank[i - 1]
        after = i + 1 < len(lines) and blank[i + 1]
        return before and after

    starts = [i for i in range(len(lines)) if is_heading(i)]
    return _by_index(lines, starts, opts)


def _by_index(lines, starts, opts):
    drop_re = re.compile(opts["footer"]) if opts.get("footer") else None
    entries = []
    for n, s in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        body = lines[s + 1 : end]
        if drop_re:
            body = [l for l in body if not drop_re.search(l)]
        blocks = to_blocks(body)
        if not blocks:
            continue
        entries.append({"title": _tidy_title(lines[s]), "blocks": blocks})
    return entries


# --------------------------------------------------------------------------
# profile: auto


def sniff(text, sample_lines=200000):
    """Guess a profile and its options for an unknown book."""
    lines = split_lines(text)[:sample_lines]
    counts = Counter(l.strip() for l in lines if 12 < len(l.strip()) < 120)
    for line, n in counts.most_common(12):
        if n >= 40 and re.search(r"[A-Za-z]", line) and looks_like_caps_heading(line):
            return "running-header", {"header": re.escape(line)}
    caps = sum(1 for l in lines if looks_like_caps_heading(l))
    if caps >= 15:
        return "caps-heading", {}
    return "title-heading", {}


def parse_auto(text, opts):
    profile, guessed = sniff(text)
    merged = dict(guessed)
    merged.update({k: v for k, v in opts.items() if k != "profile"})
    entries = PARSERS[profile](text, merged)
    if len(entries) < 5 and profile != "title-heading":
        entries = PARSERS["title-heading"](text, merged)
    return entries


PARSERS = {
    "running-header": parse_running_header,
    "caps-heading": parse_caps_heading,
    "title-heading": parse_title_heading,
    "auto": parse_auto,
}
