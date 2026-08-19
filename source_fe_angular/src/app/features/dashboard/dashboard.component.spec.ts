import { ComponentFixture, TestBed } from '@angular/core/testing';
import DashboardComponent from './dashboard.component';
import { RealtimeService } from '@core/realtime/realtime.service';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';

describe('DashboardComponent (Angular 22 Blueprint)', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let realtimeEvents$: Subject<any>;

  beforeEach(async () => {
    realtimeEvents$ = new Subject<any>();

    const realtimeServiceStub = {
      events: () => realtimeEvents$.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        // Bật Zoneless cho môi trường test
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: RealtimeService, useValue: realtimeServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    
    // Trong Zoneless Angular, chỉ cần đợi fixture.whenStable() 
    // thay vì gọi fixture.detectChanges() liên tục.
    await fixture.whenStable();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render KPI cards correctly', async () => {
    const kpiCards = fixture.nativeElement.querySelectorAll('.kpi-card');
    expect(kpiCards.length).toBe(4);
    
    // Kiểm tra card đầu tiên (Doanh thu)
    const firstCardLabel = kpiCards[0].querySelector('.kpi-card__label').textContent.trim();
    expect(firstCardLabel).toBe('Doanh thu hôm nay');
  });

  it('should display empty state when recent orders are empty', async () => {
    // Mặc định recentOrders là rỗng
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('Chưa có đơn hàng nào hôm nay');
  });

  it('should react to RealtimeService events and update signals automatically', async () => {
    // Giả lập nhận event từ RealtimeService
    const mockOrder = {
      id: '1',
      orderNumber: 'ORD-001',
      customerName: 'Nguyễn Văn A',
      total: 500000,
      status: 'COMPLETED',
      createdAt: new Date().toISOString()
    };

    realtimeEvents$.next({
      type: 'ORDER_CREATED',
      payload: mockOrder
    });

    // Chờ Signals update DOM tự động (không cần fixture.detectChanges() trong Zoneless)
    await fixture.whenStable();

    // Verify state đã được cập nhật
    expect(component['recentOrders']().length).toBe(1);
    expect(component['recentOrders']()[0].orderNumber).toBe('ORD-001');

    // Kiểm tra UI đã hết empty state
    const orderRows = fixture.nativeElement.querySelectorAll('.order-row');
    expect(orderRows.length).toBe(1);
    expect(orderRows[0].textContent).toContain('ORD-001');
    expect(orderRows[0].textContent).toContain('Nguyễn Văn A');
  });
});
