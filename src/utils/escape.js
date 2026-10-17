const XML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(input) {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/[&<>"']/g, (ch) => XML_ENTITIES[ch]);
}

export function escapeAttr(input) {
  return escapeXml(input);
}
