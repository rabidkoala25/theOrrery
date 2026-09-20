# Orrery - a static encyclopedia site for scanned space books

A GitHub Pages site that turns plain-text scans of reference books into a
browsable, searchable encyclopedia. It ships with the *Encyclopedia of Astronomy
and Astrophysics* (4 volumes, 2001): 2,475 entries, 2.8 million words, with
full-text search that runs entirely in the browser — no server, no database, no
build toolchain beyond Python 3.

```
sources/    the books as plain text, plus books.json (what to build)
tools/      build.py + parsers.py (the only code that touches the raw text)
docs/       the website — this is what GitHub Pages serves
```

## Add another book

Any plain-text scan works — the `.txt` that comes with a `\_djvu.txt` download
from the Internet Archive is the usual shape.

```bash
python3 tools/build.py --add \~/Downloads/space\_physiology\_djvu.txt \\
    --title "Space Physiology and Medicine" \\
    --author "Nicogossian et al." --year "1994"
```

That copies the file into `sources/`, registers it in `sources/books.json`,
works out how the book is laid out, and builds it. Reload the site and the new
book is on the shelf, in the book switcher, and in cross-book search.

Other commands:

```bash
python3 tools/build.py                 # rebuild every registered book
python3 tools/build.py --only astronomy-astrophysics
python3 tools/build.py --add file.txt --title "..." --profile caps-heading
```

### If a new book comes out badly

The build prints how many entries it found. If that number looks wrong (three
entries for a 600-page book, or 40,000 for a small one), the book is laid out
differently and needs a different parser. Open `sources/books.json` and set
`profile` for that book:

|profile|when to use it|
|-|-|
|`auto`|default: inspects the text and picks one of the below|
|`running-header`|every page repeats a header line, e.g. `ENCYCLOPEDIA OF ASTRONOMY AND ASTROPHYSICS`. Entry titles are the running head printed beside it.|
|`caps-heading`|entry titles sit alone on a line IN CAPITALS|
|`title-heading`|entry titles sit alone on a short line in Title Case|

`running-header` takes two options, both regular expressions:

```json
{
  "id": "astronomy-astrophysics",
  "file": "encyclopedia-of-astronomy-and-astrophysics.txt",
  "profile": "running-header",
  "options": {
    "header": "ENCYCLOPEDIA OF ASTRONOMY (?:AND|\&) ASTROPHYSICS",
    "footer": "Copyright\\\\s\*©.\*Nature Publishing|Brunel Road, Houndmills"
  },
  "min\_words": 12
}
```

`header` finds the running header; `footer` lists the boilerplate lines to throw
away. `min\_words` drops fragments shorter than that.

Writing a parser for an awkward book means adding one function to
`tools/parsers.py` and registering it in `PARSERS` at the bottom of that file. A
parser only has to say where each entry starts and stops; de-hyphenation,
paragraph reflow, heading detection, figure captions and *see also* links are
handled the same way for every book.

## How the site stays fast on 20 MB of text

`tools/build.py` writes three kinds of file per book into `docs/data/<book-id>/`:

* `index.json` — every entry title, its first line, its letter and word count.
Loaded once (about 600 KB for the astronomy volume) and used for the A–Z rail,
the title filter and result lists.
* `chunks/NNN.json` — entry text, packed about 100 KB at a time and fetched only
when you open an entry in that chunk.
* `search/NN.json` — an inverted index split into 96 shards. A search fetches
only the shards holding the words you typed, so a query costs one small
download per word, however large the library grows.

Both sides agree on which shard holds a word through the same FNV-1a hash
(`shard\_of` in `build.py`, `shardOf` in `app.js`). Change the shard count in one
place and you must change it in the other.

## Reading the site

* `/` focuses the search box; `Escape` leaves it.
* Arrow keys move through search results, `Enter` opens one.
* Opening an entry from a search highlights the words and offers a jump button.
* *See also* lines are real links wherever the target entry exists.
* Light and dark reading modes, remembered per browser.
* Every entry has its own URL: `#/astronomy-astrophysics/accretion-disks`.

## Customising

Site name and tagline live at the top of `sources/books.json`:

```json
"site": { "title": "Orrery", "tagline": "A reading room for space reference books" }
```

Colours and type are CSS variables at the top of `docs/assets/styles.css`.
The code is yours to change; the book text belongs to its publishers.

