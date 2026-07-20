'use client'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }
const errStyle: React.CSSProperties = { color: '#dc2626', fontSize: '0.8rem', marginTop: '0.15rem' }

export default function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: 'red', marginLeft: '0.15rem' }}>*</span>}
      </label>
      {children}
      {error && <p style={errStyle} role="alert">{error}</p>}
    </div>
  )
}
