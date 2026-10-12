export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 50;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name) {
  const value = name.trim();
  if (!value) return "Name cannot be empty";
  if (value.length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
  }
  return "";
}

export function validateEmail(email) {
  const value = email.trim();
  if (!value) return "Email cannot be empty";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address";
  return "";
}

export function validateNewPassword(password) {
  if (!password) return "Password cannot be empty";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return "";
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return "Please confirm your password";
  if (password !== confirmPassword) return "Passwords do not match";
  return "";
}