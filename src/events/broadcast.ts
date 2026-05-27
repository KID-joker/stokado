export type BroadcastMessage
  = | { type: 'set', key: string, encoded: string }
    | { type: 'remove', key: string }
    | { type: 'clear' }

export class StorageBroadcast {
  private channel: BroadcastChannel | null = null

  constructor(channelId: string | null) {
    if (typeof BroadcastChannel !== 'undefined') {
      const name = channelId ? `stokado::channel::${channelId}` : 'stokado::channel'
      this.channel = new BroadcastChannel(name)
    }
  }

  post(message: BroadcastMessage): void {
    this.channel?.postMessage(message)
  }

  listen(onMessage: (msg: BroadcastMessage) => void): void {
    if (!this.channel)
      return
    this.channel.onmessage = (ev: MessageEvent) => {
      onMessage(ev.data as BroadcastMessage)
    }
  }

  destroy(): void {
    this.channel?.close()
    this.channel = null
  }
}
