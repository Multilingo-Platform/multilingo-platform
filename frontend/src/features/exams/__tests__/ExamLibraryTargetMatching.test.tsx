import { describe, expect, it } from 'vitest';
import { getTargetCertCategory, isExamMatchingTargetCert, isSameLanguage } from '../pages/student/ExamLibrary';

describe('ExamLibrary Target Matching and Filtering Logic', () => {
  describe('getTargetCertCategory', () => {
    it('correctly maps target certificates to categories', () => {
      expect(getTargetCertCategory('IELTS_ACADEMIC')).toBe('IELTS');
      expect(getTargetCertCategory('IELTS_GENERAL')).toBe('IELTS');
      expect(getTargetCertCategory('TOEIC_LR')).toBe('TOEIC_LR');
      expect(getTargetCertCategory('TOEIC')).toBe('TOEIC_LR');
      expect(getTargetCertCategory('TOEIC_WRITING')).toBe('TOEIC_WRITING');
      expect(getTargetCertCategory('TW')).toBe('TOEIC_WRITING');
      expect(getTargetCertCategory('NLTV')).toBe('NLTV');
      expect(getTargetCertCategory(null)).toBe('');
      expect(getTargetCertCategory(undefined)).toBe('');
    });
  });

  describe('isExamMatchingTargetCert', () => {
    it('matches IELTS exams only for IELTS target', () => {
      expect(isExamMatchingTargetCert('IELTS_ACADEMIC', 'IELTS_ACADEMIC')).toBe(true);
      expect(isExamMatchingTargetCert('IELTS_GENERAL', 'IELTS_ACADEMIC')).toBe(true);
      expect(isExamMatchingTargetCert('IELTS_READING', 'IELTS_ACADEMIC')).toBe(true);
      expect(isExamMatchingTargetCert('TOEIC_LR', 'IELTS_ACADEMIC')).toBe(false);
      expect(isExamMatchingTargetCert('NLTV', 'IELTS_ACADEMIC')).toBe(false);
    });

    it('matches TOEIC L&R exams for TOEIC_LR target, excluding TOEIC_WRITING', () => {
      expect(isExamMatchingTargetCert('TOEIC_LR', 'TOEIC_LR')).toBe(true);
      expect(isExamMatchingTargetCert('TOEIC', 'TOEIC_LR')).toBe(true);
      expect(isExamMatchingTargetCert('TOEIC_P1', 'TOEIC_LR')).toBe(true);
      expect(isExamMatchingTargetCert('TOEIC_READING', 'TOEIC_LR')).toBe(true);
      expect(isExamMatchingTargetCert('TOEIC_WRITING', 'TOEIC_LR')).toBe(false);
      expect(isExamMatchingTargetCert('TW_P1', 'TOEIC_LR')).toBe(false);
      expect(isExamMatchingTargetCert('IELTS_ACADEMIC', 'TOEIC_LR')).toBe(false);
      expect(isExamMatchingTargetCert('NLTV', 'TOEIC_LR')).toBe(false);
    });

    it('matches TOEIC Writing exams for TOEIC_WRITING target, excluding TOEIC_LR', () => {
      expect(isExamMatchingTargetCert('TOEIC_WRITING', 'TOEIC_WRITING')).toBe(true);
      expect(isExamMatchingTargetCert('TW_P1', 'TOEIC_WRITING')).toBe(true);
      expect(isExamMatchingTargetCert('TOEIC_LR', 'TOEIC_WRITING')).toBe(false);
      expect(isExamMatchingTargetCert('TOEIC_P1', 'TOEIC_WRITING')).toBe(false);
      expect(isExamMatchingTargetCert('IELTS_ACADEMIC', 'TOEIC_WRITING')).toBe(false);
    });

    it('matches NLTV exams only for NLTV target', () => {
      expect(isExamMatchingTargetCert('NLTV', 'NLTV')).toBe(true);
      expect(isExamMatchingTargetCert('NLTV_A1_A2', 'NLTV')).toBe(true);
      expect(isExamMatchingTargetCert('NLTV_B1_C1', 'NLTV')).toBe(true);
      expect(isExamMatchingTargetCert('NLTV_READING', 'NLTV')).toBe(true);
      expect(isExamMatchingTargetCert('IELTS_ACADEMIC', 'NLTV')).toBe(false);
      expect(isExamMatchingTargetCert('TOEIC_LR', 'NLTV')).toBe(false);
    });

    it('returns false when examType or targetCert is empty', () => {
      expect(isExamMatchingTargetCert('', 'NLTV')).toBe(false);
      expect(isExamMatchingTargetCert('NLTV', '')).toBe(false);
      expect(isExamMatchingTargetCert('NLTV', null)).toBe(false);
    });
  });

  describe('isSameLanguage', () => {
    it('correctly matches English variations', () => {
      expect(isSameLanguage('en', 'en')).toBe(true);
      expect(isSameLanguage('ENGLISH', 'en')).toBe(true);
      expect(isSameLanguage('en-US', 'en')).toBe(true);
      expect(isSameLanguage('en', 'ENGLISH')).toBe(true);
    });

    it('correctly matches Vietnamese variations', () => {
      expect(isSameLanguage('vi', 'vi')).toBe(true);
      expect(isSameLanguage('vietnamese', 'vi')).toBe(true);
      expect(isSameLanguage('vi-VN', 'vi')).toBe(true);
    });

    it('correctly rejects different languages', () => {
      expect(isSameLanguage('vi', 'en')).toBe(false);
      expect(isSameLanguage('ENGLISH', 'vi')).toBe(false);
      expect(isSameLanguage('en', 'vi')).toBe(false);
    });
  });
});
