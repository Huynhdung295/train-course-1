import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, switchMap, catchError, of, startWith, combineLatest, tap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ProductApiService } from '../services/product-api.service';
import { Product, ProductFilter } from '@core/models/product.model';
import { PageResponse, Status } from '@core/models/api.model';
import { CurrencyVndPipe } from '@shared/pipes/currency-vnd.pipe';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';

/**
 * ProductListComponent — Paginated, filterable product list.
 */
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyVndPipe, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export default class ProductListComponent {
  private readonly productApi = inject(ProductApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);

  protected readonly searchControl = this.fb.control('');
  protected readonly statusControl = this.fb.control('');
  protected readonly lowStockControl = this.fb.control(false);

  // Combine filters into a single observable stream
  private readonly filterChange$ = combineLatest([
    toObservable(this.currentPage),
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value), debounceTime(300)),
    this.statusControl.valueChanges.pipe(startWith(this.statusControl.value)),
    this.lowStockControl.valueChanges.pipe(startWith(this.lowStockControl.value)),
  ]).pipe(
    switchMap(([page, search, status, lowStock]) => {
      this.loading.set(true);
      const filter: ProductFilter = {
        search: search || undefined,
        status: (status as Status) || undefined,
        lowStock: lowStock || undefined,
        page,
        size: 20,
      };
      return this.productApi.findAllFiltered(filter).pipe(
        catchError(() => of(null)),
        tap(() => this.loading.set(false))
      );
    })
  );

  protected readonly page = toSignal(this.filterChange$);
  protected readonly products = computed(() => this.page()?.content ?? []);

  protected goToPage(page: number): void {
    this.currentPage.set(page);
  }

  protected isLowStock(product: Product): boolean {
    return product.stockQuantity <= product.lowStockThreshold;
  }
}
