-- Apply the Phase 3 disciplinary default after the enum value has committed.
ALTER TABLE "DisciplinaryRecord" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
