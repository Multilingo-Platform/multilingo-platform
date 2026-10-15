package com.multilingo.backend.modules.testing.ai.media;

public final class ImageSniffer {
    private ImageSniffer() {}
    private static final byte[] PNG = {(byte)137,80,78,71,13,10,26,10};

    public static String sniff(byte[] data, String contentType) {
        if (data == null || data.length == 0) invalid();
        final String mime;
        if (prefix(data, PNG)) {
            png(data);
            mime = "image/png";
        } else if (data.length >= 2 && (data[0] & 255) == 255 && (data[1] & 255) == 216) {
            jpeg(data);
            mime = "image/jpeg";
        } else if (asciiPrefix(data, "RIFF")) {
            webp(data);
            mime = "image/webp";
        } else {
            throw new ImageFetchException(ImageFetchException.Kind.UNSUPPORTED_TYPE);
        }
        String declared = contentType == null ? "" : contentType.split(";", 2)[0].trim().toLowerCase(java.util.Locale.ROOT);
        if (!mime.equals(declared)) throw new ImageFetchException(ImageFetchException.Kind.UNSUPPORTED_TYPE);
        return mime;
    }

    private static void png(byte[] data) {
        if (data.length < 45 || !java.util.Arrays.equals(PNG, java.util.Arrays.copyOf(data, 8))) invalid();
        int position = 8;
        boolean header = false, pixels = false;
        while (position + 12 <= data.length) {
            long length = u32(data, position, false);
            long end = position + 12L + length;
            if (end > data.length) invalid();
            String type = ascii(data, position + 4);
            if (!header) {
                if (!type.equals("IHDR") || length != 13 || u32(data, position + 8, false) == 0
                        || u32(data, position + 12, false) == 0) invalid();
                header = true;
            } else if (type.equals("IHDR")) invalid();
            if (type.equals("IDAT")) pixels = true;
            if (type.equals("IEND")) {
                if (!pixels || length != 0 || end != data.length) invalid();
                return;
            }
            position = (int) end;
        }
        invalid();
    }

    private static void jpeg(byte[] data) {
        if (data.length < 6 || (data[2] & 255) != 255 || (data[data.length - 2] & 255) != 255
                || (data[data.length - 1] & 255) != 217) invalid();
        int position = 2;
        int frameComponents = 0;
        while (position + 4 <= data.length) {
            if ((data[position++] & 255) != 255) invalid();
            while (position < data.length && (data[position] & 255) == 255) position++;
            if (position + 2 >= data.length) invalid();
            int marker = data[position++] & 255;
            int length = (data[position] & 255) * 256 + (data[position + 1] & 255);
            if (length < 2 || position + length > data.length - 2) invalid();
            if (java.util.Set.of(192,193,194,195,197,198,199,201,202,203,205,206,207).contains(marker)) {
                if (length < 11) invalid();
                frameComponents = data[position + 7] & 255;
                if (frameComponents == 0 || length != 8 + 3 * frameComponents
                        || ((data[position + 3] & 255) | (data[position + 4] & 255)) == 0
                        || ((data[position + 5] & 255) | (data[position + 6] & 255)) == 0) invalid();
            }
            // Entropy decoding is deliberately left to the image consumer.
            if (marker == 218) {
                if (frameComponents == 0 || length < 8) invalid();
                int scanComponents = data[position + 2] & 255;
                if (scanComponents == 0 || scanComponents > frameComponents || length != 6 + 2 * scanComponents
                        || position + length >= data.length - 2) invalid();
                return;
            }
            position += length;
        }
        invalid();
    }

    private static void webp(byte[] data) {
        if (data.length < 20 || !ascii(data, 8).equals("WEBP") || u32(data, 4, true) + 8 != data.length) invalid();
        int position = 12;
        boolean pixels = false;
        while (position + 8 <= data.length) {
            String type = ascii(data, position);
            long length = u32(data, position + 4, true);
            long end = position + 8L + length + (length & 1);
            if (end > data.length) invalid();
            if (type.equals("VP8 ")) {
                if (length < 10) invalid();
                pixels = true;
            } else if (type.equals("VP8L")) {
                if (length < 5 || data[position + 8] != 47) invalid();
                pixels = true;
            } else if (type.equals("VP8X") && length != 10) invalid();
            position = (int) end;
        }
        if (position != data.length || !pixels) invalid();
    }

    private static boolean prefix(byte[] data, byte[] signature) {
        int count = Math.min(data.length, signature.length);
        for (int i = 0; i < count; i++) if (data[i] != signature[i]) return false;
        return count > 0;
    }
    private static boolean asciiPrefix(byte[] data, String signature) {
        return prefix(data, signature.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }
    private static String ascii(byte[] data, int offset) {
        return new String(data, offset, 4, java.nio.charset.StandardCharsets.US_ASCII);
    }
    private static long u32(byte[] data, int offset, boolean little) {
        long result = 0;
        for (int i = 0; i < 4; i++) result = result * 256 + (data[offset + (little ? 3 - i : i)] & 255);
        return result;
    }
    private static void invalid() { throw new ImageFetchException(ImageFetchException.Kind.INVALID_CONTENT); }
}
