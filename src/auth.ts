export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const encoder = new TextEncoder();

    // Generate a random salt if not provided
    if(!salt){
        const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
        salt = Array.from(saltBuffer).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Hash password with salt using PBKDF2
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password + salt),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        key,
        256
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return { hash, salt };
}

export function generateToken(): string {
    const buffer = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}