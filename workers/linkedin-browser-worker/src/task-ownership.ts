export interface QueueOwnership {
  renew(itemId: string): Promise<boolean>;
}

type Timer = ReturnType<typeof setInterval>;

export class TaskOwnershipLifecycle {
  private timer: Timer | null = null;
  private consecutiveFailures = 0;

  constructor(
    private readonly queue: QueueOwnership,
    private readonly itemId: string,
    private readonly onLost: (reason: string) => void,
    private readonly onError: (error: unknown) => void,
    private readonly intervalMs = 30_000,
  ) {}

  async start(): Promise<void> {
    if (!await this.queue.renew(this.itemId)) throw new Error('Queue lease ownership lost before task startup');
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    try {
      const renewed = await this.queue.renew(this.itemId);
      this.consecutiveFailures = 0;
      if (!renewed) this.onLost('Queue lease ownership lost');
    } catch (error) {
      this.consecutiveFailures += 1;
      this.onError(error);
      if (this.consecutiveFailures >= 2) this.onLost('Queue lease could not be renewed');
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
