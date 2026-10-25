/**
 * Country calling codes (ITU E.164 country prefixes).
 *
 * Data model: [ISO 3166-1 alpha-2, display name, dial code as a digit string
 * without '+' and without spaces]. NANP countries (country code 1) store the
 * full prefix including their area code (e.g. '1242' Bahamas) so that a
 * longest-prefix lookup can resolve them precisely.
 *
 * Kept deliberately compact: one tuple per line, parsed once at import.
 */

const RAW = [
  ['AF', 'Afghanistan', '93'],
  ['AL', 'Albania', '355'],
  ['DZ', 'Algeria', '213'],
  ['AD', 'Andorra', '376'],
  ['AO', 'Angola', '244'],
  ['AI', 'Anguilla', '1264'],
  ['AG', 'Antigua & Barbuda', '1268'],
  ['AR', 'Argentina', '54'],
  ['AM', 'Armenia', '374'],
  ['AU', 'Australia', '61'],
  ['AT', 'Austria', '43'],
  ['AZ', 'Azerbaijan', '994'],
  ['BS', 'Bahamas', '1242'],
  ['BH', 'Bahrain', '973'],
  ['BD', 'Bangladesh', '880'],
  ['BB', 'Barbados', '1246'],
  ['BY', 'Belarus', '375'],
  ['BE', 'Belgium', '32'],
  ['BZ', 'Belize', '501'],
  ['BJ', 'Benin', '229'],
  ['BM', 'Bermuda', '1441'],
  ['BT', 'Bhutan', '975'],
  ['BO', 'Bolivia', '591'],
  ['BA', 'Bosnia & Herzegovina', '387'],
  ['BW', 'Botswana', '267'],
  ['BR', 'Brazil', '55'],
  ['BN', 'Brunei', '673'],
  ['BG', 'Bulgaria', '359'],
  ['BF', 'Burkina Faso', '226'],
  ['BI', 'Burundi', '257'],
  ['KH', 'Cambodia', '855'],
  ['CM', 'Cameroon', '237'],
  ['CA', 'Canada', '1'],
  ['CV', 'Cape Verde', '238'],
  ['KY', 'Cayman Islands', '1345'],
  ['CF', 'Central African Republic', '236'],
  ['TD', 'Chad', '235'],
  ['CL', 'Chile', '56'],
  ['CN', 'China', '86'],
  ['CO', 'Colombia', '57'],
  ['KM', 'Comoros', '269'],
  ['CG', 'Congo', '242'],
  ['CD', 'DR Congo', '243'],
  ['CK', 'Cook Islands', '682'],
  ['CR', 'Costa Rica', '506'],
  ['CI', "Côte d'Ivoire", '225'],
  ['HR', 'Croatia', '385'],
  ['CU', 'Cuba', '53'],
  ['CW', 'Curaçao', '599'],
  ['CY', 'Cyprus', '357'],
  ['CZ', 'Czechia', '420'],
  ['DK', 'Denmark', '45'],
  ['DJ', 'Djibouti', '253'],
  ['DM', 'Dominica', '1767'],
  ['DO', 'Dominican Republic', '1809'],
  ['EC', 'Ecuador', '593'],
  ['EG', 'Egypt', '20'],
  ['SV', 'El Salvador', '503'],
  ['GQ', 'Equatorial Guinea', '240'],
  ['ER', 'Eritrea', '291'],
  ['EE', 'Estonia', '372'],
  ['SZ', 'Eswatini', '268'],
  ['ET', 'Ethiopia', '251'],
  ['FK', 'Falkland Islands', '500'],
  ['FJ', 'Fiji', '679'],
  ['FI', 'Finland', '358'],
  ['FR', 'France', '33'],
  ['GF', 'French Guiana', '594'],
  ['PF', 'French Polynesia', '689'],
  ['GA', 'Gabon', '241'],
  ['GM', 'Gambia', '220'],
  ['GE', 'Georgia', '995'],
  ['DE', 'Germany', '49'],
  ['GH', 'Ghana', '233'],
  ['GI', 'Gibraltar', '350'],
  ['GR', 'Greece', '30'],
  ['GL', 'Greenland', '299'],
  ['GD', 'Grenada', '1473'],
  ['GP', 'Guadeloupe', '590'],
  ['GU', 'Guam', '1671'],
  ['GT', 'Guatemala', '502'],
  ['GN', 'Guinea', '224'],
  ['GW', 'Guinea-Bissau', '245'],
  ['GY', 'Guyana', '592'],
  ['HT', 'Haiti', '509'],
  ['HN', 'Honduras', '504'],
  ['HK', 'Hong Kong', '852'],
  ['HU', 'Hungary', '36'],
  ['IS', 'Iceland', '354'],
  ['IN', 'India', '91'],
  ['ID', 'Indonesia', '62'],
  ['IR', 'Iran', '98'],
  ['IQ', 'Iraq', '964'],
  ['IE', 'Ireland', '353'],
  ['IL', 'Israel', '972'],
  ['IT', 'Italy', '39'],
  ['JM', 'Jamaica', '1876'],
  ['JP', 'Japan', '81'],
  ['JO', 'Jordan', '962'],
  ['KZ', 'Kazakhstan', '7'],
  ['KE', 'Kenya', '254'],
  ['KI', 'Kiribati', '686'],
  ['XK', 'Kosovo', '383'],
  ['KW', 'Kuwait', '965'],
  ['KG', 'Kyrgyzstan', '996'],
  ['LA', 'Laos', '856'],
  ['LV', 'Latvia', '371'],
  ['LB', 'Lebanon', '961'],
  ['LS', 'Lesotho', '266'],
  ['LR', 'Liberia', '231'],
  ['LY', 'Libya', '218'],
  ['LI', 'Liechtenstein', '423'],
  ['LT', 'Lithuania', '370'],
  ['LU', 'Luxembourg', '352'],
  ['MO', 'Macau', '853'],
  ['MG', 'Madagascar', '261'],
  ['MW', 'Malawi', '265'],
  ['MY', 'Malaysia', '60'],
  ['MV', 'Maldives', '960'],
  ['ML', 'Mali', '223'],
  ['MT', 'Malta', '356'],
  ['MH', 'Marshall Islands', '692'],
  ['MQ', 'Martinique', '596'],
  ['MR', 'Mauritania', '222'],
  ['MU', 'Mauritius', '230'],
  ['YT', 'Mayotte', '262'],
  ['MX', 'Mexico', '52'],
  ['FM', 'Micronesia', '691'],
  ['MD', 'Moldova', '373'],
  ['MC', 'Monaco', '377'],
  ['MN', 'Mongolia', '976'],
  ['ME', 'Montenegro', '382'],
  ['MS', 'Montserrat', '1664'],
  ['MA', 'Morocco', '212'],
  ['MZ', 'Mozambique', '258'],
  ['MM', 'Myanmar', '95'],
  ['NA', 'Namibia', '264'],
  ['NR', 'Nauru', '674'],
  ['NP', 'Nepal', '977'],
  ['NL', 'Netherlands', '31'],
  ['NC', 'New Caledonia', '687'],
  ['NZ', 'New Zealand', '64'],
  ['NI', 'Nicaragua', '505'],
  ['NE', 'Niger', '227'],
  ['NG', 'Nigeria', '234'],
  ['NU', 'Niue', '683'],
  ['NF', 'Norfolk Island', '672'],
  ['MK', 'North Macedonia', '389'],
  ['NO', 'Norway', '47'],
  ['OM', 'Oman', '968'],
  ['PK', 'Pakistan', '92'],
  ['PW', 'Palau', '680'],
  ['PS', 'Palestine', '970'],
  ['PA', 'Panama', '507'],
  ['PG', 'Papua New Guinea', '675'],
  ['PY', 'Paraguay', '595'],
  ['PE', 'Peru', '51'],
  ['PH', 'Philippines', '63'],
  ['PL', 'Poland', '48'],
  ['PT', 'Portugal', '351'],
  ['PR', 'Puerto Rico', '1787'],
  ['QA', 'Qatar', '974'],
  ['RE', 'Réunion', '262'],
  ['RO', 'Romania', '40'],
  ['RU', 'Russia', '7'],
  ['RW', 'Rwanda', '250'],
  ['BL', 'St Barthélemy', '590'],
  ['SH', 'St Helena', '290'],
  ['KN', 'St Kitts & Nevis', '1869'],
  ['LC', 'St Lucia', '1758'],
  ['MF', 'St Martin', '590'],
  ['PM', 'St Pierre & Miquelon', '508'],
  ['VC', 'St Vincent & Grenadines', '1784'],
  ['WS', 'Samoa', '685'],
  ['SM', 'San Marino', '378'],
  ['ST', 'São Tomé & Príncipe', '239'],
  ['SA', 'Saudi Arabia', '966'],
  ['SN', 'Senegal', '221'],
  ['RS', 'Serbia', '381'],
  ['SC', 'Seychelles', '248'],
  ['SL', 'Sierra Leone', '232'],
  ['SG', 'Singapore', '65'],
  ['SX', 'Sint Maarten', '1721'],
  ['SK', 'Slovakia', '421'],
  ['SI', 'Slovenia', '386'],
  ['SB', 'Solomon Islands', '677'],
  ['SO', 'Somalia', '252'],
  ['ZA', 'South Africa', '27'],
  ['KR', 'South Korea', '82'],
  ['SS', 'South Sudan', '211'],
  ['ES', 'Spain', '34'],
  ['LK', 'Sri Lanka', '94'],
  ['SD', 'Sudan', '249'],
  ['SR', 'Suriname', '597'],
  ['SE', 'Sweden', '46'],
  ['CH', 'Switzerland', '41'],
  ['SY', 'Syria', '963'],
  ['TW', 'Taiwan', '886'],
  ['TJ', 'Tajikistan', '992'],
  ['TZ', 'Tanzania', '255'],
  ['TH', 'Thailand', '66'],
  ['TL', 'Timor-Leste', '670'],
  ['TG', 'Togo', '228'],
  ['TK', 'Tokelau', '690'],
  ['TO', 'Tonga', '676'],
  ['TT', 'Trinidad & Tobago', '1868'],
  ['TN', 'Tunisia', '216'],
  ['TR', 'Türkiye', '90'],
  ['TM', 'Turkmenistan', '993'],
  ['TC', 'Turks & Caicos', '1649'],
  ['TV', 'Tuvalu', '688'],
  ['UG', 'Uganda', '256'],
  ['UA', 'Ukraine', '380'],
  ['AE', 'United Arab Emirates', '971'],
  ['GB', 'United Kingdom', '44'],
  ['US', 'United States', '1'],
  ['UY', 'Uruguay', '598'],
  ['UZ', 'Uzbekistan', '998'],
  ['VU', 'Vanuatu', '678'],
  ['VA', 'Vatican City', '379'],
  ['VE', 'Venezuela', '58'],
  ['VN', 'Vietnam', '84'],
  ['VG', 'British Virgin Islands', '1284'],
  ['VI', 'U.S. Virgin Islands', '1340'],
  ['WF', 'Wallis & Futuna', '681'],
  ['EH', 'Western Sahara', '212'],
  ['YE', 'Yemen', '967'],
  ['ZM', 'Zambia', '260'],
  ['ZW', 'Zimbabwe', '263'],
];

/** @typedef {{iso: string, name: string, dial: string}} Country */

/** @type {Country[]} */
export const COUNTRIES = RAW.map(([iso, name, dial]) => ({ iso, name, dial }));

/** All dial codes sorted longest-first for longest-prefix matching. */
const DIAL_INDEX = [...new Set(COUNTRIES.map((c) => c.dial))].sort(
  (a, b) => b.length - a.length,
);

/**
 * Emoji flag for an ISO alpha-2 code, built from regional indicator pairs.
 * @param {string} iso
 */
export function flagOf(iso) {
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

/** @param {string} iso */
export function countryByIso(iso) {
  return COUNTRIES.find((c) => c.iso === iso) ?? null;
}

/** Countries sharing a dial code (usually one, sometimes several). */
export function countriesByDial(dial) {
  return COUNTRIES.filter((c) => c.dial === String(dial).replace(/\D/g, ''));
}

/**
 * Ambiguous shared dial codes resolve to their dominant country
 * (1 → US rather than Canada, 7 → Russia rather than Kazakhstan).
 * @param {string} dial
 */
export function primaryCountryForDial(dial) {
  const PREFERRED = { '1': 'US', '7': 'RU' };
  const d = String(dial).replace(/\D/g, '');
  const preferred = PREFERRED[d] && countryByIso(PREFERRED[d]);
  if (preferred?.dial === d) return preferred;
  return countriesByDial(d)[0] ?? null;
}

/**
 * Longest-prefix match of a digit string against known dial codes.
 * @param {string} digits digit-only string, may start with the country code
 * @returns {string|null} the matched dial code, or null
 */
export function matchDialCode(digits) {
  return DIAL_INDEX.find((d) => digits.startsWith(d) && digits.length > d.length) ?? null;
}
