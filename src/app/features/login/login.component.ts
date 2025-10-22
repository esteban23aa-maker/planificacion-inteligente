import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);


  loading = false;
  error: string | null = null;


  form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    remember: [true]
  });


  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const { username, password, remember } = this.form.value as any;
    this.auth.login({ username, password }, remember).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (e) => {
        this.loading = false;
        this.error = (e?.error?.message || 'Credenciales inválidas');
      }
    });
  }
}
