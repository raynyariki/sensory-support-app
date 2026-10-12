import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../components/FormField";
import { validateEmail } from "../utils/validation";

function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const newErrors = {
      email: validateEmail(values.email),
      password: values.password ? "" : "Password cannot be empty",
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) return;

    // Later: send the values to POST /auth/login on the backend.
    navigate("/dashboard");
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
            <button type="submit" className="btn btn-block">
              Log in
            </button>
          </form>

          <p className="auth__switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>

        <figure className="photo photo--landscape">
          <img
            src="/images/community.jpg"
            alt="Describe this photo here"
            width="1200"
            height="800"
          />
        </figure>
      </div>
    </section>
  );
}

export default Login;