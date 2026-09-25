---
name: multilingo-crud-generator
description: "Sử dụng khi cần tạo nhanh một bộ CRUD hoàn chỉnh (Entity, DTO, Repository, Service, Controller, Tests) cho một bảng trong Multilingo Platform. Đảm bảo tuân thủ đầy đủ quy chuẩn Base Architecture."
---

# Tạo Bộ CRUD Chuẩn Multilingo (CRUD Generator)

Skill này hướng dẫn tạo nhanh một bộ CRUD hoàn chỉnh cho một domain entity, tuân thủ đầy đủ quy chuẩn Base Architecture.

**Công bố khi bắt đầu:** "Tôi đang sử dụng skill `multilingo-crud-generator` để tạo bộ CRUD chuẩn."

---

## Thông tin cần thu thập từ user

1. **Tên bảng / Entity** (ví dụ: `Exam`, `Question`, `UserProfile`).
2. **Danh sách trường** (tên, kiểu dữ liệu, nullable, unique).
3. **Quan hệ với bảng khác** (FK, @ManyToOne, @OneToMany).
4. **Các endpoint API cần thiết** (GET all, GET by id, POST, PUT, DELETE).

---

## Quy trình tạo (theo thứ tự TDD)

### File 1: Entity
- Package: `com.multilingo.backend.entity`
- **BẮT BUỘC** kế thừa `BaseEntity`.
- Sử dụng Lombok: `@Entity`, `@Table`, `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`.
- **KHÔNG** khai báo lại `id`, `createdAt`, `updatedAt`.

```java
@Entity
@Table(name = "bảng_tên")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class TênEntity extends BaseEntity {
    
    @Column(nullable = false)
    private String trường1;
    
    // Các trường khác...
}
```

### File 2: Repository
- Package: `com.multilingo.backend.repository`
- Kế thừa `JpaRepository<TênEntity, Integer>`.

### File 3: DTO (Request & Response)
- Package: `com.multilingo.backend.dto`
- DTO Request: Chứa validation annotation (`@NotBlank`, `@NotNull`, `@Min`...).
- DTO Response: Chỉ chứa các trường cần trả về cho client.

### File 4: Service
- Package: `com.multilingo.backend.service`
- Interface + Implementation (`@Service`).
- Ném `AppException(ErrorCode.RESOURCE_NOT_FOUND)` khi không tìm thấy entity.

### File 5: Controller
- Package: `com.multilingo.backend.controller`
- `@RestController`, `@RequestMapping("/api/v1/<tên-resource>")`
- Mọi endpoint trả về `ResponseEntity<ApiResponse<T>>`.

### File 6: Tests
- Unit Test cho Service (mock Repository).
- `@WebMvcTest` cho Controller (mock Service).
- Kiểm tra: CRUD thành công, ném lỗi khi không tìm thấy, validation lỗi.

---

## Nghiệm thu

```bash
cd backend && ./mvnw clean test
```
Kết quả: `BUILD SUCCESS`, 100% tests PASS.
