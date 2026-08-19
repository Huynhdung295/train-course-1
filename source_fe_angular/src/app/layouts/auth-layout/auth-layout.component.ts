import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * AuthLayoutComponent — Minimal centered layout for auth pages.
 * No sidebar/header — just centered card on a gradient background.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-layout.component.html',
  styles: [`
    .auth-layout {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      position: relative;
      overflow: hidden;
    }

    .auth-layout__bg {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 20% 50%, hsla(239, 84%, 67%, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, hsla(262, 52%, 56%, 0.12) 0%, transparent 50%),
        var(--bg-base);
      z-index: 0;
    }

    .auth-layout__card {
      position: relative;
      z-index: 1;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-2xl);
      padding: var(--space-10) var(--space-8);
      width: 100%;
      max-width: 440px;
      box-shadow: var(--shadow-xl);
    }

    .auth-layout__logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin-bottom: var(--space-8);
    }

    .auth-layout__logo-icon {
      font-size: var(--text-3xl);
    }

    .auth-layout__logo-name {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `],
})
export default class AuthLayoutComponent {}
