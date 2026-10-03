package com.multilingo.backend.modules.vocab.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;
import com.multilingo.backend.modules.vocab.entity.DictionaryWord;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.mapper.UserFlashcardMapper;
import com.multilingo.backend.modules.vocab.repository.DictionaryWordRepository;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.UserFlashcardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserFlashcardServiceImpl implements UserFlashcardService {

    private final UserFlashcardRepository userFlashcardRepository;
    private final FlashcardDeckRepository flashcardDeckRepository;
    private final DictionaryWordRepository dictionaryWordRepository;
    private final UserFlashcardMapper userFlashcardMapper;

    /**
     * Lấy danh sách thẻ từ vựng trong một bộ thẻ kèm tìm kiếm theo từ khóa và lọc theo trạng thái.
     *
     * KIỂM SOÁT BẢO MẬT & IDOR:
     * - Bộ thẻ phải tồn tại.
     * - Chỉ chủ nhân sở hữu bộ thẻ (hoặc bộ thẻ công khai isPublic=true) mới được xem danh sách thẻ bên trong.
     * - Nếu là bộ thẻ riêng tư của người khác -> ném HTTP 403 FORBIDDEN.
     */
    @Override
    public List<FlashcardResponse> getCardsInDeck(Integer deckId, String keyword, String status, Integer userId) {
        // 1. Kiểm tra bộ thẻ có tồn tại không
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // 2. Chặn IDOR nếu bộ thẻ riêng tư và không phải của mình
        if (!deck.getUserId().equals(userId) && !Boolean.TRUE.equals(deck.getIsPublic())) {
            log.warn("Truy cập trái phép danh sách thẻ: deckId={}, requesterId={}, ownerId={}", deckId, userId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Chuẩn hóa tham số tìm kiếm (chuẩn bị search pattern lowercase để tránh lỗi PostgreSQL lower(bytea))
        String searchPattern = (keyword != null && !keyword.trim().isEmpty())
                ? "%" + keyword.trim().toLowerCase() + "%"
                : null;
        String normalizedStatus = (status != null && !status.trim().isEmpty() && !"ALL".equalsIgnoreCase(status.trim()))
                ? status.trim().toUpperCase()
                : null;

        // 4. Truy vấn CSDL lọc theo từ khóa và trạng thái
        List<UserFlashcard> cards = userFlashcardRepository.searchCards(deckId, deck.getUserId(), searchPattern, normalizedStatus);

        // 5. Chuyển đổi sang Response DTO qua MapStruct
        return cards.stream()
                .map(userFlashcardMapper::toResponse)
                .toList();
    }

    /**
     * Thêm thẻ từ vựng mới vào một bộ thẻ.
     *
     * QUY TẮC NGHIỆP VỤ & BẢO MẬT:
     * 1. Quyền sở hữu: Chỉ chủ sở hữu của bộ thẻ mới có quyền thêm thẻ vào bộ thẻ đó (Chống IDOR).
     * 2. Chống trùng lặp từ (Conflict 409): Không cho phép tạo 2 thẻ có cùng custom_word trong cùng 1 bộ thẻ
     *    (so sánh không phân biệt hoa thường). Ném lỗi ErrorCode.FLASHCARD_WORD_DUPLICATE.
     * 3. Khởi tạo tham số SRS: status = "NEW", easeFactor = 2.50, intervalDays = 0, reviewCount = 0.
     * 4. Liên kết từ điển gốc: Nếu có truyền wordId, liên kết thẻ với DictionaryWord tương ứng.
     */
    @Override
    @Transactional
    public FlashcardResponse addCard(Integer deckId, CreateFlashcardRequest request, Integer userId) {
        // 1. Kiểm tra bộ thẻ tồn tại
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // 2. Chặn IDOR: Chỉ chủ sở hữu deck mới được thêm thẻ
        if (!deck.getUserId().equals(userId)) {
            log.warn("Cố tình thêm thẻ vào bộ thẻ người khác: deckId={}, requesterId={}, ownerId={}", deckId, userId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Chuẩn hóa từ vựng (cắt khoảng trắng)
        String word = request.getCustomWord().trim();

        // 4. Kiểm tra trùng lặp từ trong cùng 1 deck
        if (userFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(deckId, word)) {
            log.warn("Từ vựng đã tồn tại trong bộ thẻ: deckId={}, word='{}'", deckId, word);
            throw new AppException(ErrorCode.FLASHCARD_WORD_DUPLICATE, "Từ vựng này đã tồn tại trong bộ thẻ");
        }

        // 5. Sử dụng MapStruct mapper chuyển đổi và gán các tham số SRS mặc định
        UserFlashcard card = userFlashcardMapper.toEntity(request, deck, userId);
        card.setCustomWord(word);

        // 6. Liên kết với DictionaryWord nếu có truyền wordId & tự động trích xuất nghĩa đa ngôn ngữ
        if (request.getWordId() != null) {
            DictionaryWord dictionaryWord = dictionaryWordRepository.findById(request.getWordId()).orElse(null);
            card.setWord(dictionaryWord);

            // Nếu người dùng không nhập customMeaning, tự động bốc nghĩa từ default_meaning theo deck.sourceLanguage
            if (card.getCustomMeaning() == null || card.getCustomMeaning().trim().isEmpty()) {
                if (dictionaryWord != null && dictionaryWord.getDefaultMeaning() != null) {
                    String sourceLang = deck.getSourceLanguage() != null ? deck.getSourceLanguage() : "vi";
                    Object meaningObj = dictionaryWord.getDefaultMeaning().get(sourceLang);
                    if (meaningObj == null) {
                        meaningObj = dictionaryWord.getDefaultMeaning().get("vi"); // fallback 1: tiếng Việt
                    }
                    if (meaningObj == null) {
                        meaningObj = dictionaryWord.getDefaultMeaning().get("en"); // fallback 2: tiếng Anh
                    }
                    if (meaningObj != null) {
                        card.setCustomMeaning(meaningObj.toString());
                    }
                }
            }
        }

        // 7. Bắt buộc nghĩa của từ không được để trống
        if (card.getCustomMeaning() == null || card.getCustomMeaning().trim().isEmpty()) {
            throw new AppException(ErrorCode.FLASHCARD_MEANING_REQUIRED, "Nghĩa từ vựng không được để trống");
        }
        card.setCustomMeaning(card.getCustomMeaning().trim());

        // 8. Lưu thẻ vào CSDL
        UserFlashcard saved = userFlashcardRepository.save(card);
        log.info("Thêm thành công thẻ từ vựng: cardId={}, word='{}', deckId={}, userId={}", saved.getId(), saved.getCustomWord(), deckId, userId);

        return userFlashcardMapper.toResponse(saved);
    }

    /**
     * Chỉnh sửa thông tin thẻ từ vựng (từ vựng, nghĩa, ví dụ, ảnh).
     *
     * QUY TẮC NGHIỆP VỤ & BẢO MẬT:
     * - Chỉ chủ sở hữu của thẻ mới có quyền chỉnh sửa.
     * - Nếu đổi custom_word sang từ mới, kiểm tra xem từ mới có bị trùng với thẻ khác trong cùng deck không.
     */
    @Override
    @Transactional
    public FlashcardResponse updateCard(Integer cardId, UpdateFlashcardRequest request, Integer userId) {
        // 1. Tìm thẻ từ vựng theo ID
        UserFlashcard card = userFlashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_NOT_FOUND));

        // 2. Chặn IDOR: Chỉ chủ sở hữu thẻ mới được sửa
        if (!card.getUserId().equals(userId)) {
            log.warn("Cố tình sửa thẻ từ vựng người khác: cardId={}, requesterId={}, ownerId={}", cardId, userId, card.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Chuẩn hóa từ vựng mới
        String newWord = request.getCustomWord().trim();

        // 4. Nếu đổi từ vựng, kiểm tra xem từ mới có bị trùng trong deck không
        if (!card.getCustomWord().equalsIgnoreCase(newWord)) {
            Integer deckId = card.getDeck().getId();
            if (userFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(deckId, newWord)) {
                log.warn("Cập nhật trùng từ vựng trong bộ thẻ: deckId={}, word='{}'", deckId, newWord);
                throw new AppException(ErrorCode.FLASHCARD_WORD_DUPLICATE, "Từ vựng này đã tồn tại trong bộ thẻ");
            }
        }

        // 5. Cập nhật các trường thông tin
        card.setCustomWord(newWord);
        card.setCustomMeaning(request.getCustomMeaning().trim());
        card.setExampleSentence(request.getExampleSentence());
        card.setCustomImageUrl(request.getCustomImageUrl());

        // 6. Lưu thẻ đã cập nhật
        UserFlashcard updated = userFlashcardRepository.save(card);
        log.info("Cập nhật thành công thẻ từ vựng: cardId={}, userId={}", updated.getId(), userId);

        return userFlashcardMapper.toResponse(updated);
    }

    /**
     * Xóa một thẻ từ vựng khỏi bộ thẻ.
     *
     * KIỂM SOÁT BẢO MẬT (CHỐNG IDOR):
     * - Chỉ chủ sở hữu của thẻ mới có quyền xóa.
     */
    @Override
    @Transactional
    public void deleteCard(Integer cardId, Integer userId) {
        // 1. Tìm thẻ cần xóa
        UserFlashcard card = userFlashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_NOT_FOUND));

        // 2. Chặn IDOR: Chỉ chủ sở hữu thẻ mới được xóa
        if (!card.getUserId().equals(userId)) {
            log.warn("Cố tình xóa thẻ từ vựng người khác: cardId={}, requesterId={}, ownerId={}", cardId, userId, card.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Xóa thẻ khỏi CSDL
        userFlashcardRepository.delete(card);
        log.info("Đã xóa thẻ từ vựng: cardId={}, userId={}", cardId, userId);
    }
}
