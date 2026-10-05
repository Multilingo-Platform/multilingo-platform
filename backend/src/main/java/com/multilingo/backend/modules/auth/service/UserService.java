public interface UserService {
    UserResponse createUser(UserCreationRequest request);

    List<UserResponse> getAllUser();

    UserResponse updateUser(String userId, UserUpdateRequest request);
}