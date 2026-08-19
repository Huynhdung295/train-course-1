import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './track-order.component.html',
  styles: [`
    .track-order-page {
      padding: 6rem 4rem;
      display: flex;
      justify-content: center;
      min-height: 70vh;
    }

    .track-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 3rem;
      width: 100%;
      max-width: 700px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    .search-box {
      display: flex;
      gap: 1rem;
    }

    .form-input--lg {
      flex: 1;
      padding: 1rem 1.5rem;
      font-size: 1.1rem;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      position: relative;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: rgba(255, 255, 255, 0.1);
    }

    .timeline-item {
      display: flex;
      gap: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .timeline-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #1e293b;
      border: 2px solid #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
    }

    .timeline-item.completed .timeline-dot {
      background: #10b981;
      border-color: #10b981;
      color: white;
    }

    .timeline-item.active .timeline-dot {
      background: #3b82f6;
      border-color: #3b82f6;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
    }
  `]
})
export default class TrackOrderComponent {
  isSearching = signal(false);

  search() {
    this.isSearching.set(true);
  }
}
