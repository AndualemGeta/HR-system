'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Department {
  id: string
  name: string
  code: string
  parentId: string | null
  headId: string | null
  head: { id: string; fullName: string; employeeId: string } | null
  isActive: boolean
}

interface Location {
  id: string
  name: string
  code: string
  type: string
  parentId: string | null
  managerId: string | null
  manager: { id: string; fullName: string; employeeId: string } | null
  isActive: boolean
}

export default function OrgChartPage() {
  const router = useRouter()
  const [rootDepts, setRootDepts] = useState<Department[]>([])
  const [childDepts, setChildDepts] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/org-chart')
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then(json => {
        setRootDepts(json.data.rootDepts)
        setChildDepts(json.data.childDepts)
        setLocations(json.data.locations)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const childrenOf = (parentId: string) => childDepts.filter(d => d.parentId === parentId)

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Organisation Chart</h1>
        <a href="/dashboard" style={{ color: '#2563eb' }}>Back to Dashboard</a>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Departments</h2>
      {rootDepts.length === 0 ? <p style={{ color: '#666' }}>No departments found</p> : null}
      {rootDepts.map(dept => (
        <OrgTreeNode
          key={dept.id}
          dept={dept}
          childrenDepts={childrenOf(dept.id)}
          allDepts={childDepts}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}

      <h2 style={{ fontSize: '1.1rem', margin: '2rem 0 0.5rem' }}>Locations</h2>
      {locations.length === 0 ? <p style={{ color: '#666' }}>No locations found</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {locations.map(loc => (
          <div key={loc.id} style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb' }}>
            <strong>{loc.name}</strong> ({loc.code}) - {loc.type}
            {loc.manager ? <span style={{ color: '#666', marginLeft: '0.5rem' }}>Manager: {loc.manager.fullName}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function OrgTreeNode({ dept, childrenDepts, allDepts, expanded, onToggle }: {
  dept: Department
  childrenDepts: Department[]
  allDepts: Department[]
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const isExpanded = expanded.has(dept.id)

  return (
    <div style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
      <div
        onClick={() => childrenDepts.length > 0 && onToggle(dept.id)}
        style={{
          padding: '0.5rem',
          background: '#f3f4f6',
          borderRadius: 4,
          cursor: childrenDepts.length > 0 ? 'pointer' : 'default',
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {childrenDepts.length > 0 ? <span>{isExpanded ? '▼' : '▶'}</span> : <span style={{ width: 16 }} />}
        <strong style={{ flex: 1 }}>{dept.name}</strong>
        <span style={{ color: '#666', fontSize: '0.85rem' }}>{dept.code}</span>
        {dept.head ? <span style={{ color: '#2563eb', fontSize: '0.85rem' }}>{dept.head.fullName}</span> : null}
      </div>

      {isExpanded && childrenDepts.map(child => {
        const grandChildren = allDepts.filter(d => d.parentId === child.id)
        return (
          <OrgTreeNode
            key={child.id}
            dept={child}
            childrenDepts={grandChildren}
            allDepts={allDepts}
            expanded={expanded}
            onToggle={onToggle}
          />
        )
      })}
    </div>
  )
}
