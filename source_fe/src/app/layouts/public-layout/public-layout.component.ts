import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-layout.component.html',
  styles: [`
    .public-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #0f172a;
      color: #f8fafc;
      font-family: 'Inter', sans-serif;
    }

    .public-navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 4rem;
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .public-navbar__brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--color-primary), #8b5cf6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 1.25rem;
    }

    .logo-text {
      font-size: 1.25rem;
      font-weight: 700;
      background: linear-gradient(to right, #fff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .public-navbar__links {
      display: flex;
      gap: 2rem;
    }

    .nav-link {
      color: #cbd5e1;
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    .nav-link:hover {
      color: #fff;
    }

    .public-navbar__actions {
      display: flex;
      gap: 1rem;
    }

    .public-main {
      flex: 1;
    }

    .public-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 3rem 4rem 1.5rem;
      background: #020617;
    }

    .footer-content {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2rem;
    }

    .footer-links {
      display: flex;
      gap: 2rem;
    }

    .footer-links a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.9rem;
    }

    .footer-links a:hover {
      color: #fff;
    }

    .footer-bottom {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 1.5rem;
      text-align: center;
    }
  `]
})
export default class PublicLayoutComponent {}
