/**
 * The minimal TCP surface the WebSocket server needs. Implemented by
 * react-native-tcp-socket on phones (and Node's `net` in tests), so the
 * protocol code stays platform-independent.
 */
export interface TcpConnection {
  readonly remoteAddress: string | undefined;
  write(bytes: Uint8Array): void;
  destroy(): void;
}

export interface TcpConnectionHandlers {
  onData(bytes: Uint8Array): void;
  onClose(): void;
}

export interface TcpServer {
  close(): void;
}

/** Starts listening on `port`; `accept` is called for every incoming connection. */
export type TcpServerFactory = (
  port: number,
  accept: (connection: TcpConnection) => TcpConnectionHandlers,
) => Promise<TcpServer>;
