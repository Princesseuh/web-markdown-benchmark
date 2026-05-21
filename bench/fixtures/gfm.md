# GFM Reference Stress Document

A long-form GFM document exercising tables, task lists, footnotes,
strikethrough, autolinks, and mixed inline formatting in combination.

## Comparison Tables

### Library matrix

| Library     | Language | GFM      | Plugins    | AST    | License        |
| ----------- | -------- | -------- | ---------- | ------ | -------------- |
| markdown-it | JS       | Built-in | Token-rule | Tokens | MIT            |
| marked      | JS       | Opt-in   | Renderer   | Tokens | MIT            |
| remark      | JS       | Plugin   | Tree       | mdast  | MIT            |
| micromark   | JS       | Ext.     | Low-level  | Events | MIT            |
| comark      | JS       | Built-in | Token+post | Custom | MIT            |
| Sätteri     | Rust     | Built-in | Tree       | mdast  | MIT/Apache-2.0 |

### Feature alignment

| Feature             | CommonMark | GFM | Sätteri | Notes                           |
| :------------------ | :--------: | :-: | :-----: | :------------------------------ |
| Headings            |     ✓      |  ✓  |    ✓    | ATX and Setext both supported   |
| Lists               |     ✓      |  ✓  |    ✓    | Ordered, unordered, loose/tight |
| Tables              |     —      |  ✓  |    ✓    | Including alignment             |
| Task lists          |     —      |  ✓  |    ✓    | Nested OK                       |
| Strikethrough       |     —      |  ✓  |    ✓    | `~~text~~`                      |
| Autolinks (literal) |     —      |  ✓  |    ✓    | URLs and email                  |
| Footnotes           |     —      |  ✓  |    ✓    | Inline and reference style      |
| Hard line breaks    |     ✓      |  ✓  |    ✓    | Trailing two spaces             |
| Code (fenced)       |     ✓      |  ✓  |    ✓    | Plus info string handling       |
| HTML passthrough    |     ✓      |  ✓  |    ✓    | Block-level only by default     |

### Performance projections

| Doc size |                        Sätteri                        | markdown-it |   marked   |   comark    |   remark    |
| :------: | :---------------------------------------------------: | :---------: | :--------: | :---------: | :---------: |
|  < 1 KB  |                      ~110k ops/s                      | ~38k ops/s  | ~22k ops/s | ~12k ops/s  | ~1.4k ops/s |
|  ~10 KB  |                      ~17k ops/s                       | ~3.7k ops/s | ~3k ops/s  | ~1.6k ops/s | ~270 ops/s  |
|  ~50 KB  |                      ~2.9k ops/s                      | ~770 ops/s  | ~430 ops/s | ~230 ops/s  |  ~25 ops/s  |
| ~100 KB  | extrapolated; benchmark and verify on your own corpus |

## Task Lists

The roadmap, in checklist form:

- [x] Initial parser implementation
- [x] CommonMark conformance test suite passing
- [x] GFM tables and strikethrough
- [x] GFM task lists
  - [x] Top-level task lists
  - [x] Nested task lists
    - [x] Two-deep nesting
    - [ ] Four-deep nesting (open question: does anyone actually use this?)
  - [x] Loose vs tight rendering parity with reference
- [x] GFM autolinks (URLs and email)
- [x] GFM footnotes
- [ ] MDX expression evaluation in browser builds
- [ ] Streaming/incremental parsing for large files
  - [ ] Public streaming API
  - [ ] Incremental re-parse on edit
- [x] ~~Synchronous-only API~~ — superseded by hybrid sync/async
- [ ] Plugin sandboxing with explicit capability grants
- [x] Documentation site
- [ ] Visual debugger for AST inspection

## Strikethrough Mixed With Other Formatting

The classic mistake is ~~mutating the AST in place~~ working around the
visitor; ~~we tried it~~ and it produced ~~surprisingly buggy~~
genuinely subtle bugs[^1]. The current advice is **always** use
`ctx.setProperty()` (and _never_ assign to `node.foo` directly), even
when ~~it seems harmless~~ you're sure no other plugin will read it.

The previous default of `~~html: true~~` was changed to `html: false`
in v3 — see the [migration guide](https://example.com/migrate-v3) and
the related discussion at https://github.com/example/repo/discussions/142.

## Autolinks

A paragraph with several literal URLs: visit https://commonmark.org for
the spec, https://github.github.com/gfm/ for the GFM addendum, and
https://spec.commonmark.org/dingus/ for an interactive parser. For
package-specific docs see https://www.npmjs.com/package/markdown-it,
https://www.npmjs.com/package/remark, and the source at
https://github.com/markdown-it/markdown-it/blob/master/README.md.

For correspondence, reach the maintainers at noreply@example.com or
file an issue. Bug reports go to bugs@example.com; security reports to
security@example.com (please don't open public issues for those).

The same paragraph but with explicit links: visit
[CommonMark](https://commonmark.org) for the spec,
[GFM](https://github.github.com/gfm/) for the addendum, and the
[dingus](https://spec.commonmark.org/dingus/) for hands-on
exploration.

## Footnotes

Modern CommonMark has shifted toward stricter parsing[^cm-spec], which
mostly affects edge cases around HTML blocks[^html-blocks] and link
reference definitions in container blocks[^link-refs]. For a deeper
dive see the rationale doc[^rationale].

Inline footnotes are also handy^[like this one, defined right at the
point of reference] when the note is short.

[^1]:
    A particularly painful one: a plugin that ran _before_ a
    heading-id plugin would mutate the heading text node's `value`
    directly, which the id plugin had already cached a reference to,
    so the slug was generated from the _post_-mutation value but the
    anchor link from the _pre_-mutation value. The two diverged
    silently — no error, just broken anchors in production.

[^cm-spec]:
    The current spec is at https://spec.commonmark.org/0.31.2/
    and is the reference all conformant parsers should target.

[^html-blocks]:
    HTML blocks have seven distinct subtypes per the
    spec, each with different "what counts as the closing
    line" rules. Most parsers get the common cases right
    and corner cases wrong; running the official suite is
    the only way to be sure.

[^link-refs]:
    Link reference definitions inside list items, block
    quotes, and footnote bodies are a common source of
    parser disagreement. CommonMark says they're scoped to
    the document; some implementations historically scoped
    them to the container.

[^rationale]:
    See the GitHub flavored markdown rationale document for
    why specific choices were made — particularly around
    autolinks (no telephone numbers, despite the obvious
    utility) and tables (column counts must match, no
    implicit empty cells).

## Mixed-Feature Paragraphs

A paragraph that combines **bold**, _italic_, **_bold italic_**,
~~strikethrough~~, `inline code`, [a link](https://example.com),
a literal URL https://example.com, an autolinked email
test@example.com, and a footnote reference[^1] all in one. Parsers
that handle each feature in isolation sometimes mishandle the
interactions — for instance, **bold containing a [link with
~~strikethrough~~ inside](https://example.com)** is a real-world
construct that exercises three nesting levels at once.

## Tables With Inline Formatting

| Status        | Description                                            | Linked PR                                          |
| ------------- | ------------------------------------------------------ | -------------------------------------------------- |
| ✅ **Stable** | The API is **stable** and follows semver               | [#1024](https://github.com/example/repo/pull/1024) |
| ⚠️ Beta       | _Available_ but ~~unstable~~ subject to change         | [#1042](https://github.com/example/repo/pull/1042) |
| 🚧 Alpha      | Behind a flag; expect ~~breakage~~ rough edges         | [#1078](https://github.com/example/repo/pull/1078) |
| ❌ Deprecated | ~~Use this instead~~ — see [docs](https://example.com) | [#1099](https://github.com/example/repo/pull/1099) |

## Closing Notes

A normal closing paragraph with no exotic formatting, just to ensure
the parser doesn't get tripped up returning to plain prose after a
table-heavy section. Plain text. Plain text. Plain text. The end.
