import bcrypt from "bcryptjs";

const saltRounds = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordPolicy(password: string, minimumLength = Number(process.env.PASSWORD_MIN_LENGTH ?? 10)) {
  const issues: string[] = [];
  if (password.length < minimumLength) issues.push(`Password must be at least ${minimumLength} characters.`);
  if (!/[A-Z]/.test(password)) issues.push("Password must include an uppercase letter.");
  if (!/[a-z]/.test(password)) issues.push("Password must include a lowercase letter.");
  if (!/[0-9]/.test(password)) issues.push("Password must include a number.");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("Password must include a symbol.");
  return issues;
}
