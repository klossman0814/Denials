import React from 'react';

const statusColors = {
  paid: 'badge-paid', denied: 'badge-denied', partial: 'badge-partial',
  submitted: 'badge-submitted', pending: 'badge-pending',
  parsed: 'badge-paid', parsing: 'badge-partial', error: 'badge-denied',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${statusColors[status?.toLowerCase()] || 'badge-pending'}`}>{status || 'unknown'}</span>;
}
