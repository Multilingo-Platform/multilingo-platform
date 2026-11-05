package com.multilingo.backend.modules.vocab.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.*;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.mapper.FlashcardDeckMapper;
import com.multilingo.backend.modules.vocab.mapper.UserFlashcardMapper;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.AdminFlashcardDeckService;
import com.multilingo.backend.modules.vocab.service.UserFlashcardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminFlashcardDeckServiceImpl implements AdminFlashcardDeckService {

    private final FlashcardDeckRepository flashcardDeckRepository;
    private final UserFlashcardRepository userFlashcardRepository;
    private final UserRepository userRepository;
    private final FlashcardDeckMapper flashcardDeckMapper;
    private final UserFlashcardMapper userFlashcardMapper;
    private final UserFlashcardService userFlashcardService;

    @Override
    public PageResponse<AdminDeckResponse> getDecks(String keyword, String targetLanguage, Boolean isPublic, Pageable pageable) {
        String searchPattern = (keyword != null && !keyword.trim().isEmpty())
                ? "%" + keyword.trim().toLowerCase() + "%"
                : null;
        String cleanLang = (targetLanguage != null && !targetLanguage.trim().isEmpty() && !"ALL".equalsIgnoreCase(targetLanguage.trim()))
                ? targetLanguage.trim().toLowerCase()
                : null;

        Page<FlashcardDeck> page = flashcardDeckRepository.findAllWithFilters(searchPattern, cleanLang, isPublic, pageable);
        if (page.isEmpty()) {
            return PageResponse.<AdminDeckResponse>builder()
                    .items(Collections.emptyList())
                    .page(page.getNumber())
                    .size(page.getSize())
                    .totalElements(page.getTotalElements())
                    .totalPages(page.getTotalPages())
                    .last(page.isLast())
                    .build();
        }

        List<Integer> deckIds = page.getContent().stream().map(FlashcardDeck::getId).toList();
        List<Integer> ownerIds = page.getContent().stream()
                .map(FlashcardDeck::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<Integer, User> userMap = userRepository.findAllById(ownerIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<Integer, DeckStatsProjection> statsMap = userFlashcardRepository.countStatsByDeckIds(deckIds, Instant.now()).stream()
                .collect(Collectors.toMap(DeckStatsProjection::getDeckId, Function.identity()));

        List<AdminDeckResponse> responses = page.getContent().stream().map(deck -> {
            User owner = userMap.get(deck.getUserId());
            DeckStatsProjection stats = statsMap.get(deck.getId());
            long totalCards = (stats != null && stats.getTotalCards() != null) ? stats.getTotalCards() : 0L;

            return AdminDeckResponse.builder()
                    .id(deck.getId())
                    .name(deck.getName())
                    .description(deck.getDescription())
                    .targetLanguage(deck.getTargetLanguage())
                    .sourceLanguage(deck.getSourceLanguage())
                    .isPublic(deck.getIsPublic())
                    .clonesCount(deck.getClonesCount() != null ? deck.getClonesCount() : 0)
                    .ownerId(deck.getUserId())
                    .ownerName(owner != null ? owner.getFullName() : "Hệ thống")
                    .ownerEmail(owner != null ? owner.getEmail() : null)
                    .totalCards(totalCards)
                    .createdAt(deck.getCreatedAt())
                    .updatedAt(deck.getUpdatedAt())
                    .build();
        }).toList();

        return PageResponse.<AdminDeckResponse>builder()
                .items(responses)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    @Override
    public AdminDeckDetailResponse getDeckDetail(Integer deckId) {
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        User owner = userRepository.findById(deck.getUserId()).orElse(null);
        List<UserFlashcard> cards = userFlashcardRepository.findAllByDeckIdOrderByCreatedAtDesc(deckId);
        List<FlashcardResponse> cardResponses = cards.stream()
                .map(userFlashcardMapper::toResponse)
                .toList();

        return AdminDeckDetailResponse.builder()
                .id(deck.getId())
                .name(deck.getName())
                .description(deck.getDescription())
                .targetLanguage(deck.getTargetLanguage())
                .sourceLanguage(deck.getSourceLanguage())
                .isPublic(deck.getIsPublic())
                .clonesCount(deck.getClonesCount() != null ? deck.getClonesCount() : 0)
                .ownerId(deck.getUserId())
                .ownerName(owner != null ? owner.getFullName() : "Hệ thống")
                .ownerEmail(owner != null ? owner.getEmail() : null)
                .totalCards((long) cardResponses.size())
                .createdAt(deck.getCreatedAt())
                .updatedAt(deck.getUpdatedAt())
                .cards(cardResponses)
                .build();
    }

    @Override
    @Transactional
    public DeckResponse createDeck(CreateDeckRequest request, Integer adminId) {
        log.info("Admin tạo bộ thẻ mới: '{}' bởi adminId={}", request.getName(), adminId);
        FlashcardDeck deck = flashcardDeckMapper.toEntity(request, adminId);
        if (request.getIsPublic() != null) {
            deck.setIsPublic(request.getIsPublic());
        }
        FlashcardDeck saved = flashcardDeckRepository.save(deck);
        return flashcardDeckMapper.toDeckResponse(saved);
    }

    @Override
    @Transactional
    public DeckResponse updateDeck(Integer deckId, UpdateDeckRequest request) {
        log.info("Admin cập nhật bộ thẻ id={}", deckId);
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        deck.setName(request.getName().trim());
        deck.setDescription(request.getDescription());
        if (request.getTargetLanguage() != null && !request.getTargetLanguage().trim().isEmpty()) {
            deck.setTargetLanguage(request.getTargetLanguage().trim());
        }
        if (request.getSourceLanguage() != null && !request.getSourceLanguage().trim().isEmpty()) {
            deck.setSourceLanguage(request.getSourceLanguage().trim());
        }
        if (request.getIsPublic() != null) {
            deck.setIsPublic(request.getIsPublic());
        }

        FlashcardDeck updated = flashcardDeckRepository.save(deck);
        return flashcardDeckMapper.toDeckResponse(updated);
    }

    @Override
    @Transactional
    public DeckResponse togglePublic(Integer deckId) {
        log.info("Admin bật/tắt quyền Public bộ thẻ id={}", deckId);
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        deck.setIsPublic(!Boolean.TRUE.equals(deck.getIsPublic()));
        FlashcardDeck updated = flashcardDeckRepository.save(deck);
        return flashcardDeckMapper.toDeckResponse(updated);
    }

    @Override
    @Transactional
    public void deleteDeck(Integer deckId) {
        log.info("Admin xóa bộ thẻ id={}", deckId);
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // Cascade xóa toàn bộ thẻ con liên thuộc
        userFlashcardRepository.deleteByDeckId(deckId);
        flashcardDeckRepository.delete(deck);
        log.info("Đã xóa thành công bộ thẻ id={} và toàn bộ thẻ con", deckId);
    }

    @Override
    @Transactional
    public FlashcardResponse addCard(Integer deckId, CreateFlashcardRequest request, Integer adminId) {
        log.info("Admin thêm thẻ từ vựng vào deckId={} bởi adminId={}", deckId, adminId);
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // Dùng userId của chủ sở hữu deck (hoặc adminId nếu là deck hệ thống)
        Integer effectiveUserId = deck.getUserId() != null ? deck.getUserId() : adminId;
        return userFlashcardService.addCard(deckId, request, effectiveUserId);
    }

    @Override
    @Transactional
    public void deleteCard(Integer cardId) {
        log.info("Admin xóa thẻ từ vựng cardId={}", cardId);
        UserFlashcard card = userFlashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_NOT_FOUND));
        userFlashcardRepository.delete(card);
    }
}

