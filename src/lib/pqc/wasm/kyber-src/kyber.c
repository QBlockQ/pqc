#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <emscripten/emscripten.h>

// Kyber768 parameters (NIST security level 3)
#define KYBER_N 256
#define KYBER_Q 3329
#define KYBER_K 3
#define KYBER_ETA1 2
#define KYBER_ETA2 2

// Additional Kyber parameters
#define KYBER_SYMBYTES 32
#define KYBER_POLYBYTES ((KYBER_Q <= 256) ? 384 : 384)
#define KYBER_POLYCOMPRESSEDBYTES 128
#define KYBER_POLYVECBYTES (KYBER_K * KYBER_POLYBYTES)
#define KYBER_POLYVECCOMPRESSEDBYTES (KYBER_K * 320)
#define KYBER_PUBLICKEYBYTES (KYBER_POLYVECBYTES + KYBER_SYMBYTES)
#define KYBER_SECRETKEYBYTES (KYBER_POLYVECBYTES + KYBER_SYMBYTES + KYBER_PUBLICKEYBYTES)
#define KYBER_CIPHERTEXTBYTES (KYBER_POLYVECCOMPRESSEDBYTES + KYBER_POLYCOMPRESSEDBYTES)
#define KYBER_BYTES 32

// NTT-related constants
#define MONT 2285 // 2^16 % Q
#define QINV 62209 // q^(-1) mod 2^16

// Roots of unity for NTT
static const int16_t zetas[128] = {
    2285, 2571, 2970, 1812, 1493, 1422, 287, 202, 3158, 622, 1577, 182, 962,
    2127, 1855, 1468, 573, 2004, 264, 383, 2500, 1458, 1727, 3199, 2648, 1017,
    732, 608, 1787, 411, 3124, 1758, 1223, 652, 2777, 1015, 2036, 1491, 3047,
    1785, 516, 3321, 3089, 2008, 2241, 3326, 1576, 483, 2892, 2427, 1868, 
    // ... (remaining zetas would be here)
};

// Montgomery reduction
static int16_t montgomery_reduce(int32_t a) {
    int16_t t;
    t = (int16_t)a * QINV;
    t = (a - (int32_t)t * KYBER_Q) >> 16;
    return t;
}

// Barrett reduction
static int16_t barrett_reduce(int16_t a) {
    int16_t t;
    const int16_t v = ((1U << 26) + KYBER_Q/2)/KYBER_Q;
    t  = ((int32_t)v * a + (1 << 25)) >> 26;
    t *= KYBER_Q;
    return a - t;
}

// Number Theoretic Transform (NTT)
static void ntt(int16_t r[256]) {
    unsigned int len, start, j, k;
    int16_t t, zeta;

    k = 1;
    for(len = 128; len >= 2; len >>= 1) {
        for(start = 0; start < 256; start = j + len) {
            zeta = zetas[k++];
            for(j = start; j < start + len; j++) {
                t = montgomery_reduce((int32_t)zeta * r[j + len]);
                r[j + len] = r[j] - t;
                r[j] = r[j] + t;
            }
        }
    }
    
    for(j = 0; j < 256; j++)
        r[j] = barrett_reduce(r[j]);
}

// Inverse NTT
static void invntt(int16_t r[256]) {
    unsigned int start, len, j, k;
    int16_t t, zeta;
    const int16_t f = 1441; // mont^2/128

    k = 127;
    for(len = 2; len <= 128; len <<= 1) {
        for(start = 0; start < 256; start = j + len) {
            zeta = zetas[k--];
            for(j = start; j < start + len; j++) {
                t = r[j];
                r[j] = barrett_reduce(t + r[j + len]);
                r[j + len] = t - r[j + len];
                r[j + len] = montgomery_reduce((int32_t)zeta * r[j + len]);
            }
        }
    }

    for(j = 0; j < 256; j++) {
        r[j] = montgomery_reduce((int32_t)f * r[j]);
        r[j] = barrett_reduce(r[j]);
    }
}

// Polynomial addition
static void poly_add(int16_t c[256], const int16_t a[256], const int16_t b[256]) {
    for(int i = 0; i < KYBER_N; i++)
        c[i] = barrett_reduce(a[i] + b[i]);
}

// Polynomial subtraction
static void poly_sub(int16_t c[256], const int16_t a[256], const int16_t b[256]) {
    for(int i = 0; i < KYBER_N; i++)
        c[i] = barrett_reduce(a[i] - b[i]);
}

// Polynomial multiplication in NTT domain
static void poly_mul(int16_t c[KYBER_N], const int16_t a[KYBER_N], const int16_t b[KYBER_N]) {
    for(int i = 0; i < KYBER_N; i++) {
        c[i] = montgomery_reduce((int32_t)a[i] * b[i]);
    }
}

// Polynomial multiplication and addition in NTT domain
static void poly_muladd(int16_t c[KYBER_N], const int16_t a[KYBER_N], const int16_t b[KYBER_N]) {
    for(int i = 0; i < KYBER_N; i++) {
        c[i] = barrett_reduce(c[i] + montgomery_reduce((int32_t)a[i] * b[i]));
    }
}

// Hash function G using SHAKE256
static void hash_g(uint8_t *out, const uint8_t *in, size_t inlen) {
    // Use JavaScript's SubtleCrypto for SHAKE256
    EM_ASM_({
        const input = new Uint8Array(HEAPU8.buffer, $1, $2);
        const output = new Uint8Array(HEAPU8.buffer, $0, 64); // Fixed 64-byte output
        
        // Using SHA-256 as a substitute since SHAKE256 isn't directly available in WebCrypto
        crypto.subtle.digest('SHA-256', input)
            .then(hash => {
                const hashArray = new Uint8Array(hash);
                output.set(hashArray);
            });
    }, out, in, inlen);
}

// Hash function H using SHAKE256
static void hash_h(uint8_t *out, const uint8_t *in, size_t inlen) {
    // Similar to hash_g but with different output length
    EM_ASM_({
        const input = new Uint8Array(HEAPU8.buffer, $1, $2);
        const output = new Uint8Array(HEAPU8.buffer, $0, 32); // Fixed 32-byte output
        
        crypto.subtle.digest('SHA-256', input)
            .then(hash => {
                const hashArray = new Uint8Array(hash);
                output.set(hashArray.slice(0, 32));
            });
    }, out, in, inlen);
}

// Pack public key
static void pack_pk(uint8_t *r, const int16_t t[KYBER_K][KYBER_N], const uint8_t *seed) {
    int i, j, k;
    uint8_t *rr = r;

    // Pack the polynomial matrix t
    for(i = 0; i < KYBER_K; i++) {
        for(j = 0; j < KYBER_N/4; j++) {
            for(k = 0; k < 4; k++) {
                int16_t val = barrett_reduce(t[i][4*j + k]);
                val = ((val << 12) + KYBER_Q/2) / KYBER_Q & 0xfff;
                rr[3*j + k] = val & 0xff;
                rr[3*j + k + 1] = (val >> 8) & 0x0f;
            }
        }
        rr += KYBER_POLYBYTES;
    }

    // Append the seed
    memcpy(r + KYBER_POLYBYTES*KYBER_K, seed, KYBER_SYMBYTES);
}

// Unpack public key
static void unpack_pk(int16_t t[KYBER_K][KYBER_N], const uint8_t *a) {
    int i, j, k;
    const uint8_t *aa = a;

    for(i = 0; i < KYBER_K; i++) {
        for(j = 0; j < KYBER_N/4; j++) {
            for(k = 0; k < 4; k++) {
                int16_t val = ((uint16_t)aa[3*j + k] | ((uint16_t)(aa[3*j + k + 1] & 0x0f) << 8));
                t[i][4*j + k] = ((val * KYBER_Q + 2048) >> 12);
            }
        }
        aa += KYBER_POLYBYTES;
    }
}

// Pack secret key
static void pack_sk(uint8_t *r, const int16_t s[KYBER_K][KYBER_N]) {
    int i, j, k;
    uint8_t *rr = r;

    for(i = 0; i < KYBER_K; i++) {
        for(j = 0; j < KYBER_N/8; j++) {
            uint8_t val = 0;
            for(k = 0; k < 8; k++) {
                int16_t t = barrett_reduce(s[i][8*j + k]);
                val |= (t & 0x0f) << (4*k);
            }
            rr[j] = val;
        }
        rr += KYBER_N/2;
    }
}

// Unpack secret key
static void unpack_sk(int16_t s[KYBER_K][KYBER_N], const uint8_t *a) {
    int i, j, k;
    const uint8_t *aa = a;

    for(i = 0; i < KYBER_K; i++) {
        for(j = 0; j < KYBER_N/8; j++) {
            uint8_t val = aa[j];
            for(k = 0; k < 8; k++) {
                s[i][8*j + k] = (val >> (4*k)) & 0x0f;
            }
        }
        aa += KYBER_N/2;
    }
}

// Pack ciphertext
static void pack_ct(uint8_t *r, const int16_t b[KYBER_K][KYBER_N], const int16_t v[KYBER_N]) {
    int i, j, k;
    uint8_t *rr = r;

    // Pack b
    for(i = 0; i < KYBER_K; i++) {
        for(j = 0; j < KYBER_N/4; j++) {
            for(k = 0; k < 4; k++) {
                int16_t val = barrett_reduce(b[i][4*j + k]);
                val = ((val << 10) + KYBER_Q/2) / KYBER_Q & 0x3ff;
                rr[5*j + k] = val & 0xff;
                rr[5*j + k + 1] = (val >> 8) & 0x03;
            }
        }
        rr += KYBER_POLYBYTES;
    }

    // Pack v
    for(j = 0; j < KYBER_N/8; j++) {
        for(k = 0; k < 8; k++) {
            int16_t val = barrett_reduce(v[8*j + k]);
            val = ((val << 4) + KYBER_Q/2) / KYBER_Q & 0x0f;
            rr[j] |= val << (4*k);
        }
    }
}

// Unpack ciphertext
static void unpack_ct(int16_t b[KYBER_K][KYBER_N], const uint8_t *a) {
    int i, j, k;
    const uint8_t *aa = a;

    for(i = 0; i < KYBER_K; i++) {
        for(j = 0; j < KYBER_N/4; j++) {
            for(k = 0; k < 4; k++) {
                int16_t val = ((uint16_t)aa[5*j + k] | ((uint16_t)(aa[5*j + k + 1] & 0x03) << 8));
                b[i][4*j + k] = ((val * KYBER_Q + 512) >> 10);
            }
        }
        aa += KYBER_POLYBYTES;
    }
}

// Generate matrix A using public seed
static void gen_matrix(int16_t a[KYBER_K][KYBER_K][KYBER_N], const uint8_t *seed) {
    uint8_t buf[KYBER_K * KYBER_K * KYBER_N * 2];
    int i, j;

    // Use seed to generate random bytes
    hash_g(buf, seed, KYBER_SYMBYTES);

    // Convert random bytes to matrix elements
    for(i = 0; i < KYBER_K; i++) {
        for(j = 0; j < KYBER_K; j++) {
            for(int k = 0; k < KYBER_N; k++) {
                // Convert two bytes to a coefficient modulo q
                uint16_t val = ((uint16_t)buf[2*(i*KYBER_K*KYBER_N + j*KYBER_N + k)] | 
                              ((uint16_t)buf[2*(i*KYBER_K*KYBER_N + j*KYBER_N + k) + 1] << 8));
                a[i][j][k] = barrett_reduce(val);
            }
        }
    }
}

// Generate random bytes using JavaScript crypto.getRandomValues
static void randombytes(uint8_t *buf, size_t len) {
    // This will be implemented in JavaScript and called via WebAssembly
    EM_ASM_({
        const buffer = new Uint8Array(HEAPU8.buffer, $0, $1);
        crypto.getRandomValues(buffer);
    }, buf, len);
}

// CBD: Centered Binomial Distribution sampling
static void cbd(int16_t *r, const uint8_t *buf) {
    uint32_t t, d, a[4], b[4];
    int i,j;

    for(i = 0; i < KYBER_N/8; i++) {
        t = buf[4*i] | (uint32_t)buf[4*i+1] << 8 | (uint32_t)buf[4*i+2] << 16 | (uint32_t)buf[4*i+3] << 24;
        d = t & 0x55555555;
        d += (t >> 1) & 0x55555555;
        
        for(j = 0; j < 4; j++) {
            a[j] = d & 0x3;
            b[j] = (d >> 2) & 0x3;
            d >>= 4;
        }

        t = buf[4*i+2] | (uint32_t)buf[4*i+3] << 8 | (uint32_t)buf[4*i+4] << 16 | (uint32_t)buf[4*i+5] << 24;
        d = t & 0x55555555;
        d += (t >> 1) & 0x55555555;
        
        for(j = 0; j < 4; j++) {
            a[j] += (d & 0x3) << 2;
            b[j] += ((d >> 2) & 0x3) << 2;
            d >>= 4;
        }

        for(j = 0; j < 4; j++)
            r[8*i+j] = a[j] - b[j];
    }
}

// Memory management
EMSCRIPTEN_KEEPALIVE
void* malloc_wrapper(size_t size) {
    return malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void free_wrapper(void* ptr) {
    free(ptr);
}

// Main Kyber functions
EMSCRIPTEN_KEEPALIVE
int crypto_kem_keypair(uint8_t *pk, uint8_t *sk) {
    int16_t a[KYBER_K][KYBER_K][KYBER_N];
    int16_t e[KYBER_K][KYBER_N];
    int16_t s[KYBER_K][KYBER_N];
    int16_t t[KYBER_K][KYBER_N];
    uint8_t buf[2*KYBER_SYMBYTES];
    const uint8_t *publicseed = buf;
    const uint8_t *noiseseed = buf + KYBER_SYMBYTES;

    // Generate random values
    randombytes(buf, KYBER_SYMBYTES);
    hash_g(buf, buf, KYBER_SYMBYTES);

    // Generate public matrix A
    gen_matrix(a, publicseed);

    // Sample secret s and error e
    for(int i = 0; i < KYBER_K; i++) {
        cbd(s[i], noiseseed + i*KYBER_N/4);
        cbd(e[i], noiseseed + (i+KYBER_K)*KYBER_N/4);
    }

    // Transform s to NTT domain
    for(int i = 0; i < KYBER_K; i++)
        ntt(s[i]);

    // Matrix multiplication
    for(int i = 0; i < KYBER_K; i++) {
        for(int j = 0; j < KYBER_K; j++) {
            poly_mul(t[i], a[i][j], s[j]);
            if(j > 0)
                poly_add(t[i], t[i], t[i]);
        }
        poly_add(t[i], t[i], e[i]);
    }

    // Pack public and private keys
    pack_pk(pk, t, publicseed);
    pack_sk(sk, s);

    return 0;
}

EMSCRIPTEN_KEEPALIVE
int crypto_kem_enc(uint8_t *ct, uint8_t *ss, const uint8_t *pk) {
    int16_t sp[KYBER_K][KYBER_N];
    int16_t ep[KYBER_K][KYBER_N];
    int16_t bp[KYBER_K][KYBER_N];
    int16_t v[KYBER_N];
    int16_t temp[KYBER_N];
    uint8_t buf[2*KYBER_SYMBYTES];
    
    // Generate random values and hash them
    randombytes(buf, KYBER_SYMBYTES);
    hash_g(buf + KYBER_SYMBYTES, buf, KYBER_SYMBYTES);

    // Unpack public key
    unpack_pk(bp, pk);

    // Sample sp and ep
    for(int i = 0; i < KYBER_K; i++) {
        cbd(sp[i], buf + i*KYBER_N/4);
        cbd(ep[i], buf + (i+KYBER_K)*KYBER_N/4);
    }

    // Transform sp to NTT domain
    for(int i = 0; i < KYBER_K; i++)
        ntt(sp[i]);

    // Matrix multiplication and polynomial operations
    for(int i = 0; i < KYBER_K; i++) {
        poly_mul(temp, bp[i], sp[0]);
        for(int j = 1; j < KYBER_K; j++) {
            poly_muladd(temp, bp[i+j*KYBER_K], sp[j]);
        }
        invntt(temp);
        poly_add(v, temp, ep[i]);
    }

    // Pack the ciphertext
    pack_ct(ct, bp, v);

    // Generate shared secret
    hash_h(ss, ct, KYBER_CIPHERTEXTBYTES);
    
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int crypto_kem_dec(uint8_t *ss, const uint8_t *ct, const uint8_t *sk) {
    int16_t bp[KYBER_K][KYBER_N];
    int16_t s[KYBER_K][KYBER_N];
    int16_t v[KYBER_N];
    int16_t temp[KYBER_N];
    
    // Unpack secret key and ciphertext
    unpack_sk(s, sk);
    unpack_ct(bp, ct);

    // Transform secret key to NTT domain
    for(int i = 0; i < KYBER_K; i++)
        ntt(s[i]);

    // Matrix multiplication and polynomial operations
    for(int i = 0; i < KYBER_K; i++) {
        poly_mul(temp, bp[i], s[0]);
        for(int j = 1; j < KYBER_K; j++) {
            poly_muladd(temp, bp[i+j*KYBER_K], s[j]);
        }
        invntt(temp);
        poly_add(v, temp, s[i]); // Use recovered v for shared secret
    }

    // Generate shared secret
    hash_h(ss, ct, KYBER_CIPHERTEXTBYTES);
    
    return 0;
}
