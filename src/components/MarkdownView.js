import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

// ─── Inline parser ────────────────────────────────────────────────────────────
// Returns [{text, bold, italic}] for a single line of text
function parseInline(raw) {
  if (!raw) return [];
  const parts = [];
  // Order: bold+italic first, then bold, then italic
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/gs;
  let last = 0, m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) parts.push({ text: raw.slice(last, m.index) });
    if (m[2]) parts.push({ text: m[2], bold: true, italic: true });
    else if (m[3]) parts.push({ text: m[3], bold: true });
    else if (m[4]) parts.push({ text: m[4], italic: true });
    else if (m[5]) parts.push({ text: m[5], italic: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length) parts.push({ text: raw.slice(last) });
  return parts;
}

// ─── Block parser ─────────────────────────────────────────────────────────────
// Returns [{type, ...}] blocks from a full markdown string
export function parseBlocks(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings — check longest prefix first to avoid partial match
    const h3 = line.match(/^### (.+)/);
    const h2 = !h3 && line.match(/^## (.+)/);
    const h1 = !h2 && !h3 && line.match(/^# (.+)/);

    if (h3) { blocks.push({ type: 'h3', text: h3[1] }); i++; continue; }
    if (h2) { blocks.push({ type: 'h2', text: h2[1] }); i++; continue; }
    if (h1) { blocks.push({ type: 'h1', text: h1[1] }); i++; continue; }

    // Bullet list — collect consecutive `-` or `*` lines
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'bullet', items });
      continue;
    }

    // Numbered list — collect consecutive `\d+. ` lines
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      blocks.push({ type: 'numbered', items });
      continue;
    }

    // Empty line — skip (paragraph break handled implicitly)
    if (line.trim() === '') { i++; continue; }

    // Paragraph
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

// ─── Inline renderer ──────────────────────────────────────────────────────────
function InlineText({ raw, baseStyle }) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const parts = parseInline(raw);
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) => (
        <Text
          key={i}
          style={[
            p.bold && s.bold,
            p.italic && s.italic,
          ]}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MarkdownView({ content, compact = false }) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  if (!content) return null;
  const blocks = parseBlocks(content);
  if (!blocks.length) return null;

  return (
    <View style={[s.container, compact && s.compact]}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h1':
            return <Text key={i} style={s.h1}>{block.text}</Text>;
          case 'h2':
            return <Text key={i} style={s.h2}>{block.text}</Text>;
          case 'h3':
            return <Text key={i} style={s.h3}>{block.text}</Text>;

          case 'paragraph':
            return <InlineText key={i} raw={block.text} baseStyle={s.paragraph} />;

          case 'bullet':
            return (
              <View key={i} style={s.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={s.listRow}>
                    <Text style={s.bullet}>•</Text>
                    <InlineText raw={item} baseStyle={[s.paragraph, s.listText]} />
                  </View>
                ))}
              </View>
            );

          case 'numbered':
            return (
              <View key={i} style={s.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={s.listRow}>
                    <Text style={s.numeral}>{j + 1}.</Text>
                    <InlineText raw={item} baseStyle={[s.paragraph, s.listText]} />
                  </View>
                ))}
              </View>
            );

          default:
            return null;
        }
      })}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { gap: 7 },
  compact: { gap: 4 },

  // Text styles
  h1: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: -0.6, lineHeight: 28, marginBottom: 2 },
  h2: { fontSize: 18, fontWeight: '700', color: colors.primary, letterSpacing: -0.3, lineHeight: 24, marginBottom: 1 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.primary, letterSpacing: -0.1, lineHeight: 22 },
  paragraph: { fontSize: 15, color: colors.primary, lineHeight: 23, letterSpacing: -0.1 },
  bold: { fontWeight: '700', color: colors.primary },
  italic: { fontStyle: 'italic', color: colors.primary },

  // Lists
  list: { gap: 3 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  bullet: { fontSize: 15, color: colors.secondary, lineHeight: 23, width: 14, textAlign: 'center' },
  numeral: { fontSize: 14, color: colors.secondary, lineHeight: 23, minWidth: 22, fontWeight: '600' },
  listText: { flex: 1 },
});
