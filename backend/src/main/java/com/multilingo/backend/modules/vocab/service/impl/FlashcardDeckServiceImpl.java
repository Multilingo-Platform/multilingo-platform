package com.multilingo.backend.modules.vocab.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.DeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckStatsProjection;
import com.multilingo.backend.modules.vocab.dto.response.DeckSummaryResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.mapper.FlashcardDeckMapper;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.FlashcardDeckService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FlashcardDeckServiceImpl implements FlashcardDeckService {

    private final FlashcardDeckRepository flashcardDeckRepository;
    private final UserFlashcardRepository userFlashcardRepository;
    private final FlashcardDeckMapper flashcardDeckMapper;

    /**
     * Lấy danh sách toàn bộ bộ thẻ của người dùng kèm chỉ số thống kê thẻ.
     *
     * GIẢI PHÁP TỐI ƯU HIỆU NĂNG (CHỐNG N+1 QUERY):
     * 1. Bước 1: Query 1 lần lấy tất cả Deck của user theo thứ tự mới nhất (Query 1).
     * 2. Bước 2: Gom toàn bộ deckIds thành danh sách và gọi 1 query tổng hợp GROUP BY
     *    tại CSDL qua 'userFlashcardRepository.countStatsByDeckIds' (Query 2).
     * 3. Bước 3: Đưa kết quả thống kê vào Map<deckId, DeckStatsProjection> để tra cứu O(1).
     *    -> Bất kể user có bao nhiêu bộ thẻ, hệ thống CHỈ TỐN ĐÚNG 2 QUERY thay vì N+1 queries.
     * 4. Bước 4: Ủy quyền chuyển đổi DTO cho MapStruct Mapper.
     */
    @Override
    public List<DeckSummaryResponse> getUserDecks(Integer userId) {
        // 1. Lấy danh sách các bộ thẻ của người dùng
        List<FlashcardDeck> decks = flashcardDeckRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        if (decks.isEmpty()) {
            return Collections.emptyList();
        }

        // 2. Gom danh sách ID các bộ thẻ
        List<Integer> deckIds = decks.stream().map(FlashcardDeck::getId).toList();

        // 3. Query tổng hợp số lượng thẻ cho tất cả các deck trong 1 câu truy vấn duy nhất
        List<DeckStatsProjection> statsList = userFlashcardRepository.countStatsByDeckIds(deckIds, Instant.now());

        // 4. Đưa vào Map để tra cứu O(1) theo deckId
        Map<Integer, DeckStatsProjection> statsMap = statsList.stream()
                .collect(Collectors.toMap(DeckStatsProjection::getDeckId, Function.identity()));

        // 5. Sử dụng MapStruct mapper để chuyển đổi Entity -> DTO Response
        return decks.stream()
                .map(deck -> flashcardDeckMapper.toSummaryResponse(deck, statsMap.get(deck.getId())))
                .toList();
    }

    /**
     * Xem thông tin chi tiết một bộ thẻ kèm thống kê số lượng từ vựng bên trong.
     *
     * KIỂM SOÁT QUYỀN TRUY CẬP (CHỐNG IDOR):
     * - Chỉ chủ sở hữu (userId khớp) hoặc bộ thẻ được chia sẻ công khai (isPublic = true)
     *   mới được phép xem thông tin chi tiết. Nếu không thỏa mãn, ném lỗi 403 FORBIDDEN.
     */
    @Override
    public DeckDetailResponse getDeckDetail(Integer deckId, Integer userId) {
        // 1. Kiểm tra sự tồn tại của bộ thẻ
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // 2. Kiểm tra quyền truy cập (nếu không phải chủ sở hữu và deck không public -> chặn)
        if (!deck.getUserId().equals(userId) && !Boolean.TRUE.equals(deck.getIsPublic())) {
            log.warn("Truy cập trái phép bộ thẻ: deckId={}, requesterId={}, ownerId={}", deckId, userId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Lấy thống kê số lượng thẻ của riêng bộ thẻ này
        DeckStatsProjection stats = userFlashcardRepository.countStatsByDeckId(deckId, Instant.now()).orElse(null);

        // 4. Trả về DTO thông qua MapStruct Mapper
        return flashcardDeckMapper.toDetailResponse(deck, stats);
    }

    /**
     * Tạo mới một bộ thẻ từ vựng.
     *
     * QUY TẮC NGHIỆP VỤ:
     * - Cắt bỏ khoảng trắng thừa đầu cuối (trim) trong tên bộ thẻ.
     * - Khởi tạo mặc định số lượt clone (clonesCount = 0).
     * - Gắn đúng userId của tài khoản đang đăng nhập.
     */
    @Override
    @Transactional
    public DeckResponse createDeck(CreateDeckRequest request, Integer userId) {
        // 1. Dùng MapStruct chuyển đổi request sang entity và gán userId
        FlashcardDeck deck = flashcardDeckMapper.toEntity(request, userId);

        // 2. Chuẩn hóa tên bộ thẻ (trim)
        deck.setName(request.getName().trim());

        // 3. Xử lý cặp ngôn ngữ (Target Language & Source Language)
        if (request.getTargetLanguage() != null && !request.getTargetLanguage().trim().isEmpty()) {
            deck.setTargetLanguage(request.getTargetLanguage().trim().toLowerCase());
        } else if (deck.getTargetLanguage() == null) {
            deck.setTargetLanguage("en");
        }

        if (request.getSourceLanguage() != null && !request.getSourceLanguage().trim().isEmpty()) {
            deck.setSourceLanguage(request.getSourceLanguage().trim().toLowerCase());
        } else if (deck.getSourceLanguage() == null) {
            deck.setSourceLanguage("vi");
        }

        // 4. Lưu vào cơ sở dữ liệu
        FlashcardDeck saved = flashcardDeckRepository.save(deck);
        log.info("Tạo thành công bộ thẻ mới: id={}, name='{}', targetLang='{}', sourceLang='{}', userId={}", 
                saved.getId(), saved.getName(), saved.getTargetLanguage(), saved.getSourceLanguage(), userId);

        // 5. Trả về Response DTO qua Mapper
        return flashcardDeckMapper.toDeckResponse(saved);
    }

    /**
     * Cập nhật thông tin bộ thẻ (Tên, Mô tả, Quyền riêng tư, Cặp ngôn ngữ).
     *
     * KIỂM SOÁT QUYỀN TRUY CẬP (CHỐNG IDOR):
     * - BẮT BUỘC chỉ chủ sở hữu của bộ thẻ mới có quyền chỉnh sửa.
     * - Người dùng khác cố tình gửi request PUT sẽ nhận HTTP 403 FORBIDDEN.
     */
    @Override
    @Transactional
    public DeckResponse updateDeck(Integer deckId, UpdateDeckRequest request, Integer userId) {
        // 1. Tìm bộ thẻ theo ID
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // 2. Chặn IDOR: Người gửi request không phải chủ nhân của bộ thẻ
        if (!deck.getUserId().equals(userId)) {
            log.warn("Cố tình sửa bộ thẻ người khác: deckId={}, requesterId={}, ownerId={}", deckId, userId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Cập nhật các trường thông tin có thay đổi
        deck.setName(request.getName().trim());
        deck.setDescription(request.getDescription());
        if (request.getIsPublic() != null) {
            deck.setIsPublic(request.getIsPublic());
        }
        if (request.getTargetLanguage() != null && !request.getTargetLanguage().trim().isEmpty()) {
            deck.setTargetLanguage(request.getTargetLanguage().trim().toLowerCase());
        }
        if (request.getSourceLanguage() != null && !request.getSourceLanguage().trim().isEmpty()) {
            deck.setSourceLanguage(request.getSourceLanguage().trim().toLowerCase());
        }

        // 4. Lưu lại bản ghi đã cập nhật
        FlashcardDeck updated = flashcardDeckRepository.save(deck);
        log.info("Cập nhật thành công bộ thẻ: id={}, userId={}", updated.getId(), userId);

        return flashcardDeckMapper.toDeckResponse(updated);
    }

    /**
     * Xóa vĩnh viễn bộ thẻ và toàn bộ thẻ từ vựng con bên trong (Cascade Delete).
     *
     * GIẢI PHÁP CASCADE DELETE AN TOÀN TRÊN MỌI CƠ SỞ DỮ LIỆU:
     * - Để tránh vi phạm ràng buộc khóa ngoại (Foreign Key Constraint) khi chạy trên H2 (In-memory)
     *   lẫn PostgreSQL, Service chủ động gọi 'userFlashcardRepository.deleteByDeckId(deckId)'
     *   dọn dẹp toàn bộ flashcard con trong transaction trước khi xóa bản ghi cha 'deck'.
     */
    @Override
    @Transactional
    public void deleteDeck(Integer deckId, Integer userId) {
        // 1. Tìm bộ thẻ cần xóa
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // 2. Chặn IDOR: Người xóa không phải chủ nhân của bộ thẻ
        if (!deck.getUserId().equals(userId)) {
            log.warn("Cố tình xóa bộ thẻ người khác: deckId={}, requesterId={}, ownerId={}", deckId, userId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Xóa sạch các thẻ từ vựng con thuộc bộ thẻ này (Cascade Safe)
        userFlashcardRepository.deleteByDeckId(deckId);

        // 4. Xóa bản ghi bộ thẻ
        flashcardDeckRepository.delete(deck);
        log.info("Đã xóa hoàn tất bộ thẻ và các thẻ con: deckId={}, userId={}", deckId, userId);
    }
}
