// Comprehensive 835 test fixture covering all major segment types:
//   Envelope: ISA, GS, ST, SE, GE, IEA
//   Header:   BPR, TRN, DTM*405
//   Payer:    N1*PR, N3, N4, PER
//   Payee:    N1*PE, N3, N4, REF*TJ, PER
//   Claims:   CLP, NM1*QC, NM1*IL, DMG, NM1*82, NM1*85,
//             DTM (232/233/050/652/653), REF (1C/F8), AMT (I)
//             CAS (claim-level)
//   Lines:    SVC, CAS (line-level), DTM*472, REF*6R, AMT*B6, QTY
//   Summary:  PLB
//
// 3 claims:
//   CLM001 — Partial (paid 200 of 250, CO-45 adjustment on 99213 line)
//   CLM002 — Denied (PR-3 write-off, 300 charged 0 paid)
//   CLM003 — Paid in full (500 charged 500 paid)
//
// Total payment: 200 + 0 + 500 = 700

const SAMPLE_835 = [
  'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220715*0953*^*00501*000000002*0*P*:~',
  'GS*HP*SENDER*RECEIVER*20220715*0953*1*X*005010X221A1~',
  'ST*835*0002~',
  'BPR*I*700*C*CHK*********20220716~',
  'TRN*1*PAYREF001*SENDER~',
  'DTM*405*20220716~',
  'N1*PR*PAYER NAME*XV*123456789~',
  'N3*123 MAIN ST*SUITE 100~',
  'N4*METROPOLIS*NY*10001~',
  'PER*IC*JOHN SMITH*TE*5551234567*EM*JSMITH@PAYER.COM~',
  'N1*PE*PROVIDER NAME*XX*987654321~',
  'N3*456 OAK AVE~',
  'N4*ANYTOWN*CA*90210~',
  'REF*TJ*12-3456789~',
  'PER*IC*JANE DOE*TE*5559876543~',
  'CLP*CLM001*1*250*200*50*CO-45*CLM001*11*1~',
  'NM1*QC*1*DOE*JOHN****MI*MEM001~',
  'NM1*IL*1*DOE*JOHN****MI*SUB001~',
  'DMG*D8*19800115*M~',
  'NM1*82*1*SMITH*JANE****XX*1234567893~',
  'NM1*85*2*BILLING CLINIC*****XX*9876543212~',
  'DTM*232*20220701~',
  'DTM*233*20220715~',
  'DTM*050*20220720~',
  'REF*1C*1234567893~',
  'REF*F8*REF123~',
  'AMT*I*50~',
  'CAS*CO*45*50*50~',
  'SVC*HC:99213*150*120***1~',
  'CAS*CO*45*30*30~',
  'DTM*472*20220701~',
  'REF*6R*LN001~',
  'AMT*B6*10~',
  'QTY*CA*1~',
  'SVC*HC:99214*100*80***1~',
  'DTM*472*20220702~',
  'REF*6R*LN002~',
  'AMT*B6*20~',
  'CLP*CLM002*4*300*0*300*PR-3*CLM002*11*1~',
  'NM1*QC*1*SMITH*JANE****MI*MEM002~',
  'NM1*IL*1*SMITH*JANE****MI*SUB002~',
  'DMG*D8*19750620*F~',
  'CAS*PR*3*300*300~',
  'SVC*HC:99215*300*0***1~',
  'CAS*PR*3*300*300~',
  'DTM*472*20220705~',
  'REF*6R*LN003~',
  'CLP*CLM003*3*500*500*0***11*1~',
  'NM1*QC*1*JONES*BOB****MI*MEM003~',
  'NM1*IL*1*JONES*BOB****MI*SUB003~',
  'DMG*D8*19901201*M~',
  'NM1*82*1*LEE*SARAH****XX*1112223334~',
  'SVC*HC:99221*500*500***1~',
  'DTM*472*20220710~',
  'REF*6R*LN004~',
  'PLB*987654321*20220731*FB:50*50~',
  'SE*56*0002~',
  'GE*1*1~',
  'IEA*1*000000002~',
].join('');

module.exports = SAMPLE_835;
