package com.multilingo.backend.modules.testing.service.support;

import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.HTML;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.parser.ParserDelegator;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/** Projects scoped exam HTML to plain text and extracts image references without fetching them. */
final class WritingHtmlProjector {
    private static final Pattern HTML_TAG = Pattern.compile("(?is)<\\s*[a-z][^>]*>");

    private WritingHtmlProjector() {}

    static Projection project(String value) {
        if (value == null || value.isBlank()) return new Projection(value, List.of(), false);
        if (!HTML_TAG.matcher(value).find()) return new Projection(value, List.of(), false);

        StringBuilder text = new StringBuilder();
        List<String> imageUrls = new ArrayList<>();
        boolean[] invalidImageReference = {false};
        HTMLEditorKit.ParserCallback callback = new HTMLEditorKit.ParserCallback() {
            @Override public void handleStartTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
                collectImage(tag, attributes);
                addSpacing(text, tag);
            }

            @Override public void handleSimpleTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
                collectImage(tag, attributes);
                addSpacing(text, tag);
            }

            @Override public void handleEndTag(HTML.Tag tag, int position) { addSpacing(text, tag); }

            @Override public void handleText(char[] data, int position) { text.append(data); }

            private void collectImage(HTML.Tag tag, MutableAttributeSet attributes) {
                if (tag != HTML.Tag.IMG) return;
                Object src = attributes.getAttribute(HTML.Attribute.SRC);
                if (!(src instanceof String url) || url.isBlank()) invalidImageReference[0] = true;
                else imageUrls.add(url.trim());
            }

            private void addSpacing(StringBuilder target, HTML.Tag tag) {
                String name = tag.toString().toLowerCase(Locale.ROOT);
                if (List.of("p", "div", "br", "li", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6").contains(name)) {
                    target.append(' ');
                }
            }
        };

        try {
            new ParserDelegator().parse(new StringReader(value), callback, true);
        } catch (IOException e) {
            return new Projection("", List.of(), true);
        }
        String plainText = text.toString().replaceAll("[\\s\\p{Z}]+", " ").strip();
        return new Projection(plainText, List.copyOf(imageUrls), invalidImageReference[0]);
    }

    record Projection(String text, List<String> imageUrls, boolean invalidImageReference) {}
}
