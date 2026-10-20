package com.multilingo.backend.modules.testing.ai.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.net.InetAddress;
import java.net.Inet6Address;
import static org.assertj.core.api.Assertions.*;

class ImageAddressPolicyTest {
    private final ImageAddressPolicy policy = new ImageAddressPolicy();

    @ParameterizedTest
    @ValueSource(strings = {"127.0.0.1", "169.254.1.1", "10.1.1.1", "172.16.0.1", "172.31.255.255",
            "192.168.1.1", "100.64.0.0", "100.127.255.255", "0.0.0.0", "0.2.3.4", "224.0.0.1",
            "::", "::1", "fe80::1", "fec0::1", "fc00::1", "fdff::1", "ff02::1"})
    void rejectsNonPublicAddresses(String ip) throws Exception {
        assertThatThrownBy(() -> policy.requirePublic(new InetAddress[]{InetAddress.getByName(ip)}))
                .isInstanceOfSatisfying(ImageFetchException.class,
                        e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.ADDRESS_REJECTED));
    }

    @Test void rejectsMixedAndMappedAddresses() throws Exception {
        var publicIp = InetAddress.getByName("203.0.113.10");
        assertThatCode(() -> policy.requirePublic(new InetAddress[]{publicIp})).doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.requirePublic(new InetAddress[]{publicIp, InetAddress.getByName("10.0.0.1")}))
                .isInstanceOf(ImageFetchException.class);
        byte[] mapped = new byte[16];
        mapped[10] = mapped[11] = (byte) 0xff;
        mapped[12] = 127;
        mapped[15] = 1;
        assertThatThrownBy(() -> policy.requirePublic(new InetAddress[]{Inet6Address.getByAddress(null, mapped, -1)}))
                .isInstanceOf(ImageFetchException.class);
        assertThatThrownBy(() -> policy.requirePublic(new InetAddress[0])).isInstanceOf(ImageFetchException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"100.63.255.255", "100.128.0.0", "172.15.255.255", "172.32.0.0", "2001:db8::1"})
    void acceptsAddressesOutsideBlockedBoundaries(String ip) throws Exception {
        assertThatCode(() -> policy.requirePublic(new InetAddress[]{InetAddress.getByName(ip)})).doesNotThrowAnyException();
    }
}
