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

const lines = [];
const seen = {};

for (const r of valid) {
  const fullName = String(r[1] || '').trim();
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '-';
  const n = String(r[0] || '').trim();
  const barcode = r[15] ? String(r[15]).trim() : null;
  const phone = r[6] ? String(r[6]).trim() : null;
  const birthDate = r[2] ? String(r[2]).trim() : null;

  const phoneCond = phone ? `phone = ${esc(phone)}` : 'phone IS NULL';
  const bdCond = birthDate ? `birth_date = '${birthDate}'` : 'birth_date IS NULL';
  const matchCond = `first_name = ${esc(firstName)} AND last_name = ${esc(lastName)} AND ${phoneCond} AND ${bdCond}`;

  const memberNum = n ? 'QLF-' + String(n).padStart(5, '0') : null;
  if (memberNum) {
    lines.push(`UPDATE members SET member_number = '${memberNum}' WHERE organization_id = '${orgId}' AND ${matchCond};`);
  }
}

const sql = '-- Fix member_number with QLF- prefix\n\n' + lines.join('\n') + '\n';
const outFile = path.join(__dirname, '..', 'supabase', 'migrations', '00055_fix_member_numbers.sql');
fs.writeFileSync(outFile, sql);
console.log('Written', lines.length, 'UPDATE statements');
