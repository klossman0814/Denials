import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { claimsApi } from '../services/claims.api';
import StatusBadge from '../components/StatusBadge';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';
const dateFmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

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

  const remit = claim.Remittances?.[0];
  const remitLines = remit?.RemittanceLines || [];

  return (
    <div className="page">
      <Link to="/claims" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Claims</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Claim {claim.claim_id}</h2>
        <StatusBadge status={claim.status} />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[
          { label: 'Patient', value: `${claim.patient_first_name || ''} ${claim.patient_last_name || ''}`.trim() || '—' },
          { label: 'Payer', value: claim.payer_name || '—' },
          { label: 'Total Charges', value: currency(claim.total_charge) },
          { label: 'Total Paid', value: currency(claim.total_paid) },
          { label: 'Service Dates', value: claim.service_date_start ? `${dateFmt(claim.service_date_start)} – ${dateFmt(claim.service_date_end) || ''}` : '—' },
        ].map((s, i) => (
          <div key={i} className="card stat-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {remit?.RemittanceFile && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">835 Payment Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1rem' }}>
            <div><strong>Payer:</strong> {remit.RemittanceFile.payer_name || '—'}</div>
            <div><strong>Payment:</strong> {currency(remit.RemittanceFile.total_payment)}</div>
            <div><strong>Payment Date:</strong> {dateFmt(remit.RemittanceFile.payment_date)}</div>
            <div><strong>Method:</strong> {remit.RemittanceFile.payment_method || '—'}</div>
            <div><strong>Trace #:</strong> {remit.RemittanceFile.trace_number || '—'}</div>
          </div>
        </div>
      )}

      {denials.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">Denial Reasons</div>
          <table className="table">
            <thead><tr><th>Code</th><th>Group</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {denials.map(d => (
                <tr key={d.id}><td style={{ fontFamily: 'monospace' }}>{d.denial_code}</td><td>{d.group_code || '—'}</td><td>{currency(d.amount)}</td><td>{d.Remittance?.remittance_date ? dateFmt(d.Remittance.remittance_date) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {claim.ClaimLines?.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">837 Billed Claim Lines</div>
          <table className="table">
            <thead><tr><th>Line #</th><th>Procedure</th><th>Charge</th><th>Service Date</th></tr></thead>
            <tbody>
              {claim.ClaimLines.map(l => (
                <tr key={l.id}>
                  <td>{l.line_number}</td>
                  <td style={{ fontFamily: 'monospace' }}>{l.procedure_code || '—'}</td>
                  <td>{currency(l.charge_amount)}</td>
                  <td>{dateFmt(l.service_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remitLines.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">835 Remittance Service Lines ({remitLines.length})</div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Procedure</th><th>Mod</th><th>Charge</th><th>Paid</th><th>Units</th>
                  <th>Service Date</th><th>Ref</th><th>Pt Liability</th><th>Adjustments</th></tr>
              </thead>
              <tbody>
                {remitLines.map(line => (
                  <tr key={line.id}>
                    <td>{line.line_number}</td>
                    <td style={{ fontFamily: 'monospace' }}>{line.procedure_code || '—'}</td>
                    <td>{line.modifier || '—'}</td>
                    <td>{currency(line.charge_amount)}</td>
                    <td>{currency(line.paid_amount)}</td>
                    <td>{line.unit_count || '1'}</td>
                    <td>{dateFmt(line.service_date)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{line.line_control_number || '—'}</td>
                    <td>{currency(line.patient_liability)}</td>
                    <td>
                      {line.DenialReasons?.length > 0 ? (
                        <div style={{ fontSize: '0.75rem' }}>
                          {line.DenialReasons.map(dr => (
                            <span key={dr.id} className="badge badge-error" style={{ marginRight: '0.25rem', marginBottom: '0.125rem', display: 'inline-block' }}>
                              {dr.denial_code} ${parseFloat(dr.amount || 0).toLocaleString()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="badge badge-success">Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
