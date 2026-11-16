export async function isRateLimited(
    db: D1Database,
    table: string,
    userCol: string,
    timeCol: string,
    userId: number,
    limit: number,
    window: string,
): Promise<boolean>
