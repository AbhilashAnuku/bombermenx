/* Tiny, dependency-free markdown renderer.
 * Supports: headings, paragraphs, lists, blockquotes, fenced code (incl. ```mermaid),
 * tables, inline code, links, bold/italic, horizontal rules, line breaks.
 * Output is sanitized by escaping HTML in source text before re-applying inline rules. */

(function (global) {
  "use strict";

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
  }

  function inline(text) {
    // bold **x**, italic *x* or _x_, inline code `x`, link [text](url)
    var out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, function (m, c) { return "<code>" + c + "</code>"; });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return out;
  }

  function renderMarkdown(src) {
    if (typeof src !== "string") return "";
    var lines = src.replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var i = 0;

    function flushParagraph(buf) {
      if (buf.length) {
        out.push("<p>" + inline(buf.join(" ")) + "</p>");
        buf.length = 0;
      }
    }

    var paraBuf = [];
    while (i < lines.length) {
      var line = lines[i];

      // fenced code
      var fence = /^```\s*([\w-]*)\s*$/.exec(line);
      if (fence) {
        flushParagraph(paraBuf);
        var lang = (fence[1] || "").toLowerCase();
        var codeLines = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        if (lang === "mermaid") {
          out.push('<pre class="mermaid">' + escapeHtml(codeLines.join("\n")) + "</pre>");
        } else {
          out.push('<pre><code class="lang-' + escapeHtml(lang) + '">' +
                   escapeHtml(codeLines.join("\n")) + "</code></pre>");
        }
        i++; // skip closing fence
        continue;
      }

      // horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushParagraph(paraBuf);
        out.push("<hr/>");
        i++; continue;
      }

      // heading
      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        flushParagraph(paraBuf);
        out.push("<h" + h[1].length + ">" + inline(h[2]) + "</h" + h[1].length + ">");
        i++; continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        flushParagraph(paraBuf);
        var qb = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          qb.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        out.push("<blockquote>" + inline(qb.join(" ")) + "</blockquote>");
        continue;
      }

      // table — detect a header row followed by separator
      if (/^\|.+\|\s*$/.test(line) && /^\|[\s\-:|]+\|\s*$/.test(lines[i + 1] || "")) {
        flushParagraph(paraBuf);
        var header = line.trim().slice(1, -1).split("|").map(function (s) { return s.trim(); });
        i += 2;
        var rows = [];
        while (i < lines.length && /^\|.+\|\s*$/.test(lines[i])) {
          rows.push(lines[i].trim().slice(1, -1).split("|").map(function (s) { return s.trim(); }));
          i++;
        }
        var tab = "<table><thead><tr>";
        header.forEach(function (c) { tab += "<th>" + inline(c) + "</th>"; });
        tab += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          tab += "<tr>";
          r.forEach(function (c) { tab += "<td>" + inline(c) + "</td>"; });
          tab += "</tr>";
        });
        tab += "</tbody></table>";
        out.push(tab);
        continue;
      }

      // unordered list
      if (/^\s*[-*]\s+/.test(line)) {
        flushParagraph(paraBuf);
        out.push("<ul>");
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          out.push("<li>" + inline(lines[i].replace(/^\s*[-*]\s+/, "")) + "</li>");
          i++;
        }
        out.push("</ul>");
        continue;
      }

      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        flushParagraph(paraBuf);
        out.push("<ol>");
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          out.push("<li>" + inline(lines[i].replace(/^\s*\d+\.\s+/, "")) + "</li>");
          i++;
        }
        out.push("</ol>");
        continue;
      }

      // blank line — flush paragraph
      if (/^\s*$/.test(line)) {
        flushParagraph(paraBuf);
        i++; continue;
      }

      // accumulate paragraph
      paraBuf.push(line);
      i++;
    }
    flushParagraph(paraBuf);
    return out.join("\n");
  }

  global.renderMarkdown = renderMarkdown;
})(window);
