package com.multilingo.backend.modules.testing.ai.media;

import java.net.InetAddress;
import java.net.UnknownHostException;

public class ImageAddressPolicy {
    @FunctionalInterface
    public interface Resolver { InetAddress[] resolve(String host) throws UnknownHostException; }
    public void requirePublic(InetAddress[] addresses) {
        if (addresses == null || addresses.length == 0) reject();
        for (InetAddress address : addresses) {
            if (address == null || address.isAnyLocalAddress() || address.isLoopbackAddress()
                    || address.isLinkLocalAddress() || address.isSiteLocalAddress() || address.isMulticastAddress()) reject();
            byte[] bytes = address.getAddress();
            if (bytes.length == 4 && blockedV4(bytes, 0)) reject();
            if (bytes.length == 16) {
                if ((bytes[0] & 0xfe) == 0xfc) reject();
                boolean mapped = true;
                for (int i = 0; i < 10; i++) mapped &= bytes[i] == 0;
                mapped &= bytes[10] == (byte) 0xff && bytes[11] == (byte) 0xff;
                if (mapped && blockedV4(bytes, 12)) reject();
            }
        }
    }

    private static boolean blockedV4(byte[] bytes, int offset) {
        int a = bytes[offset] & 255, b = bytes[offset + 1] & 255;
        return a == 0 || a == 10 || a == 127 || a >= 224 || (a == 169 && b == 254)
                || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168)
                || (a == 100 && b >= 64 && b <= 127);
    }

    private static void reject() { throw new ImageFetchException(ImageFetchException.Kind.ADDRESS_REJECTED); }
}
