import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { remittancesApi } from '../services/remittances.api';
import StatusBadge from '../components/StatusBadge';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';
const dateFmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

export default function RemittanceDetail() {
  const { id } = useParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    remittancesApi.get(id)
      .then(res => setFile(res.data.file))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>;
  if (!file) return <div className="page"><p>Remittance file not found.</p><Link to="/remittances">Back</Link></div>;

  return (
    <div className="page">
      <Link to="/remittances" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Remittances</Link>

      <h2 className="page-title" style={{ marginBottom: '1.5rem' }}>
        {file.filename || 'Remittance File'}
      </h2>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">Payment &amp; EFT Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1rem' }}>
          <div><strong>Total Payment:</strong> {currency(file.total_payment)}</div>
          <div><strong>Payment Method:</strong> {file.payment_method || '—'}</div>
          <div><strong>Payment Date:</strong> {dateFmt(file.payment_date)}</div>
          <div><strong>Trace Number:</strong> {file.trace_number || '—'}</div>
          <div><strong>Sender Bank:</strong> {file.sender_bank_id || '—'}</div>
          <div><strong>Sender Account:</strong> {file.sender_account || '—'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">Payer &amp; Payee</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', padding: '1rem' }}>
          <div><strong>Payer:</strong> {file.payer_name || '—'}</div>
          <div><strong>Payer ID:</strong> {file.payer_id_code || '—'}</div>
          <div><strong>Payee:</strong> {file.payee_name || '—'}</div>
          <div><strong>Payee ID:</strong> {file.payee_id_code || '—'}</div>
          <div><strong>Payee Tax ID:</strong> {file.payee_tax_id || '—'}</div>
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Remittances &mdash; {file.Remittances?.length || 0} claims</h3>

      {file.Remittances?.map((remit) => (
        <div key={remit.id} className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{remit.payer_claim_id || 'Unknown Claim'}</span>
            <StatusBadge status={remit.status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div><strong>Patient:</strong> {`${remit.patient_first_name || ''} ${remit.patient_last_name || ''}`.trim() || '—'}</div>
            <div><strong>Member ID:</strong> {remit.patient_member_id || '—'}</div>
            <div><strong>Subscriber:</strong> {remit.subscriber_id || '—'}</div>
            <div><strong>Total Charge:</strong> {currency(remit.total_charge)}</div>
            <div><strong>Total Paid:</strong> {currency(remit.total_paid)}</div>
            <div><strong>Adjustment:</strong> {currency(remit.adjustment_amount)}</div>
            <div><strong>Rendering Provider:</strong> {remit.rendering_provider_name || '—'}</div>
            <div><strong>Billing Provider:</strong> {remit.billing_provider_name || '—'}</div>
            <div><strong>Service Date:</strong> {remit.service_date_from ? `${dateFmt(remit.service_date_from)} – ${dateFmt(remit.service_date_to) || ''}` : '—'}</div>
          </div>

          {remit.DenialReasons?.length > 0 && (
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <strong style={{ fontSize: '0.8125rem' }}>Claim-Level Adjustments</strong>
              <table className="table" style={{ marginTop: '0.5rem' }}>
                <thead><tr><th>Code</th><th>Group</th><th>Amount</th></tr></thead>
                <tbody>
                  {remit.DenialReasons.map(dr => (
                    <tr key={dr.id}><td style={{ fontFamily: 'monospace' }}>{dr.denial_code}</td><td>{dr.group_code}</td><td>{currency(dr.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {remit.RemittanceLines?.length > 0 && (
            <div style={{ padding: '0.75rem' }}>
              <strong style={{ fontSize: '0.8125rem' }}>Service Lines ({remit.RemittanceLines.length})</strong>
              <div className="table-responsive" style={{ marginTop: '0.5rem' }}>
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Procedure</th><th>Mod</th><th>Charge</th><th>Paid</th><th>Units</th>
                      <th>Service Date</th><th>Ref</th><th>Pt Liability</th><th>Adjustments</th></tr>
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
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{line.line_control_number || '—'}</td>
                        <td>{currency(line.patient_liability)}</td>
                        <td>
                          {line.DenialReasons?.length > 0 ? (
                            <div style={{ fontSize: '0.75rem' }}>
                              {line.DenialReasons.map(dr => (
                                <span key={dr.id} className="badge badge-error" style={{ marginRight: '0.25rem' }}>
                                  {dr.denial_code} ${parseFloat(dr.amount || 0).toLocaleString()}
                                </span>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
