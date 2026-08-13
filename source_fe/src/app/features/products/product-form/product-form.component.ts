import { Component, ChangeDetectionStrategy, inject, signal, effect, input, computed } from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, switchMap, filter } from 'rxjs';

import { ProductApiService } from '../services/product-api.service';
import { CreateProductRequest, UpdateProductRequest } from '@core/models/product.model';
import { ToastService } from '@shared/components/toast/toast.service';
import { mapServerErrors, positiveDecimalValidator } from '@shared/validators/form.validators';
import { ProblemDetail } from '@core/models/api.model';

/**
 * ProductFormComponent — Shared create/edit form.
 * Uses Angular 17/18+ features: Router Input Binding, Signals, and Declarative RxJS.
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form.component.html'
})
export default class ProductFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly productApi = inject(ProductApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // Router Input Binding: Automatically capture ':id' param from URL
  readonly id = input<string>();
  
  readonly isEdit = computed(() => !!this.id());
  readonly submitting = signal(false);

  // Declarative Data Fetching
  private readonly existingProduct = toSignal(
    toObservable(this.id).pipe(
      filter((id): id is string => !!id),
      switchMap(id => this.productApi.findById(id))
    )
  );

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    barcode: [''],
    price: [0, [Validators.required, positiveDecimalValidator()]],
    costPrice: [null as number | null],
    categoryId: [''],
    unit: ['cái'],
    lowStockThreshold: [5],
    description: [''],
  });

  constructor() {
    // Bridging: Automatically patch form when product is fetched
    effect(() => {
      const product = this.existingProduct();
      if (product) {
        this.form.patchValue({
          ...product,
          price: parseFloat(product.price as unknown as string),
          costPrice: product.costPrice ? parseFloat(product.costPrice as unknown as string) : null
        });
      }
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) { 
      this.form.markAllAsTouched(); 
      return; 
    }
    
    this.submitting.set(true);
    const value = this.form.getRawValue();
    const request = { 
      ...value, 
      price: Number(value.price), 
      costPrice: value.costPrice ? Number(value.costPrice) : undefined 
    };

    const action$ = this.isEdit()
      ? this.productApi.update(this.existingProduct()!.id, { 
          ...(request as UpdateProductRequest), 
          version: this.existingProduct()!.version 
        })
      : this.productApi.create(request as CreateProductRequest);

    action$.pipe(
      catchError((problem: ProblemDetail) => {
        mapServerErrors(this.form, problem);
        this.toast.error(problem.detail || 'Lưu thất bại', problem.traceId);
        return EMPTY;
      }),
      finalize(() => this.submitting.set(false)),
    ).subscribe(() => {
      this.toast.success(this.isEdit() ? 'Đã cập nhật sản phẩm' : 'Đã tạo sản phẩm mới');
      this.router.navigate(['/products']);
    });
  }

  protected touched(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.invalid);
  }

  protected getError(field: string): string {
    const ctrl = this.form.get(field);
    if (ctrl?.hasError('required')) return 'Trường này là bắt buộc';
    if (ctrl?.hasError('maxlength')) return 'Giá trị quá dài';
    if (ctrl?.hasError('positiveDecimal')) return ctrl.getError('positiveDecimal').message;
    if (ctrl?.hasError('serverError')) return ctrl.getError('serverError');
    return '';
  }
}
