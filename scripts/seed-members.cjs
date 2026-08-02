const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile('C:\\Users\\Click\\Desktop\\BACKUP qlf.xlsx');
const ws = wb.Sheets['Reviews'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
const orgId = '782738ec-0277-4bbb-aee2-b3ec561b2a07';
const valid = data.filter(r => r[1] && r[1] !== 'Nom et Prenom');

function esc(s) {
  if (s == null || String(s).trim() === '') return 'NULL';
  return "'" + String(s).trim().replace(/'/g, "''") + "'";
}

function gender(g) {
  if (!g) return 'NULL';
  const s = String(g).toLowerCase();
  if (s === 'homme') return "'male'";
  if (s === 'femme') return "'female'";
  return esc(g);
}

function dateOrNull(v) {
  if (!v || String(v).trim() === '') return 'NULL';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "'" + s + "'";
  return 'NULL';
}

const memberLines = [];
const rfidLines = [];

for (const r of valid) {
  const fullName = String(r[1] || '').trim();
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '-';
  const n = String(r[0] || '').trim();
  const barcode = r[15] ? String(r[15]).trim() : null;

  // Notes: Groupage(4) + Poids(7) + Taille(8) + Spécialité(14) + Assurer(17)
  const noteParts = [];
  if (r[4] && String(r[4]).trim()) noteParts.push('Groupage: ' + String(r[4]).trim());
  if (r[7] && String(r[7]).trim()) noteParts.push('Poids: ' + String(r[7]).trim() + ' kg');
  if (r[8] && String(r[8]).trim()) noteParts.push('Taille: ' + String(r[8]).trim() + ' cm');
  if (r[14] && String(r[14]).trim()) noteParts.push('Spécialité: ' + String(r[14]).trim());
  if (r[17] && String(r[17]).trim() && String(r[17]).trim() !== 'No assurer') noteParts.push('Assurance: ' + String(r[17]).trim());
  const notes = noteParts.length > 0 ? noteParts.join(' | ') : null;

  const memberNum = 'QLF-' + String(n).padStart(5, '0');

  const cols = [
    esc(orgId),
    esc(firstName),
    esc(lastName),
    gender(r[3]),
    dateOrNull(r[2]),
    esc(r[6]),
    esc(r[5]),
    esc(memberNum),
    esc(notes),
    dateOrNull(r[10]) === 'NULL' ? 'NOW()' : dateOrNull(r[10]),
  ];

  memberLines.push('(' + cols.join(', ') + ')');

  if (barcode) {
    rfidLines.push({ barcode, memberNum });
  }
}

const header = `INSERT INTO members (organization_id, first_name, last_name, gender, birth_date, phone, address, member_number, notes, created_at) VALUES\n`;
const memberSql = header + memberLines.join(',\n') + ';\n';

const rfidSql = `-- RFID Cards from Barcode\n\n` + rfidLines.map(r =>
  `INSERT INTO rfid_cards (member_id, rfid_uid, status, assigned_at) SELECT id, '${r.barcode}', 'ACTIF', NOW() FROM members WHERE member_number = '${r.memberNum}' AND organization_id = '${orgId}' AND NOT EXISTS (SELECT 1 FROM rfid_cards WHERE rfid_uid = '${r.barcode}');`
).join('\n') + '\n';

const dir = path.join(__dirname, '..', 'supabase', 'migrations');
fs.writeFileSync(path.join(dir, '00054_seed_members.sql'), memberSql);
fs.writeFileSync(path.join(dir, '00056_seed_rfid_cards.sql'), rfidSql);

console.log('Members:', memberLines.length);
console.log('RFID cards:', rfidLines.length);
console.log('Sample notes:', valid.slice(0, 3).map(r => {
  const parts = [];
  if (r[4] && String(r[4]).trim()) parts.push('Groupage: ' + String(r[4]).trim());
  if (r[7] && String(r[7]).trim()) parts.push('Poids: ' + String(r[7]).trim());
  if (r[8] && String(r[8]).trim()) parts.push('Taille: ' + String(r[8]).trim());
  if (r[14] && String(r[14]).trim()) parts.push('Spécialité: ' + String(r[14]).trim());
  if (r[17] && String(r[17]).trim() && String(r[17]).trim() !== 'No assurer') parts.push('Assurance: ' + String(r[17]).trim());
  return parts.join(' | ') || null;
}));
