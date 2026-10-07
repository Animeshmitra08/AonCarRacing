import { MAX_HANDSHAKE_BYTES, MAX_MESSAGE_BYTES } from "@/network/constants";

import { base64Encode, sha1, utf8Decode, utf8Encode } from "./encoding";
import type { TcpConnection, TcpConnectionHandlers, TcpServer, TcpServerFactory } from "./tcp";

const HANDSHAKE_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const HEADER_END = utf8Encode("\r\n\r\n");

const OPCODE = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;
const CLOSE_CODE = { normal: 1000, protocolError: 1002, tooBig: 1009 } as const;

/**
 * Minimal RFC 6455 WebSocket server over a raw TCP server. Text messages only;
 * clients are the phones' built-in `WebSocket`.
 */
export class WebSocketServer {
  private tcp: TcpServer | null = null;
  private readonly connections = new Set<WebSocketConnection>();

  constructor(private readonly createTcpServer: TcpServerFactory) {}

  async listen(port: number, onConnection: (connection: WebSocketConnection) => void): Promise<void> {
    this.tcp = await this.createTcpServer(port, (tcp) => {
      const connection = new WebSocketConnection(tcp, () => {
        this.connections.add(connection);
        onConnection(connection);
      });
      connection.addCloseListener(() => this.connections.delete(connection));
      return connection.handlers;
    });
  }

  close(): void {
    for (const connection of this.connections) connection.close();
    this.connections.clear();
    this.tcp?.close();
    this.tcp = null;
  }
}

export class WebSocketConnection {
  onMessage: ((text: string) => void) | null = null;

  private buffer: Uint8Array = new Uint8Array(0);
  private upgraded = false;
  private closed = false;
  private fragments: Uint8Array[] = [];
  private fragmentBytes = 0;
  private readonly closeListeners: (() => void)[] = [];

  readonly handlers: TcpConnectionHandlers = {
    onData: (bytes) => this.receive(bytes),
    onClose: () => this.finish(),
  };

  constructor(
    private readonly tcp: TcpConnection,
    private readonly onOpen: () => void,
  ) {}

  get remoteAddress(): string | undefined {
    return this.tcp.remoteAddress;
  }

  addCloseListener(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  send(text: string): void {
    if (this.closed || !this.upgraded) return;
    this.writeFrame(OPCODE.text, utf8Encode(text));
  }

  close(code: number = CLOSE_CODE.normal): void {
    if (this.closed) return;
    if (this.upgraded) this.writeFrame(OPCODE.close, Uint8Array.of(code >> 8, code & 0xff));
    this.tcp.destroy();
    this.finish();
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.closeListeners) listener();
  }

  private receive(bytes: Uint8Array): void {
    if (this.closed) return;
    this.buffer = concat(this.buffer, bytes);
    if (!this.upgraded) {
      this.readHandshake();
      if (!this.upgraded) return;
    }
    this.readFrames();
  }

  private readHandshake(): void {
    const end = indexOf(this.buffer, HEADER_END);
    if (end < 0) {
      if (this.buffer.length > MAX_HANDSHAKE_BYTES) this.reject();
      return;
    }
    const request = utf8Decode(this.buffer.subarray(0, end));
    this.buffer = this.buffer.slice(end + HEADER_END.length);

    const [requestLine, ...headerLines] = request.split("\r\n");
    const headers = new Map<string, string>();
    for (const line of headerLines) {
      const colon = line.indexOf(":");
      if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
    }
    const key = headers.get("sec-websocket-key");
    if (!requestLine.startsWith("GET ") || headers.get("upgrade")?.toLowerCase() !== "websocket" || !key) {
      this.reject();
      return;
    }

    const accept = base64Encode(sha1(utf8Encode(key + HANDSHAKE_GUID)));
    this.tcp.write(
      utf8Encode(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      ),
    );
    this.upgraded = true;
    this.onOpen();
  }

  private reject(): void {
    this.tcp.write(utf8Encode("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"));
    this.tcp.destroy();
    this.finish();
  }

  private readFrames(): void {
    while (!this.closed && this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let length = b1 & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = (this.buffer[2] << 8) | this.buffer[3];
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, 10);
        if (view.getUint32(2) !== 0) return this.close(CLOSE_CODE.tooBig);
        length = view.getUint32(6);
        offset = 10;
      }

      // Clients must mask every frame (RFC 6455 §5.1).
      if (!masked) return this.close(CLOSE_CODE.protocolError);
      if (length > MAX_MESSAGE_BYTES) return this.close(CLOSE_CODE.tooBig);
      if (this.buffer.length < offset + 4 + length) return;

      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = this.buffer.slice(offset + 4, offset + 4 + length);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buffer = this.buffer.slice(offset + 4 + length);

      this.handleFrame(fin, opcode, payload);
    }
  }

  private handleFrame(fin: boolean, opcode: number, payload: Uint8Array): void {
    switch (opcode) {
      case OPCODE.text:
      case OPCODE.continuation: {
        if (opcode === OPCODE.text) {
          this.fragments = [];
          this.fragmentBytes = 0;
        }
        this.fragments.push(payload);
        this.fragmentBytes += payload.length;
        if (this.fragmentBytes > MAX_MESSAGE_BYTES) return this.close(CLOSE_CODE.tooBig);
        if (fin) {
          const message = utf8Decode(this.fragments.length === 1 ? this.fragments[0] : concat(...this.fragments));
          this.fragments = [];
          this.fragmentBytes = 0;
          this.onMessage?.(message);
        }
        break;
      }
      case OPCODE.ping:
        this.writeFrame(OPCODE.pong, payload);
        break;
      case OPCODE.close:
        this.close();
        break;
      case OPCODE.binary:
      case OPCODE.pong:
        break; // not used by this protocol
      default:
        this.close(CLOSE_CODE.protocolError);
    }
  }

  /** Server frames are never masked. */
  private writeFrame(opcode: number, payload: Uint8Array): void {
    const length = payload.length;
    const headerLength = length < 126 ? 2 : length < 0x10000 ? 4 : 10;
    const frame = new Uint8Array(headerLength + length);
    frame[0] = 0x80 | opcode;
    if (length < 126) {
      frame[1] = length;
    } else if (length < 0x10000) {
      frame[1] = 126;
      frame[2] = length >> 8;
      frame[3] = length & 0xff;
    } else {
      frame[1] = 127;
      new DataView(frame.buffer).setUint32(6, length);
    }
    frame.set(payload, headerLength);
    this.tcp.write(frame);
  }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function indexOf(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
