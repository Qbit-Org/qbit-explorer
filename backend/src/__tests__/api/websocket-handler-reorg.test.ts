jest.mock('../../api/blocks', () => ({
  __esModule: true,
  default: {
    getBlocks: jest.fn(),
  },
}));

jest.mock('../../api/difficulty-adjustment', () => ({
  __esModule: true,
  default: {
    getDifficultyAdjustment: jest.fn(),
  },
}));

// Keep the pool updater and backend info timers in the handler's dependency
// graph from starting, as blocks-cache.test.ts does
jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/backend-info', () => ({
  __esModule: true,
  default: {},
}));

import * as WebSocket from 'ws';
import blocks from '../../api/blocks';
import websocketHandler from '../../api/websocket-handler';
import { BlockExtended } from '../../mempool.interfaces';

const block = (height: number): BlockExtended => ({ id: String(height % 10).repeat(64), height } as BlockExtended);

describe('WebsocketHandler.handleReorg', () => {
  const cached = [block(98), block(99)];
  const sent: unknown[] = [];

  beforeAll(() => {
    // a page that wants blocks, and one that doesn't
    const clients = [
      { readyState: WebSocket.OPEN, 'want-blocks': true, send: (message: string): number => sent.push(JSON.parse(message)) },
      { readyState: WebSocket.OPEN, send: (message: string): number => sent.push(JSON.parse(message)) },
    ];
    websocketHandler.addWebsocketServer({ clients: new Set(clients) } as unknown as WebSocket.Server);
    jest.mocked(blocks.getBlocks).mockReturnValue(cached);
  });

  beforeEach(() => {
    sent.length = 0;
  });

  test('marks the list it sends as a reorg, so pages can lower their tip', () => {
    websocketHandler.handleReorg();

    expect(sent).toEqual([{ blocks: cached, reorg: true }]);
  });

  test('marks the list as a reorg when it is given a new tip block that is not cached yet', () => {
    websocketHandler.handleReorg(block(100));

    expect(sent).toEqual([{ blocks: [...cached, block(100)], reorg: true }]);
  });

  test('leaves the mark out of the list a page gets when it connects', () => {
    websocketHandler.handleReorg();

    expect(JSON.parse(websocketHandler.getSerializedInitData())).toEqual({ blocks: cached });
  });
});
