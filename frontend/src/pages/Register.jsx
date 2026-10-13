import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../components/FormField";
import { saveAccount } from "../utils/account";
import {
  MAX_NAME_LENGTH,
  validateName,
  validateEmail,
  validateNewPassword,
  validateConfirmPassword,
} from "../utils/validation";

function Register() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const newErrors = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      password: validateNewPassword(values.password),
      confirmPassword: validateConfirmPassword(
        values.password,
        values.confirmPassword
      ),
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) return;

    // Later: send the values to POST /auth/register on the backend.
    saveAccount({ name: values.name.trim(), email: values.email.trim() });
    navigate("/setup");
  }

  return (
    <section className="auth">
      <div className="container auth__inner">
        <div className="auth__form">
          <h1>Create your account</h1>
          <p className="muted">
            We only ask for what we need: a name, an email and a password.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              id="name"
              label="Name"
              value={values.name}
              onChange={handleChange}
              error={errors.name}
              autoComplete="name"
              maxLength={MAX_NAME_LENGTH + 10}
            />
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
              label="Password (at least 8 characters)"
              type="password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="new-password"
            />
            <FormField
              id="confirmPassword"
              label="Confirm password"
              type="password"
              value={values.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
            <button type="submit" className="btn btn-block">
              Create account
            </button>
          </form>

          <p className="auth__switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>

        <figure className="photo photo--portrait">
          <img
            src="/images/hero.jpg"
            alt="Describe this photo here"
            width="800"
            height="1000"
          />
        </figure>
      </div>
    </section>
  );
}

export default Register;