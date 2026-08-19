# Tôn Chỉ Code Angular 22 (Angular 22 Rules & Skillset)

Dự án này sử dụng Angular 22. Tất cả Agent khi tham gia code/sửa code **BẮT BUỘC** phải tuân thủ các quy tắc sau đây, cấm sử dụng các phương pháp cũ (Angular 14 đổ về trước).

## 📜 4 LUẬT BẤT THÀNH VĂN (THE RULES)

1. **Standalone Tối Thượng**: Quên `app.module.ts` đi. Mọi thứ (Component, Directive, Pipe) đều phải là `standalone: true`.
2. **Signals Là Chân Lý**: Không dùng RxJS `BehaviorSubject` cho state nội bộ component nữa. Mọi state, input, output, query (`viewChild`, `viewChildren`) đều phải dùng **Signals**. RxJS chỉ dùng cho HTTP Requests (`HttpClient`) và luồng event phức tạp.
3. **Control Flow Mới**: Cấm dùng `*ngIf`, `*ngFor`. Bắt buộc dùng `@if`, `@for`, `@switch` được build sẵn vào template engine.
4. **Zoneless (Tạm biệt Zone.js)**: App cấu hình chạy mượt mà không cần `zone.js`. Framework tự biết chính xác khi nào UI cần update nhờ Signals. Đảm bảo cấu hình app sử dụng `provideExperimentalZonelessChangeDetection()`.

---

## 💻 BỘ SKILL CODE ANGULAR 22 (THE CODE)

### 1. Component "Thế hệ mới" (Signals + Control Flow + Defer)
- **Input/Output/Model**: Khai báo bằng Signals `input<T>()`, `input.required<T>()`, `output<T>()`, `model<T>()`.
- **Computed & Effect**: Sử dụng `computed(() => ...)` để phái sinh dữ liệu và `effect(() => ...)` để xử lý side-effects. Không dùng lifecycle hook như `ngOnInit` hoặc `ngOnChanges` nếu có thể thay bằng Signal computed/effect.
- **Deferrable Views**: Dùng `@defer` để lazy load các component nặng ngay trong template HTML (chia nhỏ bundle size tự động).

### 2. DOM Queries thế hệ mới (ViewChild)
Thay vì `@ViewChild('id')`, hãy dùng `viewChild<ElementRef>('id')` trả về một Signal. Không cần chờ `ngAfterViewInit`.

### 3. Routing (Điều hướng hiện đại)
- **Functional Guards & Resolvers**: Không tạo class guard, chỉ dùng function. 
- **View Transitions**: Sử dụng `provideRouter(routes, withViewTransitions())`.
- **Router Input Binding**: Lấy param từ URL bằng input binding `id = input<string>()`. Phải đảm bảo config có `withComponentInputBinding()`.

### 4. State Management (NgRx SignalStore)
Tuyệt đối bỏ qua Redux kiểu cũ nặng nề. Sử dụng `@ngrx/signals`:
- Khởi tạo bằng `signalStore(withState(...), withMethods(...))` 
- Thao tác state bằng `patchState`.

### 5. Forms & Validation
- **Typed Reactive Forms**: Sử dụng `NonNullableFormBuilder` để type-safe tuyệt đối (tránh `null` và `any`).
- Để lắng nghe sự kiện form thay đổi vào luồng signal, dùng `toSignal(form.valueChanges)`.

### 6. HTTP & Interceptors
- Sử dụng **Fetch API**: Cấu hình `provideHttpClient(withFetch(), ...)`.
- Mọi interceptor phải viết dưới dạng Functional `HttpInterceptorFn`.

## TỔNG KẾT
Khi gặp bất kỳ feature/bug nào, Agent luôn tự hỏi: **"Cách hiện đại bằng Signal và Standalone của Angular 22 để giải quyết vấn đề này là gì?"** trước khi viết code.
