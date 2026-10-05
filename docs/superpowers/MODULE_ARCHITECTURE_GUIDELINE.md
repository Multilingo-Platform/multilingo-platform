# 📐 Multilingo Platform - Module Architecture Guideline

Tài liệu này quy định kiến trúc chuẩn (Architecture Guideline) được trích xuất từ module `auth` mẫu. Bất kỳ khi nào phát triển một module/feature mới cho Backend, bạn **BẮT BUỘC** phải tuân theo cấu trúc và các quy chuẩn mã nguồn dưới đây.

## 1. Cấu trúc thư mục chuẩn của một Module

Mỗi tính năng nghiệp vụ sẽ được đóng gói trong một thư mục riêng biệt tại `com.multilingo.backend.modules.<tên-module>`, áp dụng kiến trúc **Feature-based Architecture**.

```text
com.multilingo.backend.modules.<module_name>
├── controller/          # REST Controllers tiếp nhận request từ Client
├── dto/                 # Data Transfer Objects (chứa Input/Output data)
│   ├── request/         # Các class Request (Ví dụ: UserCreationRequest)
│   └── response/        # Các class Response (Ví dụ: UserResponse)
├── entity/              # JPA Entities ánh xạ với Database
├── mapper/              # Các interface MapStruct ánh xạ dữ liệu (Entity <-> DTO)
├── repository/          # Spring Data JPA Repositories truy xuất DB
└── service/             # Chứa logic nghiệp vụ (Business Logic)
    ├── <Name>Service.java        # Interface định nghĩa các hàm của Service
    └── impl/                     # Chứa các class implement Interface
        └── <Name>ServiceImpl.java
```

---

## 2. Tiêu chuẩn Mã nguồn cho từng Layer

### 2.1. Controller Layer (`controller/`)
- **Nhiệm vụ:** Nhận HTTP Request, gọi Service xử lý, và trả về HTTP Response.
- **Quy chuẩn:**
  - Class bắt buộc đánh dấu: `@RestController` và `@RequestMapping("/<đường-dẫn>")`.
  - Khai báo dependency (Inject Service) bằng **Lombok**: `@RequiredArgsConstructor` kết hợp `@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)`.
  - **Kiểu trả về thống nhất:** Bắt buộc bọc dữ liệu trong `ResponseEntity<ApiResponse<T>>`.
  - Không viết business logic trong Controller.
  - Sử dụng `@Valid` để validate đầu vào đối với body request.

**Ví dụ:**
```java
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserController {
    
    UserService userService;

    @PostMapping
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@RequestBody @Valid UserCreationRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.ok(ApiResponse.success("Tạo tài khoản thành công", response));
    }
}
```

### 2.2. DTO Layer (`dto/`)
- **Nhiệm vụ:** Định nghĩa dạng dữ liệu trao đổi qua API. Không bao giờ trả trực tiếp Entity ra ngoài.
- **Quy chuẩn:**
  - Phân tách rõ `request/` (Dữ liệu gửi từ client lên) và `response/` (Dữ liệu trả về client).
  - Sử dụng Validation annotations (ví dụ: `@NotBlank`, `@Size`, `@Email`) trong Request DTO.

### 2.3. Entity Layer (`entity/`)
- **Nhiệm vụ:** Đại diện cho các bảng trong cơ sở dữ liệu.
- **Quy chuẩn:**
  - **Bắt buộc** kế thừa class `BaseEntity` (BaseEntity đã định nghĩa sẵn `id` kiểu Integer tự tăng, `createdAt`, `updatedAt`).
  - Dùng Lombok `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder` để giảm boilerplate code.
  - Bắt buộc phải có `@Entity` và `@Table(name = "tên_bảng_số_nhiều")`.

### 2.4. Mapper Layer (`mapper/`)
- **Nhiệm vụ:** Chuyển đổi qua lại giữa Entity và DTO.
- **Quy chuẩn:** 
  - Phải dùng **MapStruct**. Đánh dấu interface bằng `@Mapper(componentModel = "spring")`.

**Ví dụ:**
```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    User toUser(UserCreationRequest request);
    UserResponse toUserResponse(User user);
}
```

### 2.5. Repository Layer (`repository/`)
- **Nhiệm vụ:** Tương tác với CSDL.
- **Quy chuẩn:**
  - Kế thừa `JpaRepository<Entity, Integer>` (do khóa chính ID nằm trong `BaseEntity` là Integer).

### 2.6. Service Layer (`service/`)
- **Nhiệm vụ:** Chứa toán bộ logic nghiệp vụ (Business Logic).
- **Quy chuẩn:**
  - **Interface-driven:** Luôn tạo Interface ở ngoài thư mục `service/` và implementation class ở thư mục `impl/`.
  - Class Impl phải có `@Service` và dùng `@RequiredArgsConstructor`, `@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)` để inject Repository/Mapper.
  - Xử lý lỗi: Khi có lỗi logic (Ví dụ: Email đã tồn tại, không tìm thấy User), **bắt buộc dùng AppException** truyền vào `ErrorCode`. Không bao giờ trả về null hay Exception mặc định.

**Ví dụ:**
```java
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserServiceImpl implements UserService {
    
    UserRepository userRepository;
    UserMapper userMapper;

    @Override
    public UserResponse createUser(UserCreationRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }
        
        User user = userMapper.toUser(request);
        user = userRepository.save(user);
        return userMapper.toUserResponse(user);
    }
}
```

---

## 3. Tóm tắt các Quy tắc cốt lõi (Core Rules)
1. Luôn kế thừa `BaseEntity` cho mọi Entity.
2. Mọi Controller Endpoint trả về `ResponseEntity<ApiResponse<T>>`.
3. Lỗi nghiệp vụ luôn dùng `throw new AppException(ErrorCode.XYZ)`.
4. Inject Dependency bằng `@RequiredArgsConstructor` + `@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)`.
5. Convert dữ liệu bằng thư viện MapStruct.
