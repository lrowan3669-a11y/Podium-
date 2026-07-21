const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.PODIUM_DB_PATH || path.join(__dirname, 'podium.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const CLASSES = [
  {
    id: 'fury',
    name: 'Fury',
    namesake: 'Tyson Fury',
    sport_theme: 'Boxing (heavyweight)',
    unit_label: 'a 3rd-round knockdown',
    colour_hex: '#E24B4A',
    award_flourish: 'Knockdown! +{points} for Fury',
  },
  {
    id: 'hamilton',
    name: 'Hamilton',
    namesake: 'Lewis Hamilton',
    sport_theme: 'Formula 1',
    unit_label: 'a 4-second pit stop',
    colour_hex: '#1BAF7A',
    award_flourish: 'Box box! 4-second stop — +{points} for Hamilton',
  },
  {
    id: 'charlton',
    name: 'Charlton',
    namesake: 'Bobby Charlton',
    sport_theme: 'Football',
    unit_label: 'a back-post header',
    colour_hex: '#378ADD',
    award_flourish: 'Back-post header! +{points} for Charlton',
  },
  {
    id: 'sweet_science',
    name: 'Sweet Science',
    namesake: 'Boxing',
    sport_theme: 'Boxing',
    unit_label: 'a 3-punch combo',
    colour_hex: '#EDA100',
    award_flourish: 'Three-punch combo! +{points} for Sweet Science',
  },
  {
    id: 'the_power',
    name: 'The Power',
    namesake: "Phil 'The Power' Taylor",
    sport_theme: 'Darts',
    unit_label: 'a double 20',
    colour_hex: '#4A3AA7',
    award_flourish: 'One hundred and eighty… double 20! +{points} for The Power',
  },
];

const insertClass = db.prepare(`
  INSERT OR IGNORE INTO classes (id, name, namesake, sport_theme, unit_label, colour_hex, award_flourish)
  VALUES (@id, @name, @namesake, @sport_theme, @unit_label, @colour_hex, @award_flourish)
`);
const seedClasses = db.transaction((classes) => {
  for (const c of classes) insertClass.run(c);
});
seedClasses(CLASSES);

const insertMeta = db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)`);
insertMeta.run('current_week', '1');

module.exports = db;
