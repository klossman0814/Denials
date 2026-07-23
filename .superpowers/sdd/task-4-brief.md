### Task 4: Create 837D Dental Fixture

**Files:**
- Create: `tests/fixtures/sample.837d.js`

**Interfaces:**
- Consumes: None
- Produces: `module.exports = SAMPLE_837D` — a realistic dental claim string

- [ ] **Step 1: Write the 837D dental fixture**

```js
// tests/fixtures/sample.837d.js
const SAMPLE_837D = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220720*1400*^*00501*000000003*0*P*:~
GS*HC*SENDER*RECEIVER*20220720*1400*1*X*005010X223A2~
ST*837*0003~
BHT*0019*00*24680*20220720*1400*CH~
HL*1**20*1~
NM1*85*2*DENTAL CARE ASSOCIATES*****XX*4444444444~
N3*321 DENTAL DRIVE~
N4*SMALLVILLE*IL*60601~
REF*EI*777777777~
HL*2*1*22*1~
SBR*P*18*******CI~
NM1*IL*1*BROWN*EMILY****MI*DEN888888~
DMG*D8*19921005*F~
REF*1L*DEN888888~
HL*3*2*23*0~
PAT*19~
NM1*QC*1*BROWN*EMILY~
DMG*D8*19921005*F~
CLM*CLM004*350***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220720~
HI*BK:K02.9~
NM1*82*1*MILLER*THOMAS****XX*6666666666~
LX*1~
SV3*AD:CDT:D0120*75*UN*1**1~
TOO*1*2*ML~
DTP*472*D8*20220720~
LX*2~
SV3*AD:CDT:D0270*125*UN*1**1~
TOO*1*30*MOD~
DTP*472*D8*20220720~
LX*3~
SV3*AD:CDT:D0150*150*UN*1**1~
DTP*472*D8*20220720~
SE*25*0003~
GE*1*1~
IEA*1*000000003~`;

module.exports = SAMPLE_837D;
```

This fixture contains:
- Dental claim with CDT procedure codes (D0120, D0270, D0150)
- TOO tooth segments with oral cavity code, tooth code, and tooth surface
- Three SV3 service lines
- HI diagnosis code (K02.9 — dental caries)
- Rendering provider (NM1*82: THOMAS MILLER)
- Billing provider (NM1*85: DENTAL CARE ASSOCIATES)

- [ ] **Step 2: Verify fixture loads**

Run:
```bash
node -e "const f = require('./tests/fixtures/sample.837d'); console.log(f.substring(0, 100));"
```
Expected: Prints first 100 characters.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/sample.837d.js
git commit -m "test: add 837D dental fixture"
```

---


