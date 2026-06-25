import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";
import {
  exitItems,
  onboardingItems,
  permissionKeys,
  rolePermissions,
  systemRoles
} from "../src/lib/constants";
import { defaultRequiredDocumentRules } from "../src/lib/required-document-rules";

const prisma = new PrismaClient();

async function main() {
  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key }
    });
  }

  for (const roleName of systemRoles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: roleName.replace(/_/g, " ") }
    });

    const permissions = rolePermissions[roleName] ?? [];
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: {
          key: {
            notIn: permissions
          }
        }
      }
    });

    for (const permissionKey of permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  const departments = await seedDepartments();
  const locations = await seedLocations();
  const employees = await seedEmployees(departments, locations);
  await seedUsers(employees);
  await seedOrganization(employees);
  await seedLifecycleData(employees, departments, locations);
  await seedPhase45PayrollRules();
  await seedRequiredDocumentRules();
}

async function seedDepartments() {
  const executive = await prisma.department.upsert({
    where: { code: "EXEC" },
    update: {},
    create: { code: "EXEC", name: "Executive Office" }
  });
  const sales = await prisma.department.upsert({
    where: { code: "SALES" },
    update: {},
    create: { code: "SALES", name: "Sales", parentId: executive.id }
  });
  const finance = await prisma.department.upsert({
    where: { code: "FIN" },
    update: {},
    create: { code: "FIN", name: "Finance", parentId: executive.id }
  });
  const hr = await prisma.department.upsert({
    where: { code: "HR" },
    update: {},
    create: { code: "HR", name: "Human Resources", parentId: executive.id }
  });
  const distribution = await prisma.department.upsert({
    where: { code: "DIST" },
    update: {},
    create: { code: "DIST", name: "Distribution", parentId: executive.id }
  });
  const technology = await prisma.department.upsert({
    where: { code: "TECH" },
    update: {},
    create: { code: "TECH", name: "Technology", parentId: executive.id }
  });

  return { executive, sales, finance, hr, distribution, technology };
}

async function seedLocations() {
  const field = await prisma.location.upsert({
    where: { code: "DIV-FIELD" },
    update: {},
    create: { code: "DIV-FIELD", name: "Field Sales", type: "DIVISION" }
  });
  const headOffice = await prisma.location.upsert({
    where: { code: "DIV-HO" },
    update: {},
    create: { code: "DIV-HO", name: "Head Office", type: "DIVISION" }
  });
  const addis = await prisma.location.upsert({
    where: { code: "REG-ADDIS" },
    update: {},
    create: { code: "REG-ADDIS", name: "Addis Ababa", type: "REGION", parentId: field.id }
  });
  const bole = await prisma.location.upsert({
    where: { code: "SHOP-BOLE" },
    update: {},
    create: { code: "SHOP-BOLE", name: "Bole Shop", type: "SHOP", parentId: addis.id }
  });
  const clusterA = await prisma.location.upsert({
    where: { code: "CLU-BOLE-A" },
    update: {},
    create: { code: "CLU-BOLE-A", name: "Bole Cluster A", type: "CLUSTER", parentId: bole.id }
  });
  const clusterB = await prisma.location.upsert({
    where: { code: "CLU-BOLE-B" },
    update: {},
    create: { code: "CLU-BOLE-B", name: "Bole Cluster B", type: "CLUSTER", parentId: bole.id }
  });

  return { field, headOffice, addis, bole, clusterA, clusterB };
}

async function seedEmployees(
  departments: Awaited<ReturnType<typeof seedDepartments>>,
  locations: Awaited<ReturnType<typeof seedLocations>>
) {
  const ceo = await prisma.employee.upsert({
    where: { employeeId: "LSTA_0001" },
    update: {},
    create: {
      employeeId: "LSTA_0001",
      firstName: "Amanuel",
      lastName: "Tesfaye",
      fullName: "Amanuel Tesfaye",
      email: "ceo@leapfrog.local",
      employmentType: "FULL_TIME",
      employmentStatus: "ACTIVE",
      currentRole: "CEO",
      currentLevel: "EXECUTIVE",
      currentDepartmentId: departments.executive.id,
      currentDivisionId: locations.headOffice.id,
      hireDate: new Date("2022-01-01")
    }
  });

  const hrManager = await prisma.employee.upsert({
    where: { employeeId: "LSTA_0002" },
    update: {},
    create: {
      employeeId: "LSTA_0002",
      firstName: "Selam",
      lastName: "Tadesse",
      fullName: "Selam Tadesse",
      email: "hr.manager@leapfrog.local",
      employmentType: "FULL_TIME",
      employmentStatus: "ACTIVE",
      currentRole: "HR_MANAGER",
      currentLevel: "MANAGER",
      currentDepartmentId: departments.hr.id,
      currentDivisionId: locations.headOffice.id,
      directManagerId: ceo.id,
      currentEvaluatorId: ceo.id,
      hireDate: new Date("2023-02-01")
    }
  });

  const salesHead = await prisma.employee.upsert({
    where: { employeeId: "LSTA_0003" },
    update: {},
    create: {
      employeeId: "LSTA_0003",
      firstName: "Dawit",
      lastName: "Alemu",
      fullName: "Dawit Alemu",
      email: "sales.head@leapfrog.local",
      employmentType: "FULL_TIME",
      employmentStatus: "ACTIVE",
      currentRole: "SALES_HEAD",
      currentLevel: "DIRECTOR",
      currentDepartmentId: departments.sales.id,
      currentDivisionId: locations.field.id,
      directManagerId: ceo.id,
      currentEvaluatorId: ceo.id,
      hireDate: new Date("2023-04-01")
    }
  });

  const shopManager = await prisma.employee.upsert({
    where: { employeeId: "LSTA_0004" },
    update: {},
    create: {
      employeeId: "LSTA_0004",
      firstName: "Mekdes",
      lastName: "Bekele",
      fullName: "Mekdes Bekele",
      email: "shop.manager@leapfrog.local",
      employmentType: "FULL_TIME",
      employmentStatus: "ON_PROBATION",
      probationStatus: "IN_PROGRESS",
      currentRole: "SHOP_MANAGER",
      currentLevel: "MANAGER",
      currentDepartmentId: departments.sales.id,
      currentDivisionId: locations.field.id,
      currentRegionId: locations.addis.id,
      currentShopId: locations.bole.id,
      directManagerId: salesHead.id,
      currentEvaluatorId: salesHead.id,
      hireDate: new Date("2025-12-01")
    }
  });

  const dsa = await prisma.employee.upsert({
    where: { employeeId: "LSTA_0005" },
    update: {},
    create: {
      employeeId: "LSTA_0005",
      firstName: "Yonatan",
      lastName: "Tesfaye",
      fullName: "Yonatan Tesfaye",
      email: "dsa@leapfrog.local",
      employmentType: "COMMISSION_BASED",
      employmentStatus: "ONBOARDING",
      currentRole: "DSA",
      currentLevel: "JUNIOR",
      currentDepartmentId: departments.sales.id,
      currentDivisionId: locations.field.id,
      currentRegionId: locations.addis.id,
      currentShopId: locations.bole.id,
      currentClusterId: locations.clusterA.id,
      directManagerId: shopManager.id,
      currentEvaluatorId: shopManager.id,
      hireDate: new Date("2026-06-01")
    }
  });

  return { ceo, hrManager, salesHead, shopManager, dsa };
}

async function seedUsers(employees: Awaited<ReturnType<typeof seedEmployees>>) {
  const passwordHash = await hashPassword("ChangeMe123!");
  const users = [
    ["super.admin@leapfrog.local", "Super Admin", "SUPER_ADMIN", employees.ceo.id],
    ["hr.admin@leapfrog.local", "HR Admin", "HR_ADMIN", employees.hrManager.id],
    ["sales.head@leapfrog.local", "Sales Head", "SALES_HEAD", employees.salesHead.id],
    ["shop.manager@leapfrog.local", "Shop Manager", "SHOP_MANAGER", employees.shopManager.id],
    ["finance@leapfrog.local", "Finance Payroll", "FINANCE_PAYROLL", null],
    ["auditor@leapfrog.local", "Auditor", "AUDITOR", null]
  ] as const;

  for (const [email, name, roleName, employeeId] of users) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name,
        passwordHash,
        employeeId,
        roles: {
          create: {
            roleId: role.id
          }
        }
      }
    });
  }
}

async function seedOrganization(employees: Awaited<ReturnType<typeof seedEmployees>>) {
  const company = await prisma.organizationUnit.upsert({
    where: { code: "LSTA" },
    update: { managerId: employees.ceo.id },
    create: { code: "LSTA", name: "Leapfrog Software Technology Africa PLC", type: "COMPANY", managerId: employees.ceo.id }
  });

  const createUnit = async (
    code: string,
    name: string,
    type: "EXECUTIVE_OFFICE" | "DIVISION" | "DEPARTMENT" | "TEAM" | "UNIT",
    parentId: string,
    managerId?: string | null
  ) =>
    prisma.organizationUnit.upsert({
      where: { code },
      update: { parentId, managerId: managerId ?? null },
      create: { code, name, type, parentId, managerId: managerId ?? null }
    });

  await createUnit("CEO-COORD", "CEO Coordinator", "EXECUTIVE_OFFICE", company.id, employees.ceo.id);
  const sales = await createUnit("SALES-HEAD", "Sales Head", "DIVISION", company.id, employees.salesHead.id);
  const areaSales = await createUnit("AREA-SALES-MGR", "Area Sales Manager", "TEAM", sales.id, employees.salesHead.id);
  const shopManager = await createUnit("SHOP-MGR", "Shop Manager", "UNIT", areaSales.id, employees.shopManager.id);
  await createUnit("SHOP-EMPLOYEES", "Shop Employees", "UNIT", shopManager.id);

  const distribution = await createUnit("DIST-MGR", "Distribution Manager", "DIVISION", company.id);
  await createUnit("DIST-OFFICER", "Distribution Officer", "UNIT", distribution.id);

  const finance = await createUnit("FIN-DIR", "Finance Director", "DIVISION", company.id);
  const treasury = await createUnit("TREASURY-MGR", "Treasury Manager", "DEPARTMENT", finance.id);
  const accountants = await createUnit("ACCOUNTANTS", "Accountants", "TEAM", treasury.id);
  await createUnit("SHOP-ACCOUNTANTS", "Shop Accountants", "UNIT", accountants.id);
  await createUnit("FCR-MGR", "Financial Control and Reporting Manager", "DEPARTMENT", finance.id);

  const hr = await createUnit("HR-MGR", "HR Manager", "DEPARTMENT", company.id, employees.hrManager.id);
  await createUnit("HR-OFFICER", "HR Officer", "UNIT", hr.id);

  await createUnit("TECH-MGR", "Technology Manager", "DIVISION", company.id);
}

async function seedLifecycleData(
  employees: Awaited<ReturnType<typeof seedEmployees>>,
  departments: Awaited<ReturnType<typeof seedDepartments>>,
  locations: Awaited<ReturnType<typeof seedLocations>>
) {
  for (const employee of Object.values(employees)) {
    const activeAssignment = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId: employee.id,
        endDate: null
      }
    });

    if (!activeAssignment) {
      await prisma.employeeAssignment.create({
        data: {
          employeeId: employee.id,
          divisionId: employee.currentDivisionId,
          departmentId: employee.currentDepartmentId,
          regionId: employee.currentRegionId,
          shopId: employee.currentShopId,
          clusterId: employee.currentClusterId,
          role: employee.currentRole,
          level: employee.currentLevel,
          directManagerId: employee.directManagerId,
          evaluatorId: employee.currentEvaluatorId,
          startDate: employee.hireDate ?? new Date(),
          reason: "Seed assignment"
        }
      });
    }

    await prisma.employeeStatusHistory.create({
      data: {
        employeeId: employee.id,
        previousStatus: null,
        newStatus: employee.employmentStatus,
        reason: "Seed status",
        effectiveDate: employee.hireDate ?? new Date(),
        approvalStatus: "APPROVED"
      }
    }).catch(() => undefined);
  }

  for (const employee of Object.values(employees)) {
    const completed = employee.id !== employees.dsa.id;
    await prisma.onboardingChecklist.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        status: completed ? "APPROVED" : "PENDING",
        completedAt: completed ? new Date() : null,
        items: {
          create: onboardingItems.map(([key, label], index) => ({
            key,
            label,
            completed: completed || index < 6,
            completedAt: completed || index < 6 ? new Date() : null
          }))
        }
      }
    });
  }

  await prisma.employeeEvaluation.create({
    data: {
      employeeId: employees.shopManager.id,
      evaluatorId: employees.salesHead.id,
      evaluationPeriodStart: new Date("2026-04-01"),
      evaluationPeriodEnd: new Date("2026-06-30"),
      evaluationType: "QUARTERLY_PERFORMANCE_REVIEW",
      score: 84,
      rating: "Meets expectations",
      status: "SUBMITTED",
      submittedDate: new Date()
    }
  }).catch(() => undefined);

  const existingSalary = await prisma.employeeSalary.findFirst({
    where: {
      employeeId: employees.shopManager.id,
      effectiveDate: new Date("2026-01-01")
    }
  });

  if (!existingSalary) {
    await prisma.employeeSalary.create({
      data: {
        employeeId: employees.shopManager.id,
        basicSalary: 42000,
        effectiveDate: new Date("2026-01-01"),
        reason: "Seed salary record"
      }
    });
  }

  const existingContract = await prisma.employeeDocument.findFirst({
    where: {
      employeeId: employees.shopManager.id,
      documentType: "CONTRACT",
      originalFilename: "sample-contract.pdf"
    }
  });

  if (!existingContract) {
    await prisma.employeeDocument.create({
      data: {
        employeeId: employees.shopManager.id,
        documentType: "CONTRACT",
        filePath: "seed/sample-contract.pdf",
        originalFilename: "sample-contract.pdf",
        uploadedById: null,
        visibilityLevel: "PUBLIC_TO_HR",
        notes: "Safe sample document placeholder"
      }
    });
  }

  const existingSalaryDocument = await prisma.employeeDocument.findFirst({
    where: {
      employeeId: employees.shopManager.id,
      documentType: "SALARY_DOCUMENT",
      originalFilename: "sample-salary-note.pdf"
    }
  });

  if (!existingSalaryDocument) {
    await prisma.employeeDocument.create({
      data: {
        employeeId: employees.shopManager.id,
        documentType: "SALARY_DOCUMENT",
        filePath: "seed/sample-salary-note.pdf",
        originalFilename: "sample-salary-note.pdf",
        visibilityLevel: "SALARY_RESTRICTED",
        notes: "Safe sample salary document placeholder"
      }
    });
  }

  const existingLeave = await prisma.leaveRecord.findFirst({
    where: {
      employeeId: employees.shopManager.id,
      startDate: new Date("2026-07-01")
    }
  });

  if (!existingLeave) {
    await prisma.leaveRecord.create({
      data: {
        employeeId: employees.shopManager.id,
        leaveType: "ANNUAL",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-05"),
        totalDays: 5,
        reason: "Seed annual leave",
        approvalStatus: "SUBMITTED"
      }
    });
  }

  const criteria = [
    ["Sales performance", "Sales target achievement", "DSA", null],
    ["Attendance", "Attendance and punctuality", null, null],
    ["Customer service", "Customer experience quality", "SHOP_MANAGER", null],
    ["Financial control", "Finance and compliance quality", null, departments.finance.id],
    ["Technology support", "System support and compliance", "TECHNOLOGY_MANAGER", departments.technology.id],
    ["HR process compliance", "HR workflow quality", "HR_OFFICER", departments.hr.id]
  ] as const;

  for (const [name, description, applicableRole, departmentId] of criteria) {
    await prisma.evaluationCriteria.create({
      data: {
        name,
        description,
        applicableRole,
        applicableDepartmentId: departmentId,
        weight: 1,
        maxScore: 100
      }
    }).catch(() => undefined);
  }

  await prisma.achievement.create({
    data: {
      employeeId: employees.shopManager.id,
      achievementType: "CUSTOMER_SERVICE_RECOGNITION",
      title: "High customer service score",
      description: "Recognized for shop service quality.",
      achievementDate: new Date("2026-05-15"),
      divisionId: locations.field.id,
      departmentId: departments.sales.id,
      regionId: locations.addis.id,
      shopId: locations.bole.id,
      approvalStatus: "APPROVED"
    }
  }).catch(() => undefined);

  await prisma.terminationCase.create({
    data: {
      employeeId: employees.dsa.id,
      terminationType: "OTHER",
      reason: "Seed exit workflow draft",
      approvalStatus: "DRAFT",
      exitItems: {
        create: exitItems.map(([key, label]) => ({ key, label }))
      }
    }
  }).catch(() => undefined);
}

async function seedPhase45PayrollRules() {
  const start = new Date("2026-01-01");
  const payrollRules = [
    { ruleType: "WORKING_DAYS_DEFAULT" as const, name: "Development default working days", value: "22", amount: 22 },
    { ruleType: "OVERTIME_SUNDAY_RATE" as const, name: "Development Sunday overtime rate", rate: 2 },
    { ruleType: "OVERTIME_HOLIDAY_RATE" as const, name: "Development holiday overtime rate", rate: 2.5 },
    { ruleType: "OVERTIME_NIGHT_RATE" as const, name: "Development night overtime rate", rate: 1.5 }
  ];

  for (const rule of payrollRules) {
    const existing = await prisma.payrollRule.findFirst({ where: { ruleType: rule.ruleType, name: rule.name } });
    if (!existing) {
      await prisma.payrollRule.create({
        data: {
          ...rule,
          description: "Safe sample configuration for local development only. Finance/HR must verify before production payroll use.",
          effectiveStartDate: start,
          activeStatus: true,
          approvalStatus: "DRAFT",
          isSample: true,
          changeReason: "Seeded sample only; HR/Finance must verify before production payroll use."
        }
      });
    } else if (!existing.isSample) {
      await prisma.payrollRule.update({
        where: { id: existing.id },
        data: { isSample: true, approvalStatus: "DRAFT", changeReason: "Seeded sample only; HR/Finance must verify before production payroll use." }
      });
    }
  }

  const samplePaye = [
    { name: "Development PAYE 0", minIncome: 0, maxIncome: 600, taxRate: 0, deductionAmount: 0 },
    { name: "Development PAYE 10", minIncome: 600.01, maxIncome: 1650, taxRate: 0.1, deductionAmount: 60 },
    { name: "Development PAYE 15", minIncome: 1650.01, maxIncome: null, taxRate: 0.15, deductionAmount: 142.5 }
  ];

  for (const bracket of samplePaye) {
    const existing = await prisma.payeTaxBracket.findFirst({ where: { name: bracket.name } });
    if (!existing) {
      await prisma.payeTaxBracket.create({
        data: {
          ...bracket,
          effectiveStartDate: start,
          activeStatus: true,
          approvalStatus: "DRAFT",
          isSample: true,
          changeReason: "Seeded sample only; HR/Finance must verify before production payroll use."
        }
      });
    } else if (!existing.isSample) {
      await prisma.payeTaxBracket.update({
        where: { id: existing.id },
        data: { isSample: true, approvalStatus: "DRAFT", changeReason: "Seeded sample only; HR/Finance must verify before production payroll use." }
      });
    }
  }

  const existingPension = await prisma.pensionRule.findFirst({ where: { name: "Development standard pension" } });
  if (!existingPension) {
    await prisma.pensionRule.create({
      data: {
        name: "Development standard pension",
        employeeRate: 0.07,
        employerRate: 0.11,
        effectiveStartDate: start,
        activeStatus: true,
        approvalStatus: "DRAFT",
        isSample: true,
        changeReason: "Seeded sample only; HR/Finance must verify before production payroll use."
      }
    });
  } else if (!existingPension.isSample) {
    await prisma.pensionRule.update({
      where: { id: existingPension.id },
      data: { isSample: true, approvalStatus: "DRAFT", changeReason: "Seeded sample only; HR/Finance must verify before production payroll use." }
    });
  }
}

async function seedRequiredDocumentRules() {
  for (const rule of defaultRequiredDocumentRules) {
    const existing = await prisma.requiredDocumentRule.findFirst({
      where: {
        name: rule.name,
        documentType: rule.documentType as never,
        applicableEmploymentType: rule.applicableEmploymentType ?? null,
        applicableRole: rule.applicableRole ?? null
      }
    });
    if (!existing) {
      await prisma.requiredDocumentRule.create({
        data: {
          name: rule.name,
          documentType: rule.documentType as never,
          applicableEmploymentType: rule.applicableEmploymentType ?? null,
          applicableRole: rule.applicableRole ?? null,
          applicableDepartmentId: rule.applicableDepartmentId ?? null,
          applicableDivisionId: rule.applicableDivisionId ?? null,
          isRequired: rule.isRequired,
          activeStatus: rule.activeStatus
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
