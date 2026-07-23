### Task 2: Replace 837P Professional Fixture (sample.837.js)

**Files:**
- Modify: `tests/fixtures/sample.837.js` — Complete replacement

**Interfaces:**
- Consumes: None
- Produces: `module.exports = SAMPLE_837` — a realistic multi-claim 837P string

- [ ] **Step 1: Write the new comprehensive 837P fixture**

```js
// tests/fixtures/sample.837.js
const SAMPLE_837 = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220701*1253*^*00501*000000001*0*P*:~
GS*HC*SENDER*RECEIVER*20220701*1253*1*X*005010X222A1~
ST*837*0001~
BHT*0019*00*12345*20220701*1253*CH~
HL*1**20*1~
NM1*85*2*ACME MEDICAL GROUP*****XX*1234567893~
N3*123 MAIN STREET*SUITE 100~
N4*ANYTOWN*CA*90210~
REF*EI*123456789~
PER*IC*JANE SMITH*TE*5551234567~
HL*2*1*22*1~
SBR*P*18*******CI~
NM1*IL*1*DOE*JOHN****MI*ABC123456~
DMG*D8*19800115*M~
REF*1L*ABC123456~
HL*3*2*23*0~
PAT*19~
NM1*QC*1*DOE*JOHN~
DMG*D8*19800115*M~
CLM*CLM001*250***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220701~
DTP*435*D8*20220701~
REF*D9*REF123456~
AMT*F5*20~
HI*BK:I10*BF:E119*BF:I25.1~
NM1*82*1*SMITH*JANE****XX*9876543212~
NM1*77*2*DOWNTOWN CLINIC*****XX*1122334455~
LX*1~
SV1*HC:99213:11*150*UN*1*11**1*N~
DTP*472*D8*20220701~
LX*2~
SV1*HC:99214:11*100*UN*1*11**2*N~
DTP*472*D8*20220702~
HL*4*1*20*1~
NM1*85*2*OTHER BILLING INC*****XX*9999999999~
N3*456 OAK AVE~
N4*METROPOLIS*NY*10001~
REF*EI*987654321~
HL*5*4*22*0~
SBR*P*18*******CI~
NM1*IL*1*SMITH*JANE****MI*XYZ789012~
DMG*D8*19900520*F~
REF*1L*XYZ789012~
PAT*19~
NM1*QC*1*SMITH*JANE~
DMG*D8*19900520*F~
CLM*CLM002*500***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220705~
DTP*435*D8*20220705~
HI*BK:J45*BF:J45.1~
NM1*82*1*JONES*ROBERT****XX*5555555555~
LX*1~
SV1*HC:99203:25*200*UN*1*11**1*N~
DTP*472*D8*20220705~
LX*2~
SV1*HC:99204:25*300*UN*1*11**1*N~
DTP*472*D8*20220705~
SE*50*0001~
GE*1*1~
IEA*1*000000001~`;

module.exports = SAMPLE_837;
```

This fixture contains:
- Full envelope (ISA/GS/ST/SE/GE/IEA)
- BHT transaction header
- Two billing providers (HL*1, HL*4) — ACME MEDICAL GROUP and OTHER BILLING INC
- First claim: patient JOHN DOE, subscriber JOHN DOE, claim CLM001 $250
  - Two service lines: 99213 ($150) and 99214 ($100)
  - Three diagnosis codes: I10, E119, I25.1
  - Rendering provider (NM1*82), service facility (NM1*77)
  - REF D9, AMT F5
  - Both service dates
- Second claim: patient JANE SMITH, subscriber JANE SMITH, claim CLM002 $500
  - Two service lines: 99203 ($200) and 99204 ($300)
  - Two diagnosis codes: J45, J45.1
  - Rendering provider (NM1*82)

- [ ] **Step 2: Verify fixture loads**

Run:
```bash
node -e "const f = require('./tests/fixtures/sample.837'); console.log(f.substring(0, 100));"
```
Expected: Prints first 100 characters of the EDI string.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/sample.837.js
git commit -m "test: update 837P fixture with multi-claim comprehensive data"
```

---


