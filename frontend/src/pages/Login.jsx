import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../components/FormField";
import { api, saveToken, ApiError } from "../api";
import { validateEmail } from "../utils/validation";

function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const newErrors = {
      email: validateEmail(values.email),
      password: values.password ? "" : "Password cannot be empty",
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const data = await api.post(
        "/auth/login",
        {
          email: values.email.trim(),
          password: values.password,
          remember_me: rememberMe,
        },
        { auth: false }
      );
      saveToken(data.access_token, rememberMe);
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors || {});
        setFormError(error.detail);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth">
      <div className="container auth__inner">
        <div className="auth__form">
          <h1>Welcome back</h1>
          <p className="muted">Log in to continue.</p>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              id="email"
              label="Email"
              type="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="current-password"
            />

            <label className="auth__remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Keep me signed in on this device
            </label>

            {formError && (
              <p className="form-alert" role="alert">
                {formError}
              </p>
            )}

            <button type="submit" className="btn btn-block" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="auth__switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>

        <figure className="photo photo--landscape">
          <img
            src="/images/community.jpg"
            alt=""
            width="1200"
            height="800"
          />
        </figure>
      </div>
    </section>
  );
}

export default Login;