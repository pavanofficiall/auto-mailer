# Employment Lawyers in India — Detailed Directory

Source of truth: `employment-lawyers-india.csv` (kept up to date). This document mirrors its columns for easy browsing and review.

Columns
- name
- role
- firm
- city
- email
- phone
- source_url
- linkedin
- bio_url
- email_type
- specializations
- website

Preview (sample rows)

| name | role | firm | city | email | phone | source_url | linkedin | bio_url | email_type | specializations | website |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Suhas Srinivasiah | Senior Partner (Employment Law) | Kochhar & Co. | Bengaluru | suhas.srinivasiah@bgl.kochhar.com | +91 80 4030 8000 | https://www.kochhar.com/people/ | https://www.linkedin.com/in/suhassrinivasiah/ | http://kochhar.com/people/suhas-srinivasiah/ | individual | employment, posh | https://www.kochhar.com/ |
| Abhinav Rastogi | Partner — Employment, Labour and Benefits | Khaitan & Co. | Delhi NCR | delhi@khaitanco.com | +91 11 4151 5454 | http://www.khaitanco.com/people/abhinav-rastogi | https://www.linkedin.com/in/abhinav-rastogi-1a71bb22/ | http://www.khaitanco.com/people/abhinav-rastogi | practice | employment, posh | https://www.khaitanco.com/ |
| Abhimanyu Pal | Counsel — Employment, Labour and Benefits | Khaitan & Co. | Mumbai | mumbai@khaitanco.com | +91 22 6636 5000 | http://www.khaitanco.com/people/abhimanyu-pal | https://www.linkedin.com/company/khaitan-&-co- | http://www.khaitanco.com/people/abhimanyu-pal | practice | employment | https://www.khaitanco.com/ |
| Obhan & Associates Employment Contact | Employment/Labour (practice contact) | Obhan & Associates | New Delhi | email@obhans.com |  | https://www.obhanandassociates.com/team/ | https://www.linkedin.com/company/obhan-&-associates/ | https://www.obhanandassociates.com/team/ | practice | employment | https://www.obhanandassociates.com/ |
| Rajarshi Chakrabarti | Senior Partner | Kochhar & Co. | Mumbai | rajarshi@mumbai.kochhar.com | +91 22 6112 0700 | https://kochhar.com/people/rajarshi-chakrabarti/ | https://www.linkedin.com/in/rajarshi-chakrabarti-75096a21 | https://kochhar.com/people/rajarshi-chakrabarti/ | individual | employment | https://www.kochhar.com/ |
| Anshul Prakash | Partner — Employment, Labour and Benefits | Khaitan & Co. | Mumbai | mumbai@khaitanco.com | +91 22 6636 5000 | http://www.khaitanco.com/people/anshul-prakash |  | http://www.khaitanco.com/people/anshul-prakash | practice | employment, posh | https://www.khaitanco.com/ |
| Abhinav Pal (IndusLaw Employment Contact) | Employment practice contact | IndusLaw | Bengaluru | contactus@induslaw.com |  | http://www.induslaw.com/people | https://www.linkedin.com/company/indus-law/ | http://www.induslaw.com/people | practice | employment | https://induslaw.com/ |
| Aparna Mittal (Trilegal Employment Contact) | Employment practice contact | Trilegal | Delhi NCR | info@trilegal.com |  | http://www.trilegal.com/people | https://www.linkedin.com/company/trilegal | http://www.trilegal.com/people | practice | employment | https://trilegal.com/ |
| S&R Associates (Employment Contact) | Employment practice contact | S&R Associates | Delhi NCR | careers@snrlaw.in |  | https://www.snrlaw.in/people/ | https://www.linkedin.com/company/s&r-associates/ | https://www.snrlaw.in/people/ | practice | employment | https://www.snrlaw.in/ |
| JSA (Employment Contact) | Employment practice contact | JSA | Delhi NCR | jsa.del@jsalaw.com | +91 11 4357 6000 | http://www.jsalaw.com/people/ | https://www.linkedin.com/company/jsa/ | http://www.jsalaw.com/people/ | practice | employment | https://www.jsalaw.com/ |
| Phoenix Legal (Employment Contact) | Employment practice contact | Phoenix Legal | Delhi NCR | careers@phoenixlegal.in |  | http://www.phoenixlegal.in/people | https://www.linkedin.com/company/phoenixlegal/ | http://www.phoenixlegal.in/people | practice | employment | http://www.phoenixlegal.in/ |
| Tatva Legal (Employment Contact) | Employment practice contact | Tatva Legal | Hyderabad | hyderabad@tatvalegal.com | +91 40 2355 8277 | http://www.tatvalegal.com/lawyers/ | https://www.linkedin.com/company/tatva-legal/ | http://www.tatvalegal.com/lawyers/ | practice | employment | https://www.tatvalegal.com/ |

Full table (regenerate from CSV)

To regenerate a complete Markdown table from the CSV, you can run this quick Node.js script locally. It reads `employment-lawyers-india.csv` and prints a Markdown table to stdout.

```js
// save as scripts/csv-to-md.js and run: node scripts/csv-to-md.js > employment-lawyers-india-detailed.md
import fs from 'node:fs';
import path from 'node:path';
const csvPath = path.resolve('employment-lawyers-india.csv');
const csv = fs.readFileSync(csvPath, 'utf8').replace(/\r\n/g, '\n');
function parseCSV(text){
  const rows=[]; let i=0, field='', row=[], inQ=false; const push=()=>{row.push(field); field='';};
  while(i<text.length){
    const c=text[i++];
    if(c==='"'){
      if(inQ && text[i]==='"'){ field+='"'; i++; }
      else inQ=!inQ;
    } else if(c===',' && !inQ){ push(); }
    else if(c==='\n' && !inQ){ push(); rows.push(row); row=[]; }
    else { field+=c; }
  }
  if(field.length||row.length){ push(); rows.push(row); }
  return rows;
}
const rows = parseCSV(csv).filter(r=>r.some(v=>v && v.trim().length));
const [header, ...data] = rows;
const esc = s => (s||'').replace(/\|/g, '\\|');
let out = '';
out += '# Employment Lawyers in India — Detailed Directory\n\n';
out += 'Source of truth: `employment-lawyers-india.csv`.\n\n';
out += '| ' + header.join(' | ') + ' |\n';
out += '|' + header.map(()=> '---').join('|') + '|\n';
for(const r of data){ out += '| ' + r.map(esc).join(' | ') + ' |\n'; }
console.log(out);
```

If you want, I can add this script under `scripts/` and commit a fully generated table now.

_Last updated: 2026-01-16_
