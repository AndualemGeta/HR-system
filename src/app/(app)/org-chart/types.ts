export type DeptNode = {
  id: string;
  name: string;
  code: string;
  head: { id: string; employeeId: string; fullName: string; currentRole: string } | null;
  parentId: string | null;
  children: DeptNode[];
};

export type OrgNode = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  manager: { id: string; employeeId: string; fullName: string; currentRole: string } | null;
  children: OrgNode[];
};
