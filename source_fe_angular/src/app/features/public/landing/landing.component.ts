import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styles: [`
    .landing-page {
      padding: 0 4rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Hero Section */
    .hero-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      padding: 6rem 0;
      align-items: center;
    }

    .badge-pill {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
    }

    .hero-title {
      font-size: 4rem;
      line-height: 1.1;
      font-weight: 800;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    .text-gradient {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      font-size: 1.25rem;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 2.5rem;
      max-width: 90%;
    }

    .hero-actions {
      display: flex;
      gap: 1rem;
    }

    .stats {
      display: flex;
      gap: 3rem;
      margin-top: 3rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #64748b;
    }

    /* Glass Mockup */
    .glass-mockup {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      transform: perspective(1000px) rotateY(-15deg) rotateX(5deg);
      transition: transform 0.5s ease;
    }

    .glass-mockup:hover {
      transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
    }

    .mockup-header {
      padding: 1rem;
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(0, 0, 0, 0.2);
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .bg-danger { background: #ef4444; }
    .bg-warning { background: #f59e0b; }
    .bg-success { background: #10b981; }

    .mockup-body {
      padding: 2rem;
      min-height: 400px;
    }

    .placeholder-img {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .skeleton-chart {
      height: 200px;
      background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
      border-radius: 12px;
    }

    .skeleton-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }

    .sk-card {
      height: 100px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Features Section */
    .features-section {
      padding: 6rem 0;
    }

    .section-title {
      font-size: 2.5rem;
      font-weight: 700;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 2.5rem 2rem;
      border-radius: 20px;
      transition: all 0.3s ease;
    }

    .feature-card:hover {
      background: rgba(255, 255, 255, 0.05);
      transform: translateY(-5px);
    }

    .feature-icon {
      font-size: 2.5rem;
      margin-bottom: 1.5rem;
    }

    .feature-card h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
  `]
})
export default class LandingComponent {}
