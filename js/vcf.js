/**
 * vCard (.vcf) contact import — client-side only, no network.
 * Handles folded (continuation) lines, multiple cards, TEL variants and
 * escaped separators. Anything that isn't a phone number is ignored.
 */

/**
 * @param {string} text raw .vcf file contents
 * @returns {Array<{name: string, number: string}>} number in E.164-ish
 *          digits with a leading '+'
 */
export function parseVcf(text) {
  const out = [];
  if (typeof text !== 'string' || !/BEGIN:VCARD/i.test(text)) return out;

  // Unfold: lines starting with space/tab continue the previous line.
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');

  let name = '';
  let number = '';
  const flush = () => {
    const digits = number.replace(/[^\d+]/g, '');
    if (/^\+\d{7,15}$/.test(digits)) {
      out.push({ name: name.trim().slice(0, 60), number: digits });
    }
    name = '';
    number = '';
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^BEGIN:VCARD/i.test(line)) {
      name = '';
      number = '';
      continue;
    }
    if (/^END:VCARD/i.test(line)) {
      flush();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).toUpperCase();
    const value = line
      .slice(colon + 1)
      .replace(/\\n/gi, ' ')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .trim();

    if (key.startsWith('TEL') && !number) {
      number = value;
    } else if (key === 'FN' && !name) {
      name = value;
    } else if (key === 'N' && !name) {
      // "Family;Given;;;" — prefer "Given Family"
      const parts = value.split(';');
      name = [parts[1], parts[0]].filter(Boolean).join(' ');
    }
  }
  flush();
  return out;
}
