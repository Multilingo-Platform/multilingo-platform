import React, { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading3,
  List,
  ListOrdered,
  Quote,
  CornerDownLeft,
  Highlighter,
  Eye,
  Edit3
} from 'lucide-react';
import MediaUploadButton from './MediaUploadButton';
import { formatHtmlContent } from '../../utils/htmlUtils';
import './RichTextEditor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  minHeight?: string;
  className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Nhập văn bản hoặc định dạng tại đây...',
  label,
  rows = 5,
  minHeight = '140px',
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (tagOpen: string, tagClose: string, defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value || '';
    const hasSelection = start !== end;
    const selectedText = hasSelection ? text.substring(start, end) : defaultPlaceholder;

    const replacement = `${tagOpen}${selectedText}${tagClose}`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      if (hasSelection) {
        // Keep selected text highlighted
        const newStart = start + tagOpen.length;
        const newEnd = newStart + selectedText.length;
        textarea.setSelectionRange(newStart, newEnd);
      } else {
        // Highlight the default placeholder text so user can immediately type over it
        const newStart = start + tagOpen.length;
        const newEnd = newStart + defaultPlaceholder.length;
        textarea.setSelectionRange(newStart, newEnd);
      }
    }, 0);
  };

  const handleImageUploaded = (url: string) => {
    const textarea = textareaRef.current;
    const imgHtml = `\n<p style="text-align: center;"><img src="${url}" alt="Illustration" style="max-width: 100%; border-radius: 6px; margin: 8px 0;" /></p>\n`;

    if (!textarea) {
      onChange((value || '') + imgHtml);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value || '';

    const newText = text.substring(0, start) + imgHtml + text.substring(end);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + imgHtml.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        applyFormat('<b>', '</b>', 'văn bản in đậm');
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        applyFormat('<i>', '</i>', 'văn bản in nghiêng');
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        applyFormat('<u>', '</u>', 'văn bản gạch chân');
      }
    }
  };

  // Convert text and HTML into formatted HTML preserving all newlines and paragraphs
  const getPreviewHtml = () => {
    return formatHtmlContent(value);
  };

  const wordCount = (value || '').trim() ? (value || '').trim().split(/\s+/).length : 0;
  const charCount = (value || '').length;

  return (
    <div className={`rte-container ${className}`}>
      {/* Header with Title and Mode Switcher */}
      <div className="rte-header">
        {label && <div className="rte-label">{label}</div>}

        <div className="rte-tabs">
          <button
            type="button"
            className={`rte-tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <Edit3 size={13} /> Soạn thảo
          </button>
          <button
            type="button"
            className={`rte-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Eye size={13} /> Xem trước
          </button>
        </div>
      </div>

      {/* Formatting Toolbar (Only in Edit mode) */}
      {activeTab === 'edit' && (
        <div className="rte-toolbar">
          <div className="rte-btn-group">
            <button
              type="button"
              className="rte-btn"
              title="In đậm (Ctrl+B)"
              onClick={() => applyFormat('<b>', '</b>', 'văn bản in đậm')}
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="In nghiêng (Ctrl+I)"
              onClick={() => applyFormat('<i>', '</i>', 'văn bản in nghiêng')}
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Gạch chân (Ctrl+U)"
              onClick={() => applyFormat('<u>', '</u>', 'văn bản gạch chân')}
            >
              <Underline size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Gạch ngang"
              onClick={() => applyFormat('<s>', '</s>', 'văn bản gạch ngang')}
            >
              <Strikethrough size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Highlight (Tô vàng)"
              onClick={() =>
                applyFormat(
                  '<mark style="background: #fef08a; padding: 2px 4px; border-radius: 3px;">',
                  '</mark>',
                  'từ khóa highlight'
                )
              }
            >
              <Highlighter size={15} />
            </button>
          </div>

          <div className="rte-divider" />

          <div className="rte-btn-group">
            <button
              type="button"
              className="rte-btn"
              title="Tiêu đề H3"
              onClick={() => applyFormat('<h3>', '</h3>', 'Tiêu đề')}
            >
              <Heading3 size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Danh sách gạch đầu dòng"
              onClick={() =>
                applyFormat('<ul>\n  <li>', '</li>\n  <li>Ý 2</li>\n</ul>', 'Ý 1')
              }
            >
              <List size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Danh sách đánh số"
              onClick={() =>
                applyFormat('<ol>\n  <li>', '</li>\n  <li>Mục 2</li>\n</ol>', 'Mục 1')
              }
            >
              <ListOrdered size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Trích dẫn (Quote)"
              onClick={() =>
                applyFormat(
                  '<blockquote style="border-left: 3px solid #d97706; padding-left: 8px; color: #475569; margin: 8px 0; font-style: italic;">',
                  '</blockquote>',
                  'Trích dẫn nội dung...'
                )
              }
            >
              <Quote size={15} />
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Ngắt dòng (Xuống hàng)"
              onClick={() => applyFormat('<br/>', '', '')}
            >
              <CornerDownLeft size={15} />
            </button>
          </div>

          <div className="rte-divider" />

          {/* Insert Image Button */}
          <MediaUploadButton
            type="images"
            onUploadSuccess={handleImageUploaded}
            label="+ Chèn ảnh vào vị trí con trỏ"
          />
        </div>
      )}

      {/* Editor Body */}
      {activeTab === 'edit' ? (
        <textarea
          ref={textareaRef}
          className="rte-textarea"
          rows={rows}
          style={{ minHeight }}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      ) : (
        <div className="rte-preview" style={{ minHeight }}>
          {getPreviewHtml() ? (
            <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
          ) : (
            <div className="rte-empty-preview">Chưa có nội dung văn bản để xem trước.</div>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="rte-footer">
        <div>
          <span>{wordCount} từ</span> · <span>{charCount} ký tự</span>
        </div>
        <div>
          <span>Mẹo: Bôi đen chữ rồi bấm <b>B</b>, <i>I</i>, <u>U</u> để định dạng nhanh</span>
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor;
