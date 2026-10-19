package com.multilingo.backend.modules.testing.ai.media;

import java.net.URI;
import java.util.List;
import java.util.Locale;

public class ImageUrlPolicy {
    private final List<URI> prefixes;

    public ImageUrlPolicy(List<String> prefixes) {
        try {
            if (prefixes == null || prefixes.isEmpty()) throw new IllegalArgumentException();
            this.prefixes = prefixes.stream().map(prefix -> {
                URI uri = parse(prefix);
                if (uri.getRawQuery() != null || !uri.getRawPath().endsWith("/")) throw new IllegalArgumentException();
                return uri;
            }).toList();
        } catch (RuntimeException error) {
            throw new IllegalStateException("Invalid image fetch configuration");
        }
    }

    public URI validate(String url) {
        final URI uri;
        try { uri = parse(url); }
        catch (RuntimeException error) { throw new ImageFetchException(ImageFetchException.Kind.INVALID_URL); }
        boolean allowed = prefixes.stream().anyMatch(prefix -> prefix.getHost().equalsIgnoreCase(uri.getHost())
                && effectivePort(prefix) == effectivePort(uri) && uri.getRawPath().startsWith(prefix.getRawPath()));
        if (!allowed) throw new ImageFetchException(ImageFetchException.Kind.HOST_NOT_ALLOWED);
        return uri;
    }

    private static URI parse(String url) {
        if (url == null || url.isEmpty() || url.length() > 2_048 || url.indexOf('\\') >= 0) throw new IllegalArgumentException();
        URI uri = URI.create(url);
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getRawUserInfo() != null
                || uri.getRawFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)
                || host.indexOf(':') >= 0 || host.endsWith(".") || host.matches("[0-9.]+")
                || host.matches("(?i)0x[0-9a-f]+") || host.equalsIgnoreCase("localhost")
                || host.toLowerCase(Locale.ROOT).endsWith(".localhost")) throw new IllegalArgumentException();
        for (String label : host.split("\\.", -1)) {
            if (!label.matches("[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")) throw new IllegalArgumentException();
        }
        String path = uri.getRawPath();
        // Also reject nested encoding of path separators/dots; never decode or rewrite a signed query.
        String checked = path.toLowerCase(Locale.ROOT);
        while (checked.indexOf('%') >= 0) {
            StringBuilder decoded = new StringBuilder(checked.length());
            boolean changed = false;
            for (int i = 0; i < checked.length(); i++) {
                char value = checked.charAt(i);
                if (value == '%' && i + 2 < checked.length()) {
                    int high = Character.digit(checked.charAt(i + 1), 16);
                    int low = Character.digit(checked.charAt(i + 2), 16);
                    if (high >= 0 && low >= 0) {
                        value = (char) (high * 16 + low);
                        if (value == '.' || value == '/' || value == '\\') throw new IllegalArgumentException();
                        i += 2;
                        changed = true;
                    }
                }
                decoded.append(value);
            }
            if (!changed) break;
            checked = decoded.toString().toLowerCase(Locale.ROOT);
        }
        for (String segment : path.split("/", -1)) {
            if (segment.equals("..")) throw new IllegalArgumentException();
        }
        return uri;
    }

    private static int effectivePort(URI uri) { return uri.getPort() == -1 ? 443 : uri.getPort(); }
    @Override public String toString() { return "ImageUrlPolicy{prefixCount=" + prefixes.size() + '}'; }
}
