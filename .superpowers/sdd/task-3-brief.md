### Task 3: Create 837I Institutional Fixture

**Files:**
- Create: `tests/fixtures/sample.837i.js`

**Interfaces:**
- Consumes: None
- Produces: `module.exports = SAMPLE_837I` — a realistic institutional claim string

- [ ] **Step 1: Write the 837I institutional fixture**

```js
// tests/fixtures/sample.837i.js
const SAMPLE_837I = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220715*0953*^*00501*000000002*0*P*:~
GS*HC*SENDER*RECEIVER*20220715*0953*1*X*005010X222A2~
ST*837*0002~
BHT*0019*00*67890*20220715*0953*CH~
HL*1**20*1~
NM1*85*2*GENERAL HOSPITAL*****XX*1111111111~
N3*789 HOSPITAL BLVD~
N4*BIGCITY*CA*90211~
REF*EI*555555555~
HL*2*1*22*1~
SBR*P*18*******MB~
NM1*IL*1*JOHNSON*ROBERT****MI*MEM123456~
DMG*D8*19750310*M~
REF*1L*MEM123456~
HL*3*2*23*0~
PAT*19~
NM1*QC*1*JOHNSON*ROBERT~
DMG*D8*19750310*M~
CLM*CLM003*1500***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220710~
DTP*435*D8*20220715~
DTP*096*TM*1430~
CL1*1*5*02~
HI*ABK:E119*ABF:J45*ABJ:I10*ABR:V901*DRG*871~
NM1*71*1*LEE*DAVID****XX*2222222222~
NM1*72*1*WONG*SUSAN****XX*3333333333~
PWK*09*AC*BM~
CN1*01*500~
CRC*AB*Y*1~
LX*1~
SV2*0450*HC:99221*500*UN*1~
DTP*472*D8*20220710~
LX*2~
SV2*0452*HC:99231*400*UN*2~
DTP*472*D8*20220712~
LX*3~
SV2*0459*HC:99238*600*UN*1~
DTP*472*D8*20220715~
SE*35*0002~
GE*1*1~
IEA*1*000000002~`;

module.exports = SAMPLE_837I;
```

This fixture contains:
- Institutional claim with CL1 admission info (type=1, source=5, status=02)
- DTP*434 (admission date), DTP*435 (discharge date), DTP*096 (discharge hour 14:30)
- HI with principal (ABK:E119), other (ABF:J45), admitting (ABJ:I10), external cause (ABR:V901), DRG (871)
- NM1*71 (attending physician) and NM1*72 (operating physician)
- PWK report type, CN1 contract info, CRC condition code
- Three SV2 service lines with revenue codes (0450, 0452, 0459)

- [ ] **Step 2: Verify fixture loads**

Run:
```bash
node -e "const f = require('./tests/fixtures/sample.837i'); console.log(f.substring(0, 100));"
```
Expected: Prints first 100 characters.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/sample.837i.js
git commit -m "test: add 837I institutional fixture"
```

---


