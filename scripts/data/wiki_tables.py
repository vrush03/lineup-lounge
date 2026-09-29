"""Extract tables from Wikipedia parse-API HTML, tagged with their section headings.

Rowspans/colspans are expanded so each row has one cell per column.
"""
import html
import json
import re
from html.parser import HTMLParser

SKIP_TAGS = {'sup', 'style', 'script'}
VOID_TAGS = {'br', 'img', 'hr', 'input', 'meta', 'link', 'wbr', 'col', 'source'}


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headings = {}  # level -> text
        self.tables = []
        self._stack = []  # open tables
        self._heading = None
        self._skip_tag = None  # tag that opened a skipped (hidden/footnote) subtree
        self._skip_depth = 0
        self._caption = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self._skip_tag:
            if tag == self._skip_tag:
                self._skip_depth += 1
            return
        hidden = 'display:none' in (a.get('style') or '').replace(' ', '')
        if (tag in SKIP_TAGS or hidden) and tag not in VOID_TAGS:
            self._skip_tag, self._skip_depth = tag, 1
            return
        if re.fullmatch(r'h[2-5]', tag) and not self._stack:
            self._heading = [int(tag[1]), '']
        elif tag == 'table':
            self._stack.append({'rows': [], 'cls': a.get('class', ''), 'caption': '',
                                'section': dict(self.headings)})
        elif self._stack:
            t = self._stack[-1]
            if tag == 'tr':
                t['rows'].append([])
            elif tag in ('td', 'th') and t['rows'] is not None:
                if not t['rows']:
                    t['rows'].append([])
                t['rows'][-1].append({'text': '', 'th': tag == 'th', 'rs': int(re.sub(r'\D', '', a.get('rowspan', '1')) or 1),
                                      'cs': int(re.sub(r'\D', '', a.get('colspan', '1')) or 1), 'titles': []})
            elif tag == 'caption':
                self._caption = ''
            elif tag == 'a' and t['rows'] and t['rows'][-1]:
                cell = t['rows'][-1][-1]
                if a.get('title'):
                    cell['titles'].append(a['title'])
            elif tag == 'br' and t['rows'] and t['rows'][-1]:
                t['rows'][-1][-1]['text'] += ' | '  # line break marker; callers split or drop it

    def handle_endtag(self, tag):
        if self._skip_tag:
            if tag == self._skip_tag:
                self._skip_depth -= 1
                if not self._skip_depth:
                    self._skip_tag = None
            return
        if self._heading and tag == f'h{self._heading[0]}':
            lvl, text = self._heading
            text = re.sub(r'\[edit\]', '', text).strip()
            self.headings = {k: v for k, v in self.headings.items() if k < lvl}
            self.headings[lvl] = text
            self._heading = None
        elif tag == 'table' and self._stack:
            self.tables.append(self._stack.pop())
        elif tag == 'caption' and self._stack and self._caption is not None:
            self._stack[-1]['caption'] = self._caption.strip()
            self._caption = None

    def handle_data(self, data):
        if self._skip_tag:
            return
        if self._heading is not None:
            self._heading[1] += data
        elif self._caption is not None:
            self._caption += data
        elif self._stack:
            t = self._stack[-1]
            if t['rows'] and t['rows'][-1]:
                t['rows'][-1][-1]['text'] += data


def _grid(rows):
    """Expand row/colspans into a rectangular grid of cells."""
    out, pending = [], {}  # pending: col -> (cell, remaining rows)
    for r in rows:
        line, col, cells = [], 0, list(r)
        while cells or col in pending:
            if col in pending:
                cell, left = pending[col]
                line.append(cell)
                if left > 1:
                    pending[col] = (cell, left - 1)
                else:
                    del pending[col]
                col += 1
                continue
            cell = cells.pop(0)
            for _ in range(cell['cs']):
                line.append(cell)
                if cell['rs'] > 1:
                    pending[col] = (cell, cell['rs'] - 1)
                col += 1
        out.append([{'text': re.sub(r'\s+', ' ', html.unescape(c['text'])).strip(), 'th': c['th'], 'titles': c['titles']}
                    for c in line])
    return [r for r in out if r]


def tables(path):
    d = json.load(open(path))
    p = _Parser()
    p.feed(d['parse']['text'])
    result = []
    for t in p.tables:
        if 'wikitable' not in t['cls']:
            continue
        g = _grid(t['rows'])
        if len(g) < 3:
            continue
        # header = leading rows made of <th> only
        head_rows = 0
        while head_rows < len(g) and all(c['th'] for c in g[head_rows]):
            head_rows += 1
        if not head_rows and not re.search(r'\d', g[0][0]['text']):
            head_rows = 1  # header row written with <td>
        # trailing "Last updated" / footnote rows span every column
        updated = None
        while g and len({c['text'] for c in g[-1]}) == 1:
            m = re.search(r'Last updated:?\s*(.+)', g[-1][0]['text'])
            updated = updated or (m and m.group(1).strip())
            g = g[:-1]
        header = [' '.join(dict.fromkeys(g[i][j]['text'] for i in range(head_rows) if j < len(g[i]))).strip()
                  for j in range(len(g[0]))] if head_rows else []
        result.append({'section': [t['section'][k] for k in sorted(t['section'])], 'caption': t['caption'],
                       'header': header, 'rows': g[head_rows:], 'updated': updated})
    return result


if __name__ == '__main__':
    import sys
    for i, t in enumerate(tables(sys.argv[1])):
        print(i, ' > '.join(t['section']), '|', t['caption'], '|', t['header'], '|', len(t['rows']))
