import React, { useRef, useState } from 'react';

export default function FileUploadZone({ onUpload, accept, label }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  return (
    <div
      className={`upload-zone ${dragging ? 'dragover' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>or click to browse</p>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }} />
    </div>
  );
}
