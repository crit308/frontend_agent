export type StreamEvent = Record<string, any>;

export function connectTutorStream(
  sessionId: string,
  jwt: string
): WebSocket {
  const url = new URL(
    `/api/v1/ws/session/${sessionId}`,
    process.env.NEXT_PUBLIC_API_WS_URL
  );
  url.searchParams.set('token', jwt);

  const ws = new WebSocket(url.toString());

  ws.onopen = () => {
    console.log('[TutorWS] connected');
  };
  ws.onerror = (err) => {
    console.error('[TutorWS] error', err);
  };
  ws.onclose = (ev) => {
    console.log('[TutorWS] closed', ev.code, ev.reason);
  };
  ws.onmessage = (msg) => {
    try {
      const data: StreamEvent = JSON.parse(msg.data);
      handleStreamEvent(data);
    } catch (e) {
      console.error('[TutorWS] could not parse message', e);
    }
  };

  return ws;
}

function handleStreamEvent(event: StreamEvent) {
  switch (event.type) {
    case 'raw_response_event':
      // e.g. event.data.delta (next token)
      break;
    case 'run_item_stream_event':
      // e.g. event.item.type === 'message_output_item'
      break;
    case 'agent_updated_stream_event':
      // handle handoff
      break;
    case 'error':
      console.error('[TutorWS] remote error', event.detail);
      break;
    default:
      console.warn('[TutorWS] unhandled event', event);
  }
} 