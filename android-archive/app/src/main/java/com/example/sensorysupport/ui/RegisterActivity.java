package com.example.sensorysupport.ui;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Patterns;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.example.sensorysupport.R;

public class RegisterActivity extends AppCompatActivity {

    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MAX_NAME_LENGTH = 50;

    private TextInputLayout tilName, tilEmail, tilPassword, tilConfirmPassword;
    private TextInputEditText etName, etEmail, etPassword, etConfirmPassword;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        tilName = findViewById(R.id.tilName);
        tilEmail = findViewById(R.id.tilEmail);
        tilPassword = findViewById(R.id.tilPassword);
        tilConfirmPassword = findViewById(R.id.tilConfirmPassword);
        etName = findViewById(R.id.etName);
        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        etConfirmPassword = findViewById(R.id.etConfirmPassword);
        Button btnRegister = findViewById(R.id.btnRegister);
        TextView tvGoToLogin = findViewById(R.id.tvGoToLogin);

        btnRegister.setOnClickListener(v -> attemptRegister());

        tvGoToLogin.setOnClickListener(v -> {
            startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
            finish();
        });
    }

    private void attemptRegister() {
        tilName.setError(null);
        tilEmail.setError(null);
        tilPassword.setError(null);
        tilConfirmPassword.setError(null);

        String name = textOf(etName);
        String email = textOf(etEmail);
        String password = textOf(etPassword);
        String confirmPassword = textOf(etConfirmPassword);

        boolean isValid = true;

        if (TextUtils.isEmpty(name)) {
            tilName.setError(getString(R.string.error_name_empty));
            isValid = false;
        } else if (name.length() > MAX_NAME_LENGTH) {
            tilName.setError("Name is too long");
            isValid = false;
        }

        if (TextUtils.isEmpty(email)) {
            tilEmail.setError(getString(R.string.error_email_empty));
            isValid = false;
        } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tilEmail.setError(getString(R.string.error_email_invalid));
            isValid = false;
        }

        if (TextUtils.isEmpty(password)) {
            tilPassword.setError(getString(R.string.error_password_empty));
            isValid = false;
        } else if (password.length() < MIN_PASSWORD_LENGTH) {
            tilPassword.setError(getString(R.string.error_password_short));
            isValid = false;
        }

        if (!TextUtils.isEmpty(password) && !password.equals(confirmPassword)) {
            tilConfirmPassword.setError(getString(R.string.error_password_mismatch));
            isValid = false;
        }

        if (!isValid) return;

        // TODO Phase 4: replace with real API call to POST /auth/register
        // For now, this confirms validation works.
    }

    private String textOf(TextInputEditText field) {
        return field.getText() != null ? field.getText().toString().trim() : "";
    }
}