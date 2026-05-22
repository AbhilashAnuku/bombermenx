/* BomberMen-X — tiny self-contained Markdown renderer.
   Hand-rolled, no dependencies, works under file://.
   Exports: window.renderMarkdown(src) -> htmlString
   Supported:
     - ATX headings #..######
     - Pipe tables (with header + separator + rows, fully responsive)
     - Fenced code blocks ``` (optional language)
     - Unordered lists (- or *) with nested indentation
     - Ordered lists (1.)
     - Blockquotes (>)
     - Bold **text**, italic *text*
     - Inline code `code`
     - Links [text](href) and bare URLs
     - Horizontal rule ---
     - Paragraphs for everything else
*/
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
  }

  // Inline transformations applied to a single text run.
  // Order matters: protect code, then links, then bold/italic, then bare URLs.
  function renderInline(text) {
    // Tokenize: extract `code` spans first so their content is never touched.
    var tokens = [];
    var i = 0;
    var buf = "";
    while (i < text.length) {
      var ch = text.charAt(i);
      if (ch === "`") {
        // find closing backtick
        var end = text.indexOf("`", i + 1);
        if (end !== -1) {
          if (buf.length) { tokens.push({ t: "text", v: buf }); buf = ""; }
          tokens.push({ t: "code", v: text.substring(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
      buf += ch;
      i++;
    }
    if (buf.length) tokens.push({ t: "text", v: buf });

    // Apply remaining inline rules to text tokens only.
    var out = "";
    for (var k = 0; k < tokens.length; k++) {
      var tk = tokens[k];
      if (tk.t === "code") {
        out += "<code>" + escapeHtml(tk.v) + "</code>";
        continue;
      }
      var s = escapeHtml(tk.v);

      // Links [text](href)
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]+)&quot;)?\)/g,
        function (_m, label, href, title) {
          var t = title ? ' title="' + title + '"' : "";
          return '<a href="' + href + '"' + t + '>' + label + "</a>";
        });

      // Bare URLs (avoid double-wrapping ones already inside an href attribute).
      // We rely on the simple fact that an existing <a href="..."> wrapper would
      // place the URL immediately after href=" — so we negative-look-behind that.
      s = s.replace(/(^|[\s(])((?:https?|wss?|ftp):\/\/[^\s<>"']+)/g,
        function (m, lead, url) {
          // Trim trailing punctuation that is unlikely to be part of the URL.
          var trail = "";
          while (/[.,;:!?)]$/.test(url)) { trail = url.slice(-1) + trail; url = url.slice(0, -1); }
          return lead + '<a href="' + url + '">' + url + "</a>" + trail;
        });

      // Bold **text** (greedy-safe: non-greedy match, no newlines).
      s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");

      // Italic *text* — single asterisk, not adjacent to another asterisk.
      s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

      out += s;
    }
    return out;
  }

  function isHr(line) {
    return /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  }

  function isAtxHeading(line) {
    return /^\s{0,3}#{1,6}\s+\S/.test(line);
  }

  function parseAtxHeading(line) {
    var m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!m) return null;
    return { level: m[1].length, text: m[2] };
  }

  function isFenceStart(line) {
    return /^\s{0,3}```/.test(line);
  }

  function fenceLang(line) {
    var m = line.match(/^\s{0,3}```\s*([A-Za-z0-9_+\-]*)\s*$/);
    return m ? m[1] : "";
  }

  function isBlockquote(line) {
    return /^\s{0,3}>\s?/.test(line);
  }

  function stripBlockquote(line) {
    return line.replace(/^\s{0,3}>\s?/, "");
  }

  // Lists: capture indent, marker, rest.
  // Indent in *spaces*; tabs are expanded to 4.
  function unorderedMatch(line) {
    var expanded = line.replace(/\t/g, "    ");
    var m = expanded.match(/^(\s*)([-*])\s+(.*)$/);
    if (!m) return null;
    return { indent: m[1].length, ordered: false, marker: m[2], text: m[3] };
  }

  function orderedMatch(line) {
    var expanded = line.replace(/\t/g, "    ");
    var m = expanded.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (!m) return null;
    return { indent: m[1].length, ordered: true, marker: m[2], text: m[3] };
  }

  function listItemMatch(line) {
    return unorderedMatch(line) || orderedMatch(line);
  }

  // Pipe-table detection: a header line with at least one `|`,
  // followed by a separator line of dashes (and optional colons / pipes).
  function isTableSeparator(line) {
    var t = line.trim();
    if (t.indexOf("|") === -1 && t.indexOf("-") === -1) return false;
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(t);
  }

  function splitPipeRow(line) {
    var s = line.trim();
    if (s.charAt(0) === "|") s = s.substring(1);
    if (s.charAt(s.length - 1) === "|") s = s.substring(0, s.length - 1);
    var parts = [];
    var cur = "";
    var esc = false;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (esc) { cur += c; esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === "|") { parts.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    parts.push(cur.trim());
    return parts;
  }

  // ---------- Main parser ----------

  function renderMarkdown(src) {
    if (src == null) return "";
    // Normalise line endings.
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var i = 0;

    function flushParagraph(buf) {
      if (!buf.length) return;
      var joined = buf.join(" ").trim();
      if (joined.length) out.push("<p>" + renderInline(joined) + "</p>");
      buf.length = 0;
    }

    while (i < lines.length) {
      var line = lines[i];

      // Blank line -> paragraph break.
      if (/^\s*$/.test(line)) { i++; continue; }

      // Fenced code block.
      if (isFenceStart(line)) {
        var lang = fenceLang(line);
        i++;
        var codeLines = [];
        while (i < lines.length && !isFenceStart(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // consume closing fence
        var cls = lang ? ' class="lang-' + escapeHtml(lang) + '"' : "";
        out.push("<pre><code" + cls + ">" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
        continue;
      }

      // ATX heading.
      if (isAtxHeading(line)) {
        var h = parseAtxHeading(line);
        if (h) {
          out.push("<h" + h.level + ">" + renderInline(h.text) + "</h" + h.level + ">");
          i++;
          continue;
        }
      }

      // Horizontal rule.
      if (isHr(line)) {
        out.push("<hr>");
        i++;
        continue;
      }

      // Pipe table: current line has `|` AND next line is a separator.
      if (line.indexOf("|") !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        var header = splitPipeRow(line);
        i += 2; // skip header + separator
        var rows = [];
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])
               && !isFenceStart(lines[i]) && !isAtxHeading(lines[i]) && !isHr(lines[i])) {
          rows.push(splitPipeRow(lines[i]));
          i++;
        }
        var html = '<div class="table-wrap"><table><thead><tr>';
        for (var hc = 0; hc < header.length; hc++) {
          html += "<th>" + renderInline(header[hc]) + "</th>";
        }
        html += "</tr></thead><tbody>";
        for (var r = 0; r < rows.length; r++) {
          html += "<tr>";
          for (var c = 0; c < rows[r].length; c++) {
            html += "<td>" + renderInline(rows[r][c]) + "</td>";
          }
          html += "</tr>";
        }
        html += "</tbody></table></div>";
        out.push(html);
        continue;
      }

      // Blockquote.
      if (isBlockquote(line)) {
        var qLines = [];
        while (i < lines.length && isBlockquote(lines[i])) {
          qLines.push(stripBlockquote(lines[i]));
          i++;
        }
        // Render inner content recursively so nested lists / paragraphs work.
        var inner = renderMarkdown(qLines.join("\n"));
        out.push("<blockquote>" + inner + "</blockquote>");
        continue;
      }

      // Lists (unordered or ordered, with nesting via indentation).
      var firstItem = listItemMatch(line);
      if (firstItem) {
        var listResult = parseList(lines, i);
        out.push(listResult.html);
        i = listResult.nextIndex;
        continue;
      }

      // Paragraph: gather contiguous non-blank lines that are not block starters.
      var pBuf = [];
      while (i < lines.length) {
        var pl = lines[i];
        if (/^\s*$/.test(pl)) break;
        if (isAtxHeading(pl)) break;
        if (isHr(pl)) break;
        if (isFenceStart(pl)) break;
        if (isBlockquote(pl)) break;
        if (listItemMatch(pl)) break;
        if (pl.indexOf("|") !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break;
        pBuf.push(pl.trim());
        i++;
      }
      flushParagraph(pBuf);
    }

    return out.join("\n");
  }

  // List parser: handles nested lists by indentation.
  // Returns { html, nextIndex }.
  function parseList(lines, startIdx) {
    var top = listItemMatch(lines[startIdx]);
    var baseIndent = top.indent;
    var ordered = top.ordered;

    var items = []; // each item: { textLines: [..], children: [ {html, idx} ] }
    var i = startIdx;

    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) {
        // Blank line: peek ahead. If next non-blank line is a list item at >= baseIndent
        // with same ordered-ness, continue. Otherwise stop.
        var j = i + 1;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        if (j >= lines.length) { i = j; break; }
        var nextItem = listItemMatch(lines[j]);
        if (!nextItem || nextItem.indent < baseIndent) { break; }
        if (nextItem.indent === baseIndent && nextItem.ordered !== ordered) { break; }
        // Skip the blank lines and continue.
        i = j;
        continue;
      }

      var m = listItemMatch(line);
      if (m && m.indent === baseIndent && m.ordered === ordered) {
        items.push({ textLines: [m.text], childrenHtml: [] });
        i++;
        // Collect continuation lines (indented or nested lists) until we hit
        // a peer item at baseIndent or shallower content.
        while (i < lines.length) {
          var cont = lines[i];
          if (/^\s*$/.test(cont)) {
            // Check peek: do we have a nested item or continuation following?
            var k = i + 1;
            while (k < lines.length && /^\s*$/.test(lines[k])) k++;
            if (k >= lines.length) { i = k; break; }
            var peek = listItemMatch(lines[k]);
            if (peek && peek.indent > baseIndent) {
              // nested list block
              var nested = parseList(lines, k);
              items[items.length - 1].childrenHtml.push(nested.html);
              i = nested.nextIndex;
              continue;
            }
            if (peek && peek.indent === baseIndent && peek.ordered === ordered) {
              i = k;
              break;
            }
            // Otherwise the list ends here.
            i = k;
            return { html: renderList(items, ordered), nextIndex: i };
          }
          var contItem = listItemMatch(cont);
          if (contItem) {
            if (contItem.indent > baseIndent) {
              // Nested list starting on the next line directly.
              var nested2 = parseList(lines, i);
              items[items.length - 1].childrenHtml.push(nested2.html);
              i = nested2.nextIndex;
              continue;
            } else if (contItem.indent === baseIndent && contItem.ordered === ordered) {
              break; // peer item
            } else {
              // Different list at <= baseIndent — end this list.
              return { html: renderList(items, ordered), nextIndex: i };
            }
          }
          // Continuation paragraph text for the current item: must be indented past baseIndent
          // by at least the marker width (we accept any indent > baseIndent).
          var expanded = cont.replace(/\t/g, "    ");
          var contIndentMatch = expanded.match(/^(\s*)(.*)$/);
          var contIndent = contIndentMatch[1].length;
          if (contIndent > baseIndent) {
            items[items.length - 1].textLines.push(contIndentMatch[2]);
            i++;
            continue;
          }
          // Not indented — end the list.
          return { html: renderList(items, ordered), nextIndex: i };
        }
      } else {
        break;
      }
    }

    return { html: renderList(items, ordered), nextIndex: i };
  }

  function renderList(items, ordered) {
    var tag = ordered ? "ol" : "ul";
    var html = "<" + tag + ">";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var text = it.textLines.join(" ").trim();
      html += "<li>" + renderInline(text);
      for (var c = 0; c < it.childrenHtml.length; c++) {
        html += it.childrenHtml[c];
      }
      html += "</li>";
    }
    html += "</" + tag + ">";
    return html;
  }

  global.renderMarkdown = renderMarkdown;
})(typeof window !== "undefined" ? window : this);
