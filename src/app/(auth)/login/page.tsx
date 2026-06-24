import { LockKeyhole } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="login-page">
      <form className="login-box" method="post" action="/api/auth/login">
        <LockKeyhole size={28} color="#166f55" aria-hidden="true" />
        <h1>Leapfrog HR</h1>
        <p>Authorized access for HR, managers, finance, auditors, and employees.</p>
        <div className="grid">
          <label>
            Email
            <input className="field" name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input className="field" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button" type="submit">
            Sign in
          </button>
        </div>
      </form>
    </main>
  );
}

