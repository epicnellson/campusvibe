import { FormEvent, useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for the login link!");
    }
  };

  return (
    <div style={container}>
      <form onSubmit={handleLogin} style={form}>
        <h1 style={{ marginBottom: 8 }}>CampusVibe Admin</h1>
        <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
          Sign in with your campus email to manage reported content.
        </p>

        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />

        <button type="submit" style={button}>
          Send Magic Link
        </button>

        {message && <p style={{ color: "#208AEF" }}>{message}</p>}
        {error && <p style={{ color: "#ff4444" }}>{error}</p>}
      </form>
    </div>
  );
}

const container: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  backgroundColor: "#f5f5f5",
};

const form: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  padding: 40,
  borderRadius: 12,
  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  maxWidth: 400,
  width: "100%",
};

const input: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 15,
  border: "1px solid #ddd",
  borderRadius: 8,
  marginBottom: 16,
};

const button: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 15,
  fontWeight: 600,
  color: "#fff",
  backgroundColor: "#208AEF",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
