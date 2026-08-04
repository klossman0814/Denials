import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { claimsApi } from '../services/claims.api';
import { uploadApi } from '../services/upload.api';
import StatusBadge from '../components/StatusBadge';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';
const dateFmt = (d) => d ? new Date(d).toLocaleDateString() : '—';
const fmt = (v) => v != null ? Number(v).toLocaleString() : '—';

export default function ClaimDetail() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [denials, setDenials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([claimsApi.get(id), claimsApi.denials(id)])
      .then(([cRes, dRes]) => { setClaim(cRes.data.claim); setDenials(dRes.data.denials || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>;
  if (!claim) return <div className="page"><p>Claim not found.</p><Link to="/claims">Back</Link></div>;

  const remittances = claim.Remittances || [];
  const totalPaid = remittances.reduce((s, r) => s + parseFloat(r.total_paid || 0), 0);
  const totalAdjusted = remittances.reduce((s, r) => s + parseFloat(r.adjustment_amount || 0), 0);
  const denialCount = denials.length;
  const denialTotal = denials.reduce((s, d) => s + parseFloat(d.amount || 0), 0);

  return (
    <div className="page">
      <Link to="/matched-claims" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Matched Claims</Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Claim {claim.claim_id}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {claim.file_id && (
            <button
              className="btn btn-primary"
              onClick={() => {
                const src = claim.UploadedFile;
                uploadApi.getRawFile(claim.file_id, src?.filename || `${claim.claim_id}.837`)
                  .catch(err => alert(err?.response?.data?.error || 'Download failed'));
              }}
            >
              Download X12 (837)
            </button>
          )}
          <StatusBadge status={claim.status} />
        </div>
      </div>

      {/* Patient Demographics Card */}
      {claim.patient_first_name && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-primary)' }}>
          <div className="card-header" style={{ fontSize: '0.85rem' }}>Patient Demographics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</div>
              <div style={{ fontWeight: 600 }}>
                {[claim.patient_first_name, claim.patient_middle_initial, claim.patient_last_name].filter(Boolean).join(' ') || '—'}
                {claim.patient_suffix ? `, ${claim.patient_suffix}` : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date of Birth</div>
              <div style={{ fontWeight: 600 }}>{claim.patient_dob ? dateFmt(claim.patient_dob) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gender</div>
              <div style={{ fontWeight: 600 }}>{claim.patient_gender === 'M' ? 'Male' : claim.patient_gender === 'F' ? 'Female' : claim.patient_gender || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member ID</div>
              <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{claim.patient_member_id || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Relationship to Subscriber</div>
              <div style={{ fontWeight: 600 }}>{claim.patient_relationship_code || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mailing Address</div>
              <div style={{ fontWeight: 600 }}>
                {[claim.patient_address1, claim.patient_address2].filter(Boolean).join(', ') || '—'}
                {claim.patient_city ? <><br />{claim.patient_city}{claim.patient_state ? `, ${claim.patient_state}` : ''} {claim.patient_zip || ''}</> : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subscriber</div>
              <div style={{ fontWeight: 600 }}>
                {[claim.subscriber_first_name, claim.subscriber_middle_initial, claim.subscriber_last_name].filter(Boolean).join(' ') || '—'}
                {claim.subscriber_suffix ? `, ${claim.subscriber_suffix}` : ''}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {claim.subscriber_id || '—'} | Group: {claim.subscriber_group_number || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Summary stat cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="card stat-card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Payer</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{claim.payer_name || '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {claim.payer_id || '—'} | Filing: {claim.claim_filing_type || '—'}</div>
        </div>
        <div className="card stat-card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Charges vs Paid</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{currency(claim.total_charge)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Paid: {currency(totalPaid)} | Adjustments: {currency(totalAdjusted)}</div>
        </div>
        <div className="card stat-card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Denials</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{fmt(denialCount)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total: {currency(denialTotal)}</div>
        </div>
        <div className="card stat-card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Service Dates</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{dateFmt(claim.service_date_start) || '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Through: {dateFmt(claim.service_date_end) || '—'}</div>
        </div>
        <div className="card stat-card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Remittances</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{fmt(remittances.length)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Days to Resolve: {claim.days_to_resolve != null ? fmt(claim.days_to_resolve) + 'd' : '—'}</div>
        </div>
      </div>

      {/* 837 Claim Info */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">837 Claim Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', padding: '1rem', fontSize: '0.875rem' }}>
          <div><strong>Claim ID:</strong> <span style={{ fontFamily: 'monospace' }}>{claim.claim_id || '—'}</span></div>
          <div><strong>Subscriber:</strong> {`${claim.subscriber_first_name || ''} ${claim.subscriber_last_name || ''}`.trim() || '—'} ({claim.subscriber_id || '—'})</div>
          <div><strong>Provider:</strong> {claim.provider_name || '—'} {claim.provider_npi ? `(NPI: ${claim.provider_npi})` : ''}</div>
          <div><strong>POS:</strong> {claim.pos_code || '—'}</div>
          <div><strong>BHT Ref:</strong> {claim.bht_reference || '—'} | Date: {claim.bht_date || '—'}</div>
          <div><strong>Admission:</strong> {dateFmt(claim.admission_date) || '—'} | Discharge: {dateFmt(claim.discharge_date) || '—'} | Hour: {claim.discharge_hour || '—'}</div>
          <div><strong>Admit Type:</strong> {claim.admit_type_code || '—'} | Source: {claim.admit_source_code || '—'} | Status: {claim.patient_status_code || '—'}</div>
          <div><strong>DRG:</strong> {claim.drg_code || '—'} | Weight: {claim.drg_weight || '—'}</div>
          <div><strong>Rendering Provider:</strong> {claim.rendering_provider_name || '—'} {claim.rendering_provider_npi ? `(${claim.rendering_provider_npi})` : ''}</div>
          <div><strong>Attending:</strong> {claim.attending_provider_name || '—'} | <strong>Operating:</strong> {claim.operating_provider_name || '—'}</div>
          <div><strong>Referring:</strong> {claim.referring_provider_name || '—'} | <strong>Facility:</strong> {claim.service_facility_name || '—'}</div>
          <div><strong>Billing Address:</strong> {[claim.provider_address1, claim.provider_city, claim.provider_state].filter(Boolean).join(', ') || '—'}</div>
        </div>
      </div>

      {/* All 835 Remittances */}
      {remittances.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">835 Remittance Analysis ({remittances.length} total)</div>
          {remittances.map((remit, ri) => (
            <div key={remit.id} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', margin: '0.75rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '0.95rem' }}>Remittance #{ri + 1}</strong>
                <StatusBadge status={remit.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <div><strong>Payer Claim ID:</strong> <span style={{ fontFamily: 'monospace' }}>{remit.payer_claim_id || '—'}</span></div>
                <div><strong>Remittance Date:</strong> {dateFmt(remit.remittance_date)}</div>
                <div><strong>Charge:</strong> {currency(remit.total_charge)} | <strong>Paid:</strong> {currency(remit.total_paid)}</div>
                <div><strong>Adjustment:</strong> {currency(remit.adjustment_amount)}</div>
                <div><strong>Claim Status Code:</strong> {remit.claim_status_code || '—'} | <strong>Filing:</strong> {remit.claim_filing_type || '—'}</div>
                <div><strong>Service Dates:</strong> {dateFmt(remit.service_date_from)} – {dateFmt(remit.service_date_to) || '—'}</div>
                {remit.claim_statement_from && <div><strong>Statement Period:</strong> {dateFmt(remit.claim_statement_from)} – {dateFmt(remit.claim_statement_to) || '—'}</div>}
              </div>

              {/* Payment File Info */}
              {remit.RemittanceFile && (
                <div style={{ background: 'var(--bg-hover)', borderRadius: '4px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                  <strong>File:</strong> {remit.RemittanceFile.payer_name || '—'} | Payment: {currency(remit.RemittanceFile.total_payment)} on {dateFmt(remit.RemittanceFile.payment_date)} | Trace: {remit.RemittanceFile.trace_number || '—'}
                </div>
              )}

              {/* Remittance Service Lines */}
              {remit.RemittanceLines?.length > 0 && (
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Service Lines ({remit.RemittanceLines.length})</strong>
                  <table className="table" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    <thead>
                      <tr><th>#</th><th>Procedure</th><th>Mod</th><th>Charge</th><th>Paid</th><th>Units</th><th>Date</th><th>Pt Liab</th><th>Adjustments</th></tr>
                    </thead>
                    <tbody>
                      {remit.RemittanceLines.map(line => (
                        <tr key={line.id}>
                          <td>{line.line_number}</td>
                          <td style={{ fontFamily: 'monospace' }}>{line.procedure_code || '—'}</td>
                          <td>{line.modifier || '—'}</td>
                          <td>{currency(line.charge_amount)}</td>
                          <td>{currency(line.paid_amount)}</td>
                          <td>{line.unit_count || '1'}</td>
                          <td>{dateFmt(line.service_date)}</td>
                          <td>{currency(line.patient_liability)}</td>
                          <td>
                            {line.DenialReasons?.length > 0 ? (
                              <div style={{ fontSize: '0.7rem' }}>
                                {line.DenialReasons.map(dr => (
                                  <span key={dr.id} className="badge badge-error" style={{ marginRight: '0.25rem', marginBottom: '0.125rem', display: 'inline-block' }}>
                                    {dr.denial_code} {currency(dr.amount)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Paid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Denial Reasons */}
      {denials.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">All Denial Reasons ({fmt(denials.length)})</div>
          <table className="table">
            <thead><tr><th>Code</th><th>Group</th><th>Amount</th><th>Level</th><th>Remittance Date</th></tr></thead>
            <tbody>
              {denials.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace' }}>{d.denial_code}</td>
                  <td>{d.group_code || '—'}</td>
                  <td>{currency(d.amount)}</td>
                  <td style={{ fontSize: '0.75rem' }}>{d.claim_line_id ? 'Line' : d.remittance_line_id ? '835 Line' : 'Claim'}</td>
                  <td>{d.Remittance?.remittance_date ? dateFmt(d.Remittance.remittance_date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 837 Billed Lines */}
      {claim.ClaimLines?.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">837 Billed Lines ({fmt(claim.ClaimLines.length)})</div>
          <table className="table">
            <thead><tr><th>#</th><th>Procedure</th><th>Mod</th><th>Charge</th><th>Units</th><th>Revenue Code</th><th>Service Date</th></tr></thead>
            <tbody>
              {claim.ClaimLines.map(l => (
                <tr key={l.id}>
                  <td>{l.line_number}</td>
                  <td style={{ fontFamily: 'monospace' }}>{l.procedure_code || '—'}</td>
                  <td>{l.modifier || '—'}</td>
                  <td>{currency(l.charge_amount)}</td>
                  <td>{l.unit_count || '1'}</td>
                  <td>{l.revenue_code || '—'}</td>
                  <td>{dateFmt(l.service_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
