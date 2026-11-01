import { describe, expect, it } from 'vitest';
import { normalizeDictionaryLookupV3Response, validateSource } from '../api/dictionaryLookupV3Contract';
import { buildDictionaryLookupV3Request } from '../utils/dictionarySelection';
import type { WorkspaceTextDocument } from '../types/workspaceText.types';
import { buildWorkspaceTextDocuments } from '../utils/workspaceTextDocuments';

const request = { requestId: 'f98eb3d0-808c-4cc0-88d0-d8f94f1a7347', partId: 7, source: { kind: 'QUESTION_TEXT' as const, questionId: 'q1' }, selectedText: 'word', contextText: 'a word here' };
function response() { return { success: true, data: { requestId: request.requestId, attemptId: 42, partId: 7, source: request.source, selectedText: 'word', sourceContext: 'a word here', policyVersion: 'NATIVE_PROFILE_V1', definition: { schemaVersion: 2, learningLanguage: 'en', meaningLanguage: 'vi', meaning: 'từ', phonetic: null, partOfSpeech: null, example: 'A word.', exampleTranslation: 'Một từ.' } } }; }
describe('Dictionary v3 contract', () => {
  it.each([[false,'  '],[true,'  '],[false,'\u00a0'],[true,'\u00a0']] as const)('R2-F01 builds a later repeated selection for HTML=%s whitespace=%j', (html, whitespace) => {
    const text = `chosen${whitespace}words; later chosen words.`;
    const doc = buildWorkspaceTextDocuments(html
      ? {content_html:`<p>chosen${whitespace === '\u00a0' ? '&nbsp;' : whitespace}words; later <b>chosen words</b>.</p>`}
      : {instruction:text},7)[0];
    const start = doc.text.lastIndexOf('chosen words');
    expect(start).toBe(text.lastIndexOf('chosen words'));
    const built = buildDictionaryLookupV3Request({rect:new DOMRect(),text:'chosen words',start,end:start+12,
      documentId:doc.sourceKey,contentHash:doc.contentHash,scopeText:doc.text,contextKey:'ctx',contextRevision:1},7,'en',[doc]);
    expect(built.selectedText).toBe('chosen words');
    expect(built.contextText).toBe('chosen words; later chosen words.');
    const raw = response();
    Object.assign(raw.data,{requestId:built.requestId,source:built.source,selectedText:built.selectedText,sourceContext:built.contextText});
    expect(normalizeDictionaryLookupV3Response(raw,built,42,'en','vi').selectedText).toBe('chosen words');
  });
  it.each([false, true])('R2-F01 sends collapsed context from production %s source and accepts canonical response', html => {
    const text = '😀 First line\nchosen  words\u00a0after.';
    const doc = buildWorkspaceTextDocuments(html
      ? { content_html: '<p>😀 First line</p>\n<p>chosen  words&nbsp;after.</p>' }
      : { instruction: text }, 7)[0];
    const start = doc.text.indexOf('chosen');
    const built = buildDictionaryLookupV3Request({rect:new DOMRect(), text:'chosen', start, end:start+6,
      documentId:doc.sourceKey,contentHash:doc.contentHash,scopeText:doc.text,contextKey:'ctx',contextRevision:1},7,'en',[doc]);
    expect(built.contextText).toBe('😀 First line chosen words after.');
    const raw = response();
    Object.assign(raw.data, {requestId:built.requestId,source:built.source,selectedText:'chosen',sourceContext:'😀 First line chosen words after.'});
    expect(normalizeDictionaryLookupV3Response(raw,built,42,'en','vi').sourceContext).toBe(built.contextText);
  });
  it('validates the frozen native pair, including same-language definitions', () => {
    expect(normalizeDictionaryLookupV3Response(response(), request, 42, 'en', 'vi').source).toEqual(request.source);
    const value = response(); value.data.definition.meaningLanguage = 'en';
    expect(normalizeDictionaryLookupV3Response(value, request, 42, 'en', 'en').definition.meaningLanguage).toBe('en');
    expect(() => normalizeDictionaryLookupV3Response(value, request, 42, 'en', 'vi')).toThrow();
  });
  it.each(['requestId','attemptId','partId','selectedText','policyVersion','source'])('rejects mismatched %s', key => {
    const value = response(); Object.assign(value.data, { [key]: key === 'source' ? { kind: 'QUESTION_TEXT', questionId: 'other' } : 'wrong' });
    expect(() => normalizeDictionaryLookupV3Response(value, request, 42, 'en', 'vi')).toThrow();
  });
  it('rejects private/unknown source fields and definition schema/markup', () => {
    expect(() => validateSource({ kind: 'QUESTION_TEXT', questionId: 'q1', answer: 'secret' })).toThrow();
    const value = response(); value.data.definition.schemaVersion = 1;
    expect(() => normalizeDictionaryLookupV3Response(value, request, 42, 'en', 'vi')).toThrow();
  });
  it.each([['ja',80,true], ['zh',81,false], ['en',80,true], ['en',81,false]] as const)('builds %s selection of %s code points: %s', (language, length, valid) => {
    const text = '文'.repeat(length);
    const doc: WorkspaceTextDocument = { partId: 7, source: request.source, sourceKey: 'QUESTION_TEXT:2:q1', contentHash: 'hash', text, format: 'TEXT', html: null };
    const selection = { rect: new DOMRect(), text, start: 0, end: text.length, documentId: doc.sourceKey, contentHash: 'hash', scopeText: text, contextKey: 'ctx', contextRevision: 1 };
    const build = () => buildDictionaryLookupV3Request(selection, 7, language, [doc]);
    if (valid) { expect(build()).not.toHaveProperty('meaningLanguage'); expect(build().source).toEqual(request.source); }
    else expect(build).toThrow();
  });
});
