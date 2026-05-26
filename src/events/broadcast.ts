export type BroadcastMessage
  = | { type: 'set', key: string, encoded: string, channel?: string }
    | { type: 'remove', key: string, channel?: string }
    | { type: 'clear', channel?: string }

export class StorageBroadcast {
  private channel: BroadcastChannel | null = null
  private channelId: string | null

  constructor(channelId: string | null) {
    this.channelId = channelId
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('stokado::channel')
    }
  }

  post(message: BroadcastMessage): void {
    this.channel?.postMessage(message)
  }

  listen(onMessage: (msg: BroadcastMessage) => void): void {
    if (!this.channel)
      return
    this.channel.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as BroadcastMessage
      if (this.channelId && msg.channel && this.channelId !== msg.channel)
        return
      onMessage(msg)
    }
  }

  destroy(): void {
    this.channel?.close()
    this.channel = null
  }
}
