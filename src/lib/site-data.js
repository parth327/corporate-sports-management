/**
 * Single source of truth for the Corporate Sports Events Management portal.
 *
 * DEMO DATA. The company, people, venues, fixtures and standings below are all
 * fictional placeholders so the application can be shown to any prospective
 * client. Swap COMPANY and the copy blocks for a real customer's details and
 * the whole portal re-brands itself.
 *
 * Adding an event to EVENTS and a row to SCHEDULE is enough to make it appear
 * in the grid, the calendar, the ticker and the hero countdown.
 *
 * Season runs October 2026 -> March 2027.
 */

export const COMPANY = {
  short: 'ACE',
  name: 'Apex Corporate Enterprises',
  portal: 'Corporate Sports Events Management',
  league: 'The Colour League',
  season: 'Season 2026–27',
  tagline: 'Playing Together to Win',
  founded: 2001,
  city: 'Riverton',
  makes: 'enterprise services and solutions',
  countries: 40,
  address: '100 Corporate Avenue, Riverton 400001',
  /* The corporate switchboard. Kept distinct from FOOTER.contact below, which
     is the portal's own event-desk line. */
  phone: ['+1 555 010 0100', '+1 555 010 0101'],
  email: 'info@example.com',
  founder: 'A. R. Sterling',
  secondGeneration: 'J. Sterling',
};

/* ------------------------------------------------------------------ *
 * THE A-C-E VALUES. The sports reinterpretation lives in PILLARS below;
 * this is the source text it is interpreting.
 * ------------------------------------------------------------------ */
export const VALUES_COPY = {
  eyebrow: 'Our foundation · Company values',
  title: 'WHAT A-C-E ACTUALLY STANDS FOR',
  body: 'Before it named a league, ACE was three letters the company wrote into its own charter. Sample values shown for demonstration.',
};

export const VALUES = [
  {
    letter: 'A',
    quote: 'Aspire to Excellence with Honesty and Respect in Everything We Do',
    accent: 'magenta',
  },
  {
    letter: 'C',
    quote: 'Collaborate Across Teams and Continuously Improve',
    accent: 'azure',
  },
  {
    letter: 'E',
    quote: 'Empower People to Innovate, Lead and Win Together',
    accent: 'solar',
  },
];

export const VISION_MISSION = {
  vision: 'Be the benchmark for our industry and the partner of choice for integrity, innovation and performance',
  mission:
    'Build lasting client relationships by delivering exceptional stakeholder value in an environment of trust, respect and equality',
};

/* ------------------------------------------------------------------ *
 * ABOUT — the company description, growth statement and origin story.
 * ------------------------------------------------------------------ */
export const ABOUT_COPY = {
  eyebrow: 'About the company · Sample profile',
  title: 'THE COMPANY THE LEAGUE IS BUILT AROUND',
  intro:
    'Apex Corporate Enterprises (ACE) is a leading provider of enterprise services and solutions, serving clients across a wide range of industries with a focus on quality, reliability and long-term partnership.',
  origin:
    '2001 marked a pivotal year in the history of ACE. A small team with a big idea opened its first office, and quickly grew into a company trusted by clients across the region.',
  growth:
    'Through an expanding service portfolio, disciplined delivery practices, a long-term commitment to consistent quality and the adoption of the latest technology and processes, ACE has grown into a company proud of its people and its lineage.',
  transformation:
    'In 2010, ACE underwent a transformation driven by new ideas and innovation initiated by the next generation of leadership.',
  leadership:
    'Under a new generation of leadership, the team refined its teamwork and delivery processes to meet global demands.',
  reach: 'Already satisfying prestigious customers in more than 40 countries.',
};

/* ------------------------------------------------------------------ *
 * INDUSTRIES SERVED
 * ------------------------------------------------------------------ */
export const INDUSTRIES_COPY = {
  eyebrow: 'Industries · Sample list',
  title: 'TWENTY INDUSTRIES, ONE TEAM',
  body: 'The same people who compete in the league also serve every one of these industries — a sample list for demonstration.',
};

export const INDUSTRIES = [
  'Automotive',
  'Agriculture',
  'Banking & Finance',
  'Construction',
  'Consumer Goods',
  'Education',
  'Energy & Utilities',
  'Healthcare',
  'Hospitality',
  'Insurance',
  'Logistics',
  'Manufacturing',
  'Media & Entertainment',
  'Mining & Metals',
  'Pharmaceuticals',
  'Real Estate',
  'Retail',
  'Technology',
  'Telecommunications',
  'Travel & Tourism',
];

/* ------------------------------------------------------------------ *
 * ACCENT SYSTEM
 *
 * The WebGL lighting rig reads `hex` and retints the entire backdrop as you
 * scroll, so these values drive far more than CSS.
 * ------------------------------------------------------------------ */
/* `text` is for type over the night backdrop (dark in both themes); `panel` is for type on cards,
   which turn light in the light theme and need the darker, theme-aware tier. */
export const ACCENTS = {
  magenta: { hex: '#C72D86', text: 'text-magenta-300', panel: 'text-accent-magenta', border: 'border-magenta-500/40', bg: 'bg-magenta-500' },
  azure: { hex: '#2475B7', text: 'text-azure-400', panel: 'text-accent-azure', border: 'border-azure-500/40', bg: 'bg-azure-500' },
  solar: { hex: '#FFCB00', text: 'text-solar-400', panel: 'text-accent-solar', border: 'border-solar-500/40', bg: 'bg-solar-500' },
  phthalo: { hex: '#00A170', text: 'text-phthalo-400', panel: 'text-accent-phthalo', border: 'border-phthalo-500/40', bg: 'bg-phthalo-500' },
};

/* ------------------------------------------------------------------ *
 * HERO
 * ------------------------------------------------------------------ */
export const HERO = {
  eyebrow: 'Apex Corporate Enterprises · Riverton · Since 2001',
  /* The corporate tagline, broken for display. Word index 1 takes the accent. */
  titleLines: ['PLAYING', 'TOGETHER', 'TO WIN'],
  season: 'Corporate Sports Events Management · Annual Events · Season 2026–27',
  lede: 'Twenty-six years of building together, and one season a year where the divisions that power the company compete for a single trophy. Cricket under lights, football on turf, and the Cultural Fest — three days where the office stops being corporate.',
  stats: [
    { k: 'Years', v: 26, suffix: '' },
    { k: 'Countries served', v: 40, suffix: '+' },
    { k: 'Divisions', v: 8, suffix: '' },
    { k: 'Events', v: 14, suffix: '' },
  ],
};

/* ------------------------------------------------------------------ *
 * EVENT VERTICALS
 * ------------------------------------------------------------------ */
export const CATEGORIES = [
  { id: 'all', label: 'All Events' },
  { id: 'sports', label: 'Sports' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'corporate', label: 'Corporate' },
];

export const EVENTS = [
  {
    id: 'cpl',
    code: '01',
    name: 'Corporate Premier League',
    kicker: 'Inter-Division Cricket',
    category: 'sports',
    accent: 'magenta',
    image: '/images/cricket-stumps.jpg',
    window: '10 Oct – 22 Nov 2026',
    venue: 'Main Sports Ground, Riverton',
    format: 'T20 · 8 divisions · Double round-robin',
    teams: 8,
    participants: 176,
    summary:
      'The flagship. Eight divisional squads, six weeks of floodlit cricket, and a trophy that has not left the Operations cabinet in three seasons.',
    highlights: [
      'Sixteen-over format with a mandatory two-over spell from a colleague with under two years of service.',
      'Every squad fields a minimum of three women players across the eleven.',
      'Live scoring on the portal, with ball-by-ball updates pushed to division groups.',
      'Semi-finals and the final played under lights, open to families.',
    ],
  },
  {
    id: 'football',
    code: '02',
    name: 'Corporate Football Cup',
    kicker: 'Seven-a-side Championship',
    category: 'sports',
    accent: 'phthalo',
    image: '/images/football-sunlit.jpg',
    window: '07 Nov – 30 Nov 2026',
    venue: 'Turf Arena, Riverton',
    format: '7-a-side · 12 teams · Group + knockout',
    teams: 12,
    participants: 144,
    summary:
      'Twelve squads on synthetic turf under evening floodlights. Fast, forty-minute fixtures built to fit around a shift pattern.',
    highlights: [
      'Two twenty-minute halves with rolling substitutions, so nobody sits out a whole match.',
      'Mixed-grade squads: every team carries at least four colleagues from across the company.',
      'Group stage on weekday evenings, knockouts across a single Saturday festival day.',
      'Golden Boot and Golden Glove presented at the closing gala.',
    ],
  },
  {
    id: 'cultural',
    code: '03',
    name: 'Cultural Fest',
    kicker: 'The Festival of Creation',
    category: 'cultural',
    accent: 'magenta',
    image: null,
    window: '05 Dec – 07 Dec 2026',
    venue: 'Grand Convention Hall, Riverton',
    format: '3 days · 9 disciplines · Open entry',
    teams: 8,
    participants: 620,
    summary:
      'The Cultural Fest is three days where a company hands the stage back to its people: music, dance, drama, photography, fine art, poetry, film, craft and culinary.',
    highlights: [
      'Nine competitive disciplines plus an open showcase for first-time performers.',
      'Division group performances on night two, individual finals on night three.',
      'An art exhibition of employee work, staged in the foyer across all three days.',
      'Family entries welcome in the art, craft and culinary categories.',
    ],
  },
  {
    id: 'indoor',
    code: '04',
    name: 'Indoor Arena',
    kicker: 'Chess · Carrom · TT · Badminton',
    category: 'sports',
    accent: 'azure',
    image: '/images/stadium-illustrated.jpg',
    window: '21 Nov – 19 Dec 2026',
    venue: 'Recreation Hall, Corporate Avenue',
    format: '4 disciplines · Singles & doubles',
    teams: 8,
    participants: 240,
    summary:
      'The long league. Four disciplines played out over a month of lunch hours and evenings, with ladder standings updated on the portal every Friday.',
    highlights: [
      'Swiss-system chess across five rounds with live board broadcasts.',
      'Badminton and table tennis run as singles, doubles and mixed doubles draws.',
      'Carrom doubles pairs must be drawn from two different divisions.',
      'All finals played on a single Indoor Finals Day, 19 December.',
    ],
  },
  {
    id: 'run',
    code: '05',
    name: 'Corporate Run',
    kicker: '10K · 5K · Family 3K',
    category: 'wellness',
    accent: 'phthalo',
    image: '/images/football-goalline.jpg',
    window: '18 Oct 2026',
    venue: 'Riverside Park, Riverton',
    format: 'Timed 10K · 5K · Untimed family 3K',
    teams: 8,
    participants: 980,
    summary:
      'One morning by the river, three distances, and the largest single gathering of the company calendar. Chip-timed, medically supported, open to families.',
    highlights: [
      'Chip timing and certified route marshals across all three distances.',
      'Division participation trophy awarded on turnout percentage, not finishing time.',
      'On-route hydration, physiotherapy tents and a full medical response team.',
      'Every finisher receives a medal; the family 3K is deliberately untimed.',
    ],
  },
  {
    id: 'safety',
    code: '06',
    name: 'Safety & Sustainability Week',
    kicker: 'Workplace Safety · EHS · Compliance',
    category: 'corporate',
    accent: 'azure',
    image: '/images/stadium-day.jpg',
    window: '12 Jan – 16 Jan 2027',
    venue: 'North & South campuses, and HQ',
    format: '5 days · Company-wide · Cross-functional',
    teams: 8,
    participants: 1400,
    summary:
      'The week the arena moves onto the shop floor. Emergency drills, near-miss reporting drives, and a cross-division innovation challenge judged by the leadership council.',
    highlights: [
      'Live emergency response drills at both campuses, scored by external assessors.',
      'Innovation challenge: teams pitch safety or sustainability improvements to the board.',
      'Zero-incident streak recognition for shifts and contractors alike.',
      'The winning innovation receives a funded pilot in the following quarter.',
    ],
  },
  {
    id: 'familyday',
    code: '07',
    name: 'Family Day Carnival',
    kicker: 'For everyone who waits at home',
    category: 'corporate',
    accent: 'solar',
    image: '/images/stadium-illustrated.jpg',
    window: '13 Feb 2027',
    venue: 'Main Sports Ground, Riverton',
    format: 'Full day · Open to all families',
    teams: 8,
    participants: 3100,
    summary:
      'A full day handed over to the families. Carnival games, a food street, a children’s talent stage, and the tug-of-war that Engineering has now won four years running.',
    highlights: [
      'Children’s sports track for ages four to fourteen, with medals for every entrant.',
      'Food street curated by the culinary winners from the Cultural Fest.',
      'Inter-division tug-of-war, the single best-attended fixture of the season.',
      'Long-service recognition at ten, twenty and thirty years.',
    ],
  },
  {
    id: 'awards',
    code: '08',
    name: 'Annual Awards Night',
    kicker: 'Closing Gala & The Spectrum Trophy',
    category: 'corporate',
    accent: 'solar',
    image: '/images/trophy-lights.jpg',
    window: '06 Mar 2027',
    venue: 'Grand Convention Hall, Riverton',
    format: 'Evening gala · Winners & invitation',
    teams: 8,
    participants: 900,
    summary:
      'The season closes where it should: under lights, with the Spectrum Trophy going to whichever division has accumulated the most points across every single event.',
    highlights: [
      'The Spectrum Trophy, awarded on the combined Colour League points table.',
      'Individual honours: Player of the Season, Performer of the Season, Safety Champion.',
      'Long-service and retirement felicitations.',
      'Season highlight film premiered before the final presentation.',
    ],
  },
];

/* ------------------------------------------------------------------ *
 * SCHEDULE — drives the calendar section AND the hero countdown.
 * ------------------------------------------------------------------ */
export const SCHEDULE = [
  { id: 's1', date: '2026-10-02', display: '02 Oct', month: 'October 2026', title: 'Season Opening & Colour Ceremony', eventId: 'awards', category: 'corporate', venue: 'Head Office, Corporate Avenue', time: '17:30', status: 'upcoming' },
  { id: 's2', date: '2026-10-10', display: '10 Oct', month: 'October 2026', title: 'Premier League — Opening Fixture', eventId: 'cpl', category: 'sports', venue: 'Main Sports Ground', time: '18:00', status: 'upcoming' },
  { id: 's3', date: '2026-10-18', display: '18 Oct', month: 'October 2026', title: 'Corporate Run — 10K, 5K & Family 3K', eventId: 'run', category: 'wellness', venue: 'Riverside Park', time: '06:00', status: 'upcoming' },
  { id: 's4', date: '2026-11-07', display: '07 Nov', month: 'November 2026', title: 'Football Cup — Group Stage Begins', eventId: 'football', category: 'sports', venue: 'Turf Arena', time: '18:30', status: 'upcoming' },
  { id: 's5', date: '2026-11-21', display: '21 Nov', month: 'November 2026', title: 'Indoor Arena — League Opens', eventId: 'indoor', category: 'sports', venue: 'Recreation Hall', time: '13:00', status: 'upcoming' },
  { id: 's6', date: '2026-11-22', display: '22 Nov', month: 'November 2026', title: 'Premier League — Final', eventId: 'cpl', category: 'sports', venue: 'Main Sports Ground', time: '19:00', status: 'upcoming' },
  { id: 's7', date: '2026-11-30', display: '30 Nov', month: 'November 2026', title: 'Football Cup — Finals Day', eventId: 'football', category: 'sports', venue: 'Turf Arena', time: '16:00', status: 'upcoming' },
  { id: 's8', date: '2026-12-05', display: '05 Dec', month: 'December 2026', title: 'Cultural Fest — Festival of Creation Opens', eventId: 'cultural', category: 'cultural', venue: 'Grand Convention Hall', time: '17:00', status: 'upcoming' },
  { id: 's9', date: '2026-12-07', display: '07 Dec', month: 'December 2026', title: 'Cultural Fest — Grand Finale Night', eventId: 'cultural', category: 'cultural', venue: 'Grand Convention Hall', time: '18:00', status: 'upcoming' },
  { id: 's10', date: '2026-12-19', display: '19 Dec', month: 'December 2026', title: 'Indoor Arena — Finals Day', eventId: 'indoor', category: 'sports', venue: 'Recreation Hall', time: '10:00', status: 'upcoming' },
  { id: 's11', date: '2027-01-12', display: '12 Jan', month: 'January 2027', title: 'Safety & Sustainability Week Begins', eventId: 'safety', category: 'corporate', venue: 'North & South campuses', time: '09:00', status: 'upcoming' },
  { id: 's12', date: '2027-01-16', display: '16 Jan', month: 'January 2027', title: 'Innovation Challenge — Board Pitch', eventId: 'safety', category: 'corporate', venue: 'Head Office, Corporate Avenue', time: '14:00', status: 'upcoming' },
  { id: 's13', date: '2027-02-13', display: '13 Feb', month: 'February 2027', title: 'Family Day Carnival', eventId: 'familyday', category: 'corporate', venue: 'Main Sports Ground', time: '10:00', status: 'upcoming' },
  { id: 's14', date: '2027-03-06', display: '06 Mar', month: 'March 2027', title: 'Annual Awards Night & Spectrum Trophy', eventId: 'awards', category: 'corporate', venue: 'Grand Convention Hall', time: '19:00', status: 'upcoming' },
];

/* ------------------------------------------------------------------ *
 * THE COLOUR LEAGUE — combined standings across every event.
 *
 * Each division competes under its own colour, which gives the eight squads
 * a visual identity across the table, the stadium and the team builder.
 * ------------------------------------------------------------------ */
export const STANDINGS = [
  { rank: 1, division: 'Operations', shade: 'Magenta', code: 'C-01', hex: '#C72D86', played: 11, won: 8, points: 268, trend: 'up' },
  { rank: 2, division: 'Technology', shade: 'Azure Blue', code: 'C-02', hex: '#2475B7', played: 11, won: 7, points: 241, trend: 'up' },
  { rank: 3, division: 'Quality & Assurance', shade: 'Solar Yellow', code: 'C-03', hex: '#FFCB00', played: 11, won: 7, points: 226, trend: 'down' },
  { rank: 4, division: 'Supply Chain & Logistics', shade: 'Emerald Green', code: 'C-04', hex: '#00A170', played: 11, won: 6, points: 198, trend: 'up' },
  { rank: 5, division: 'Sales & Marketing', shade: 'Royal Violet', code: 'C-05', hex: '#6B3FA0', played: 11, won: 5, points: 174, trend: 'flat' },
  { rank: 6, division: 'Engineering', shade: 'Sunset Orange', code: 'C-06', hex: '#F26522', played: 11, won: 4, points: 152, trend: 'down' },
  { rank: 7, division: 'Risk & Compliance', shade: 'Cobalt Blue', code: 'C-07', hex: '#0047AB', played: 11, won: 4, points: 139, trend: 'flat' },
  { rank: 8, division: 'Corporate & Finance', shade: 'Slate Grey', code: 'C-08', hex: '#8A8F98', played: 11, won: 3, points: 118, trend: 'up' },
];

export const STANDINGS_COPY = {
  eyebrow: 'The Colour League · Live table',
  title: 'ONE TROPHY, EIGHT COLOURS',
  body: 'Every fixture, performance and finish line converts into league points. Each division competes under its own colour — and the combined table below is the only number that decides who lifts the Spectrum Trophy in March.',
  note: 'Points combine sports results, Cultural Fest placements, Corporate Run turnout and Safety Week assessment scores.',
};

/* ------------------------------------------------------------------ *
 * PILLARS — built on the company's stated values.
 * ------------------------------------------------------------------ */
export const PILLARS_COPY = {
  eyebrow: 'Why we run a season',
  title: 'THE SAME VALUES, PLAYED OUT LOUD',
  body: 'ACE runs on three stated values. The season is not a break from them — it is the one time a year the whole company gets to practise them in front of each other.',
};

export const PILLARS = [
  {
    code: 'A',
    title: 'Aspire & Achieve',
    accent: 'magenta',
    body: 'Divisions compete as squads, not as job titles. A shift operator captains a team that includes their own department head, and for ninety minutes the org chart is irrelevant.',
  },
  {
    code: 'C',
    title: 'Continuous Improvement',
    accent: 'azure',
    body: 'The Run, the indoor ladder and Safety Week exist because wellbeing and process discipline are measured, not assumed. Participation is tracked; performance is never mandatory.',
  },
  {
    code: 'E',
    title: 'Empower to Win',
    accent: 'solar',
    body: 'The Cultural Fest and the Innovation Challenge give a platform to colleagues whose contribution never shows up in a quarterly number — the performers, the photographers, the safety champions.',
  },
];

/* ------------------------------------------------------------------ *
 * HERITAGE — the corporate timeline, retold for the portal.
 * ------------------------------------------------------------------ */
export const HERITAGE_COPY = {
  eyebrow: 'Since 2001',
  title: 'TWENTY-SIX YEARS OF BUILDING TOGETHER',
  body: 'ACE began as a small team with a big idea. Everything the arena celebrates today sits on top of that.',
};

export const HERITAGE = [
  { year: '2001', title: 'The first office', body: 'A small founding team opens its doors and signs its first client.' },
  { year: '2005', title: 'Into new markets', body: 'After four years serving a single region, ACE expands into neighbouring markets.' },
  { year: '2010', title: 'Going global', body: 'The first international office opens. Today ACE reaches more than forty countries.' },
  { year: '2016', title: 'The platform years', body: 'The portfolio expands into technology platforms — the business the company is now known for.' },
  { year: '2020', title: 'Next generation', body: 'A transformation driven by new ideas and innovation under next-generation leadership.' },
  { year: '2026', title: 'The Colour League', body: 'Eight divisions, fourteen events, one trophy. The season you are looking at.' },
];

/* ------------------------------------------------------------------ *
 * GALLERY
 * ------------------------------------------------------------------ */
export const GALLERY = [
  { src: '/images/pitch-aerial-night.jpg', caption: 'Floodlit main ground, Main Sports Ground', tag: 'Cricket', span: 'lg:col-span-2 lg:row-span-2' },
  { src: '/images/cricket-motion.jpg', caption: 'Premier League semi-final, 2025 season', tag: 'Cricket', span: '' },
  { src: '/images/football-control.jpg', caption: 'Football Cup group stage, Turf Arena', tag: 'Football', span: '' },
  { src: '/images/trophy-lights.jpg', caption: 'The Spectrum Trophy', tag: 'Awards', span: '' },
  { src: '/images/cricket-ball.jpg', caption: 'First session, opening fixture', tag: 'Cricket', span: '' },
  { src: '/images/football-strike.jpg', caption: 'Finals day at the Turf Arena', tag: 'Football', span: 'lg:col-span-2' },
  { src: '/images/cricket-night.jpg', caption: 'Under lights at the main ground', tag: 'Cricket', span: '' },
  { src: '/images/stadium-day.jpg', caption: 'Family Day, full house', tag: 'Family Day', span: '' },
];

export const GALLERY_COPY = {
  eyebrow: 'From last season',
  title: 'THE ARCHIVE',
  body: 'Shot by colleagues, for colleagues. Every frame below came from the company photography circle, whose members cover each fixture of the season.',
};

/* ------------------------------------------------------------------ *
 * TICKER
 * ------------------------------------------------------------------ */
export const TICKER_ITEMS = [
  'Registration open · Season 2026–27',
  'Premier League · 8 divisions',
  'Cultural Fest · 9 creative disciplines',
  'Corporate Run · Riverside Park',
  'Football Cup · 12 squads',
  'Indoor Arena · 4 disciplines',
  'Safety Week · North & South campuses',
  'Spectrum Trophy · 06 March 2027',
];

/* ------------------------------------------------------------------ *
 * REGISTRATION
 * ------------------------------------------------------------------ */
export const REGISTER_COPY = {
  eyebrow: 'Entries close 28 September 2026',
  title: 'CLAIM YOUR PLACE',
  body: 'Individual entries and squad nominations both run through this form. Your divisional sports secretary receives the entry immediately and confirms your slot within two working days.',
  steps: [
    { n: '01', title: 'Register', body: 'Submit your employee ID, division and the events you want in. Takes under a minute.' },
    { n: '02', title: 'Get assigned', body: 'Your divisional secretary confirms your squad, category and reporting slot by email.' },
    { n: '03', title: 'Turn up', body: 'Fixtures, timings and venue maps land on the portal and your division group.' },
  ],
  divisions: STANDINGS.map((s) => s.division),
};

/* ------------------------------------------------------------------ *
 * FOOTER
 * ------------------------------------------------------------------ */
export const FOOTER = {
  blurb: 'Corporate Sports Events Management is a demo events portal for running company-wide sports and cultural seasons, from registration and squads to fixtures, results and standings.',
  columns: [
    { title: 'Events', links: ['Premier League', 'Football Cup', 'Cultural Fest', 'Indoor Arena', 'Corporate Run'] },
    { title: 'Portal', links: ['Calendar', 'Colour League', 'Gallery', 'Registration', 'Rulebook'] },
    { title: 'Committee', links: ['Engagement Council', 'Sports Secretaries', 'Culture Committee', 'Medical & Safety', 'Contact'] },
  ],
  contact: {
    email: 'events@example.com',
    phone: '+1 555 010 0199',
    address: '100 Corporate Avenue, Riverton 400001',
  },
};

/* ------------------------------------------------------------------ *
 * DERIVED HELPERS
 * ------------------------------------------------------------------ */

/** The next fixture on or after `now` — drives the hero countdown. */
export function nextFixture(now = new Date()) {
  const upcoming = SCHEDULE.filter((s) => new Date(`${s.date}T00:00:00`) >= now);
  return upcoming[0] ?? SCHEDULE[SCHEDULE.length - 1];
}

/** Schedule rows grouped by month, preserving calendar order. */
export function scheduleByMonth(rows = SCHEDULE) {
  const groups = [];
  rows.forEach((row) => {
    const found = groups.find((g) => g.month === row.month);
    if (found) found.rows.push(row);
    else groups.push({ month: row.month, rows: [row] });
  });
  return groups;
}

export const eventById = (id) => EVENTS.find((e) => e.id === id);

/** Flagship events get the deep-dive treatment in the spotlight section. */
export const SPOTLIGHT_IDS = ['cpl', 'cultural', 'football'];
