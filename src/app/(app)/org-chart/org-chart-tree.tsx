"use client";

import { useState } from "react";
import type { DeptNode, OrgNode } from "./types";

type Employee = {
  id: string;
  employeeId: string;
  fullName: string;
  currentRole: string;
  currentDepartmentId: string | null;
  directManagerId: string | null;
};

export function OrgChartTree({
  departments,
  orgUnits,
  employees
}: {
  departments: DeptNode[];
  orgUnits: OrgNode[];
  employees: Employee[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(departments.map((d) => d.id)));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const rootDepts = departments.filter((d) => !d.parentId);

  return (
    <div className="grid two">
      <section className="panel">
        <div className="panel-header">
          <h3>Departments</h3>
          <span>{departments.length} total</span>
        </div>
        <div className="tree">
          {rootDepts.map((dept) => (
            <OrgNodeView key={dept.id} node={dept} expanded={expanded} onToggle={toggle} employees={employees} />
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h3>Divisions &amp; Regions</h3>
          <span>{orgUnits.length} top-level</span>
        </div>
        <div className="tree">
          {orgUnits.map((unit) => (
            <OrgUnitView key={unit.id} node={unit} expanded={expanded} onToggle={toggle} />
          ))}
          {orgUnits.length === 0 && <p style={{ padding: 12, color: "#777" }}>No organization units configured.</p>}
        </div>
      </section>
    </div>
  );
}

function OrgNodeView({
  node,
  expanded,
  onToggle,
  employees,
  depth = 0
}: {
  node: DeptNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  employees: Employee[];
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const teamMembers = employees.filter((e) => e.currentDepartmentId === node.id && e.directManagerId === node.head?.id);

  return (
    <div className="tree-node" style={{ marginLeft: depth * 20 }}>
      <div className="tree-node-header" onClick={() => onToggle(node.id)}>
        {hasChildren ? <span className="tree-toggle">{isOpen ? "▾" : "▸"}</span> : <span className="tree-toggle" style={{ visibility: "hidden" }}>▸</span>}
        <div className="tree-node-info">
          <strong>{node.name}</strong>
          <span className="tree-node-meta">{node.code}</span>
        </div>
      </div>
      {node.head && (
        <div className="tree-node-person" style={{ marginLeft: 20, marginTop: 4, marginBottom: 4 }}>
          <span className="badge" style={{ fontSize: 12 }}>{node.head.fullName}</span>
          <span style={{ fontSize: 12, color: "#777", marginLeft: 8 }}>{node.head.currentRole}</span>
        </div>
      )}
      {teamMembers.length > 0 && (
        <div className="tree-node-team" style={{ marginLeft: 20 }}>
          {teamMembers.slice(0, 5).map((member) => (
            <div key={member.id} className="tree-node-person" style={{ fontSize: 12, color: "#555", padding: "2px 0" }}>
              {member.fullName} — {member.currentRole}
            </div>
          ))}
          {teamMembers.length > 5 && (
            <div style={{ fontSize: 11, color: "#999", padding: "2px 0" }}>+ {teamMembers.length - 5} more</div>
          )}
        </div>
      )}
      {isOpen && hasChildren && (
        <div className="tree-children">
          {node.children.map((child) => (
            <OrgNodeView key={child.id} node={child} expanded={expanded} onToggle={onToggle} employees={employees} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgUnitView({
  node,
  expanded,
  onToggle,
  depth = 0
}: {
  node: OrgNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

  return (
    <div className="tree-node" style={{ marginLeft: depth * 20 }}>
      <div className="tree-node-header" onClick={() => onToggle(node.id)}>
        {hasChildren ? <span className="tree-toggle">{isOpen ? "▾" : "▸"}</span> : <span className="tree-toggle" style={{ visibility: "hidden" }}>▸</span>}
        <div className="tree-node-info">
          <strong>{node.name}</strong>
          <span className="tree-node-meta">{node.type}</span>
        </div>
      </div>
      {node.manager && (
        <div className="tree-node-person" style={{ marginLeft: 20, marginTop: 4, marginBottom: 4 }}>
          <span className="badge" style={{ fontSize: 12 }}>{node.manager.fullName}</span>
          <span style={{ fontSize: 12, color: "#777", marginLeft: 8 }}>{node.manager.currentRole}</span>
        </div>
      )}
      {isOpen && hasChildren && (
        <div className="tree-children">
          {node.children.map((child) => (
            <OrgUnitView key={child.id} node={child} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
