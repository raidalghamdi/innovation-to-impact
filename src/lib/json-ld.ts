// Serialize a JSON-LD object for safe embedding inside a
// <script type="application/ld+json" dangerouslySetInnerHTML> tag.
//
// JSON.stringify does NOT escape `<`, so a user-controlled string value
// containing `</script>` (e.g. an idea title surfaced in a breadcrumb) could
// close the script element and inject markup. Escaping `<`, `>`, `&` and the
// JS line separators U+2028/U+2029 as unicode escapes keeps the output valid
// JSON while making a `</script>` breakout impossible.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
