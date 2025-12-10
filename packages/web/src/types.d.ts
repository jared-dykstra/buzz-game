export type SerialPort = EventTarget & {
  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
}

export type SerialOptions = {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

export type Serial = EventTarget & {
  requestPort(): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

declare global {
  interface Navigator {
    readonly serial: Serial
  }
}

